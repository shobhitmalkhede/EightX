#!/usr/bin/env node

/**
 * ClickUp MCP Server
 *
 * Provides Model Context Protocol tools for interacting with ClickUp:
 *  - get_tasks    → Read tasks from a list
 *  - get_task     → Read a single task by ID
 *  - create_task  → Create a new task in a list
 *  - update_task  → Update an existing task
 *  - get_users    → Read all workspace members
 *  - get_spaces   → List all spaces
 *  - get_lists    → List all lists in a space
 *
 * Supports two transports:
 *  - stdio  (default) → for local use with Claude Desktop / Cursor
 *  - http   (set TRANSPORT=http) → for remote deployment on Railway etc.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express from "express";
import { ClickUpClient } from "./clickup-client.js";
import { registerTools } from "./tools.js";

// ─── Configuration ─────────────────────────────────────────────────

const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN;
const CLICKUP_TEAM_ID = process.env.CLICKUP_TEAM_ID;
const TRANSPORT = process.env.TRANSPORT ?? "stdio";
const PORT = parseInt(process.env.PORT ?? "3000", 10);

if (!CLICKUP_API_TOKEN) {
  console.error("❌ Missing CLICKUP_API_TOKEN environment variable");
  console.error("   Get your token from: ClickUp → Settings → Apps → API Token");
  process.exit(1);
}

if (!CLICKUP_TEAM_ID) {
  console.error("❌ Missing CLICKUP_TEAM_ID environment variable");
  console.error(
    "   Find it in the URL when on ClickUp: app.clickup.com/{team_id}/..."
  );
  process.exit(1);
}

// ─── Initialize ────────────────────────────────────────────────────

const clickupClient = new ClickUpClient(CLICKUP_API_TOKEN, CLICKUP_TEAM_ID);

const server = new McpServer({
  name: "clickup-mcp-server",
  version: "1.0.0",
});

// Register all tools
registerTools(server, clickupClient);

// ─── Transport ─────────────────────────────────────────────────────

async function startStdioTransport() {
  console.error("🚀 Starting ClickUp MCP Server (stdio transport)");
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("✅ Server connected via stdio");
}

async function startHttpTransport() {
  const app = express();

  // Store active SSE transports by session
  const transports: Record<string, SSEServerTransport> = {};

  // Health check endpoint (Railway uses this)
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      server: "clickup-mcp-server",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
    });
  });

  // SSE endpoint – client connects here to establish the stream
  app.get("/sse", async (req, res) => {
    console.log("📡 New SSE connection established");

    const transport = new SSEServerTransport("/messages", res);
    const sessionId = transport.sessionId;
    transports[sessionId] = transport;

    res.on("close", () => {
      console.log(`🔌 SSE connection closed (session: ${sessionId})`);
      delete transports[sessionId];
    });

    await server.connect(transport);
  });

  // Message endpoint – client sends MCP messages here
  app.post("/messages", express.json(), async (req, res) => {
    const sessionId = req.query.sessionId as string;
    const transport = transports[sessionId];

    if (!transport) {
      res.status(400).json({ error: "Invalid or expired session" });
      return;
    }

    await transport.handlePostMessage(req, res);
  });

  // Root endpoint with info
  app.get("/", (_req, res) => {
    res.json({
      name: "ClickUp MCP Server",
      version: "1.0.0",
      description:
        "MCP server for ClickUp integration – manage tasks, users, spaces, and lists",
      endpoints: {
        sse: "/sse",
        messages: "/messages",
        health: "/health",
      },
      tools: [
        "get_tasks",
        "get_task",
        "create_task",
        "update_task",
        "get_users",
        "get_spaces",
        "get_lists",
      ],
    });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 ClickUp MCP Server running on http://0.0.0.0:${PORT}`);
    console.log(`   SSE endpoint:     http://0.0.0.0:${PORT}/sse`);
    console.log(`   Message endpoint: http://0.0.0.0:${PORT}/messages`);
    console.log(`   Health check:     http://0.0.0.0:${PORT}/health`);
    console.log(`   Transport:        SSE (HTTP)`);
  });
}

// ─── Start ─────────────────────────────────────────────────────────

if (TRANSPORT === "http") {
  startHttpTransport().catch((error) => {
    console.error("Failed to start HTTP transport:", error);
    process.exit(1);
  });
} else {
  startStdioTransport().catch((error) => {
    console.error("Failed to start stdio transport:", error);
    process.exit(1);
  });
}
