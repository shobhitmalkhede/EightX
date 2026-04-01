/**
 * MCP Tool definitions for ClickUp operations
 * Each tool maps to a ClickUp API operation
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ClickUpClient, ClickUpTask } from "./clickup-client.js";

/**
 * Format a task into a readable string
 */
function formatTask(task: ClickUpTask): string {
  const assignees =
    task.assignees.length > 0
      ? task.assignees.map((a) => a.username).join(", ")
      : "Unassigned";

  const priority = task.priority?.priority ?? "None";
  const dueDate = task.due_date
    ? new Date(parseInt(task.due_date)).toLocaleDateString()
    : "No due date";

  const tags =
    task.tags.length > 0 ? task.tags.map((t) => t.name).join(", ") : "None";

  return [
    `📋 **${task.name}**`,
    `   ID: ${task.id}`,
    `   Status: ${task.status.status}`,
    `   Priority: ${priority}`,
    `   Assignees: ${assignees}`,
    `   Due Date: ${dueDate}`,
    `   Tags: ${tags}`,
    `   List: ${task.list.name}`,
    `   URL: ${task.url}`,
    task.description ? `   Description: ${task.description.substring(0, 200)}${task.description.length > 200 ? "..." : ""}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Register all ClickUp MCP tools on the server
 */
export function registerTools(server: McpServer, client: ClickUpClient): void {
  // ─── GET TASKS (Read Tabs) ──────────────────────────────────────

  server.tool(
    "get_tasks",
    "Get all tasks from a ClickUp list. Returns task names, statuses, assignees, priorities, due dates, and more.",
    {
      list_id: z.string().describe("The ID of the ClickUp list to fetch tasks from"),
      page: z
        .number()
        .optional()
        .describe("Page number for pagination (starts at 0). Each page returns up to 100 tasks."),
      include_closed: z
        .boolean()
        .optional()
        .describe("Whether to include closed/completed tasks in the results"),
      statuses: z
        .array(z.string())
        .optional()
        .describe("Filter tasks by specific statuses (e.g. ['open', 'in progress'])"),
      assignees: z
        .array(z.number())
        .optional()
        .describe("Filter tasks by assignee user IDs"),
    },
    async ({ list_id, page, include_closed, statuses, assignees }) => {
      try {
        const result = await client.getTasks(list_id, {
          page,
          include_closed,
          statuses,
          assignees,
        });

        if (result.tasks.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No tasks found in this list.",
              },
            ],
          };
        }

        const formatted = result.tasks.map(formatTask).join("\n\n---\n\n");
        const summary = `Found ${result.tasks.length} task(s) in list ${list_id}:\n\n${formatted}`;

        return {
          content: [{ type: "text" as const, text: summary }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error fetching tasks: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ─── GET SINGLE TASK ─────────────────────────────────────────────

  server.tool(
    "get_task",
    "Get detailed information about a single ClickUp task by its ID.",
    {
      task_id: z.string().describe("The ID of the task to retrieve"),
    },
    async ({ task_id }) => {
      try {
        const task = await client.getTask(task_id);
        return {
          content: [{ type: "text" as const, text: formatTask(task) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error fetching task: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ─── CREATE TASK (Create Tab) ────────────────────────────────────

  server.tool(
    "create_task",
    "Create a new task in a ClickUp list. You can set the name, description, assignees, status, priority, due date, and tags.",
    {
      list_id: z.string().describe("The ID of the ClickUp list to create the task in"),
      name: z.string().describe("The name/title of the task"),
      description: z
        .string()
        .optional()
        .describe("A detailed description for the task (supports markdown)"),
      assignees: z
        .array(z.number())
        .optional()
        .describe("Array of user IDs to assign to this task"),
      status: z
        .string()
        .optional()
        .describe("The status to set for the task (must match a status in the list)"),
      priority: z
        .number()
        .min(1)
        .max(4)
        .nullable()
        .optional()
        .describe(
          "Priority level: 1 = Urgent, 2 = High, 3 = Normal, 4 = Low, null = No priority"
        ),
      due_date: z
        .string()
        .optional()
        .describe(
          "Due date as an ISO 8601 string (e.g. '2025-12-31'). Will be converted to Unix timestamp."
        ),
      tags: z
        .array(z.string())
        .optional()
        .describe("Array of tag names to add to the task"),
    },
    async ({ list_id, name, description, assignees, status, priority, due_date, tags }) => {
      try {
        const payload: Record<string, unknown> = { name };

        if (description) payload.description = description;
        if (assignees) payload.assignees = assignees;
        if (status) payload.status = status;
        if (priority !== undefined) payload.priority = priority;
        if (due_date) payload.due_date = new Date(due_date).getTime();
        if (tags) payload.tags = tags;

        const task = await client.createTask(list_id, payload as any);

        return {
          content: [
            {
              type: "text" as const,
              text: `✅ Task created successfully!\n\n${formatTask(task)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error creating task: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ─── UPDATE TASK ─────────────────────────────────────────────────

  server.tool(
    "update_task",
    "Update an existing ClickUp task. You can modify the name, description, status, priority, assignees, or due date.",
    {
      task_id: z.string().describe("The ID of the task to update"),
      name: z.string().optional().describe("New name/title for the task"),
      description: z
        .string()
        .optional()
        .describe("New description for the task"),
      status: z.string().optional().describe("New status for the task"),
      priority: z
        .number()
        .min(1)
        .max(4)
        .nullable()
        .optional()
        .describe("New priority: 1 = Urgent, 2 = High, 3 = Normal, 4 = Low"),
      assignees: z
        .array(z.number())
        .optional()
        .describe("New list of assignee user IDs (replaces existing)"),
      due_date: z
        .string()
        .optional()
        .describe("New due date as ISO 8601 string"),
    },
    async ({ task_id, name, description, status, priority, assignees, due_date }) => {
      try {
        const payload: Record<string, unknown> = {};
        if (name) payload.name = name;
        if (description) payload.description = description;
        if (status) payload.status = status;
        if (priority !== undefined) payload.priority = priority;
        if (assignees) payload.assignees = assignees;
        if (due_date) payload.due_date = new Date(due_date).getTime();

        const task = await client.updateTask(task_id, payload as any);

        return {
          content: [
            {
              type: "text" as const,
              text: `✏️ Task updated successfully!\n\n${formatTask(task)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error updating task: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ─── GET USERS (Read Users) ──────────────────────────────────────

  server.tool(
    "get_users",
    "Get all users/members in the ClickUp workspace (team). Returns usernames, emails, roles, and activity info.",
    {},
    async () => {
      try {
        const result = await client.getTeamMembers();
        const members = result.team.members;

        if (members.length === 0) {
          return {
            content: [
              { type: "text" as const, text: "No members found in this workspace." },
            ],
          };
        }

        const roleMap: Record<number, string> = {
          1: "Owner",
          2: "Admin",
          3: "Member",
          4: "Guest",
        };

        const formatted = members
          .map((m) => {
            const user = m.user;
            const role = roleMap[user.role] ?? `Role ${user.role}`;
            const lastActive = user.last_active
              ? new Date(parseInt(user.last_active)).toLocaleString()
              : "Never";

            return [
              `👤 **${user.username}**`,
              `   ID: ${user.id}`,
              `   Email: ${user.email}`,
              `   Role: ${role}`,
              `   Last Active: ${lastActive}`,
            ].join("\n");
          })
          .join("\n\n");

        return {
          content: [
            {
              type: "text" as const,
              text: `Team: **${result.team.name}** — ${members.length} member(s)\n\n${formatted}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error fetching users: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ─── GET SPACES ──────────────────────────────────────────────────

  server.tool(
    "get_spaces",
    "Get all spaces in the ClickUp workspace. Useful for discovering available spaces to find list IDs.",
    {},
    async () => {
      try {
        const result = await client.getSpaces();

        if (result.spaces.length === 0) {
          return {
            content: [
              { type: "text" as const, text: "No spaces found in this workspace." },
            ],
          };
        }

        const formatted = result.spaces
          .map((space) => {
            const statuses = space.statuses
              .map((s) => s.status)
              .join(", ");
            return [
              `📁 **${space.name}**`,
              `   ID: ${space.id}`,
              `   Private: ${space.private ? "Yes" : "No"}`,
              `   Statuses: ${statuses}`,
            ].join("\n");
          })
          .join("\n\n");

        return {
          content: [
            {
              type: "text" as const,
              text: `Found ${result.spaces.length} space(s):\n\n${formatted}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error fetching spaces: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ─── GET LISTS ───────────────────────────────────────────────────

  server.tool(
    "get_lists",
    "Get all lists in a ClickUp space (both folderless lists and lists inside folders). Useful for finding list IDs to use with task operations.",
    {
      space_id: z.string().describe("The ID of the space to get lists from"),
    },
    async ({ space_id }) => {
      try {
        // Fetch both folderless lists and folders with their lists
        const [folderlessResult, foldersResult] = await Promise.all([
          client.getFolderlessLists(space_id),
          client.getFolders(space_id),
        ]);

        const sections: string[] = [];

        // Folderless lists
        if (folderlessResult.lists.length > 0) {
          const listItems = folderlessResult.lists
            .map(
              (list) =>
                `   📝 **${list.name}** (ID: ${list.id}) — ${list.task_count ?? "?"} tasks`
            )
            .join("\n");
          sections.push(`📂 **Folderless Lists:**\n${listItems}`);
        }

        // Folder lists
        for (const folder of foldersResult.folders) {
          if (folder.lists.length > 0) {
            const listItems = folder.lists
              .map(
                (list) =>
                  `   📝 **${list.name}** (ID: ${list.id}) — ${list.task_count ?? "?"} tasks`
              )
              .join("\n");
            sections.push(
              `📁 **Folder: ${folder.name}** (ID: ${folder.id}):\n${listItems}`
            );
          }
        }

        if (sections.length === 0) {
          return {
            content: [
              { type: "text" as const, text: "No lists found in this space." },
            ],
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: `Lists in space ${space_id}:\n\n${sections.join("\n\n")}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error fetching lists: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
