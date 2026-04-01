/**
 * ClickUp API v2 Client
 * Handles all HTTP communication with the ClickUp API
 */

const CLICKUP_API_BASE = "https://api.clickup.com/api/v2";

export interface ClickUpTask {
  id: string;
  name: string;
  description?: string;
  status: {
    status: string;
    color: string;
    type: string;
    orderindex: number;
  };
  priority?: {
    id: string;
    priority: string;
    color: string;
  } | null;
  assignees: Array<{
    id: number;
    username: string;
    email: string;
    color: string;
    profilePicture: string | null;
  }>;
  due_date: string | null;
  date_created: string;
  date_updated: string;
  url: string;
  list: {
    id: string;
    name: string;
  };
  folder: {
    id: string;
    name: string;
  };
  space: {
    id: string;
  };
  tags: Array<{
    name: string;
    tag_fg: string;
    tag_bg: string;
  }>;
}

export interface ClickUpUser {
  id: number;
  username: string;
  email: string;
  color: string;
  profilePicture: string | null;
  role: number;
  custom_role: string | null;
  last_active: string;
  date_joined: string;
  date_invited: string;
}

export interface ClickUpSpace {
  id: string;
  name: string;
  private: boolean;
  statuses: Array<{
    status: string;
    type: string;
    orderindex: number;
    color: string;
  }>;
}

export interface ClickUpList {
  id: string;
  name: string;
  content: string;
  status: {
    status: string;
    color: string;
    hide_label: boolean;
  };
  space: {
    id: string;
    name: string;
  };
  folder: {
    id: string;
    name: string;
    hidden: boolean;
  };
  task_count: number;
}

export interface CreateTaskPayload {
  name: string;
  description?: string;
  assignees?: number[];
  status?: string;
  priority?: number | null;
  due_date?: number;
  tags?: string[];
}

export class ClickUpClient {
  private apiToken: string;
  private teamId: string;

  constructor(apiToken: string, teamId: string) {
    this.apiToken = apiToken;
    this.teamId = teamId;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${CLICKUP_API_BASE}${endpoint}`;
    const headers: Record<string, string> = {
      Authorization: this.apiToken,
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `ClickUp API error (${response.status}): ${errorBody}`
      );
    }

    // DELETE responses may have no body
    if (response.status === 204 || response.headers.get("content-length") === "0") {
      return {} as T;
    }

    return response.json() as Promise<T>;
  }

  // ─── TASKS ─────────────────────────────────────────────────────────

  /**
   * Get all tasks in a list
   */
  async getTasks(
    listId: string,
    options?: {
      page?: number;
      order_by?: string;
      reverse?: boolean;
      subtasks?: boolean;
      statuses?: string[];
      include_closed?: boolean;
      assignees?: number[];
      due_date_gt?: number;
      due_date_lt?: number;
    }
  ): Promise<{ tasks: ClickUpTask[] }> {
    const params = new URLSearchParams();

    if (options?.page !== undefined) params.set("page", String(options.page));
    if (options?.order_by) params.set("order_by", options.order_by);
    if (options?.reverse !== undefined) params.set("reverse", String(options.reverse));
    if (options?.subtasks !== undefined) params.set("subtasks", String(options.subtasks));
    if (options?.include_closed) params.set("include_closed", "true");
    if (options?.statuses) {
      options.statuses.forEach((s) => params.append("statuses[]", s));
    }
    if (options?.assignees) {
      options.assignees.forEach((a) => params.append("assignees[]", String(a)));
    }
    if (options?.due_date_gt) params.set("due_date_gt", String(options.due_date_gt));
    if (options?.due_date_lt) params.set("due_date_lt", String(options.due_date_lt));

    const query = params.toString();
    const endpoint = `/list/${listId}/task${query ? `?${query}` : ""}`;

    return this.request<{ tasks: ClickUpTask[] }>(endpoint);
  }

  /**
   * Get a single task by ID
   */
  async getTask(taskId: string): Promise<ClickUpTask> {
    return this.request<ClickUpTask>(`/task/${taskId}`);
  }

  /**
   * Create a new task in a list
   */
  async createTask(
    listId: string,
    payload: CreateTaskPayload
  ): Promise<ClickUpTask> {
    return this.request<ClickUpTask>(`/list/${listId}/task`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  /**
   * Delete a task permanently
   */
  async deleteTask(taskId: string): Promise<void> {
    await this.request<Record<string, never>>(`/task/${taskId}`, {
      method: "DELETE",
    });
  }

  /**
   * Update a task
   */
  async updateTask(
    taskId: string,
    payload: Partial<CreateTaskPayload>
  ): Promise<ClickUpTask> {
    return this.request<ClickUpTask>(`/task/${taskId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  // ─── USERS / TEAM MEMBERS ────────────────────────────────────────

  /**
   * Get all users (members) in the workspace
   */
  async getTeamMembers(): Promise<{
    team: {
      id: string;
      name: string;
      members: Array<{ user: ClickUpUser }>;
    };
  }> {
    return this.request(`/team/${this.teamId}`);
  }

  // ─── SPACES ──────────────────────────────────────────────────────

  /**
   * Get all spaces in the workspace
   */
  async getSpaces(): Promise<{ spaces: ClickUpSpace[] }> {
    return this.request(`/team/${this.teamId}/space`);
  }

  // ─── LISTS ───────────────────────────────────────────────────────

  /**
   * Get all lists in a space (folderless lists)
   */
  async getFolderlessLists(spaceId: string): Promise<{ lists: ClickUpList[] }> {
    return this.request(`/space/${spaceId}/list`);
  }

  /**
   * Get all folders in a space (each folder contains lists)
   */
  async getFolders(
    spaceId: string
  ): Promise<{
    folders: Array<{
      id: string;
      name: string;
      lists: ClickUpList[];
    }>;
  }> {
    return this.request(`/space/${spaceId}/folder`);
  }
}
