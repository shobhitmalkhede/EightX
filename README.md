# ClickUp MCP Server

A **Model Context Protocol (MCP)** server that connects to the **ClickUp API v2**, letting AI assistants (Claude Desktop, Cursor, Windsurf, etc.) manage your ClickUp workspace.

## 🛠️ Tools Available

| Tool | Description |
|------|-------------|
| `get_tasks` | Read all tasks from a ClickUp list (with filtering) |
| `get_task` | Get detailed info about a single task |
| `create_task` | Create a new task in a list |
| `update_task` | Update an existing task |
| `get_users` | Get all workspace members |
| `get_spaces` | List all spaces in the workspace |
| `get_lists` | List all lists in a space |

## 🚀 Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

Copy the example file and fill in your ClickUp credentials:

```bash
cp .env.example .env
```

Edit `.env`:
```
CLICKUP_API_TOKEN=pk_your_token_here
CLICKUP_TEAM_ID=your_team_id
```

**How to get your API token:**
- Go to ClickUp → Settings → Apps → API Token → Generate

**How to find your Team ID:**
- Look at the URL when you're in ClickUp: `app.clickup.com/{team_id}/...`

### 3. Build & run

```bash
npm run build
npm start
```

## 🔌 Transport Modes

### Stdio Mode (Default) — Local use with Claude Desktop / Cursor

```bash
npm start
```

Configure in Claude Desktop (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "clickup": {
      "command": "node",
      "args": ["/path/to/clickup-mcp-server/build/index.js"],
      "env": {
        "CLICKUP_API_TOKEN": "pk_your_token",
        "CLICKUP_TEAM_ID": "your_team_id"
      }
    }
  }
}
```

### HTTP/SSE Mode — Remote deployment (Railway)

Set `TRANSPORT=http`:

```bash
TRANSPORT=http npm start
```

The server will listen on `PORT` (default 3000) with these endpoints:
- `GET /sse` — SSE connection endpoint
- `POST /messages` — MCP message endpoint
- `GET /health` — Health check
- `GET /` — Server info

## 🚂 Deploy to Railway

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit - ClickUp MCP Server"
git remote add origin https://github.com/your-username/clickup-mcp-server.git
git push -u origin main
```

### 2. Deploy on Railway

1. Go to [railway.app](https://railway.app)
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select your repository
4. Add environment variables in the Railway dashboard:
   - `CLICKUP_API_TOKEN` = your ClickUp API token
   - `CLICKUP_TEAM_ID` = your team/workspace ID
   - `TRANSPORT` = `http`
5. Railway will auto-detect the Dockerfile and deploy

### 3. Connect your MCP client

Use the Railway-provided URL:
```
https://your-service.up.railway.app/sse
```

## 📁 Project Structure

```
├── src/
│   ├── index.ts          # Entry point (transport setup)
│   ├── clickup-client.ts # ClickUp API v2 HTTP client
│   └── tools.ts          # MCP tool definitions
├── Dockerfile            # Multi-stage Docker build
├── railway.toml          # Railway deployment config
├── tsconfig.json         # TypeScript configuration
├── package.json          # Dependencies & scripts
└── .env.example          # Environment variable template
```

## 📋 Usage Examples

Once connected, you can ask your AI assistant things like:

- *"Show me all tasks in list 12345"*
- *"Create a task called 'Fix login bug' with high priority in list 12345"*
- *"Who are the members of my ClickUp workspace?"*
- *"What spaces do we have?"*
- *"Show me all lists in space 67890"*

## License

MIT
