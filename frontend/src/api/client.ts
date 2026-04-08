import type {
  ProjectDetail,
  ProjectSummary,
  RunCreatePayload,
  RunDetail,
  RunSummary,
  TemplateSchema,
} from "../types";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") || "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, init);
  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    const rawBody = await response.text();
    if (rawBody) {
      try {
        const payload = JSON.parse(rawBody) as { detail?: string };
        message = payload.detail ?? rawBody;
      } catch {
        message = rawBody;
      }
    }
    throw new Error(message || "Unknown request failure");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function resolveApiUrl(path: string): string {
  if (/^https?:\/\//.test(path)) {
    return path;
  }
  if (path.startsWith("/")) {
    const origin = API_BASE_URL.replace(/\/api$/, "");
    return `${origin}${path}`;
  }
  return `${API_BASE_URL}/${path}`;
}

export const api = {
  listProjects(): Promise<ProjectSummary[]> {
    return request<ProjectSummary[]>("/projects");
  },

  getProject(projectId: string): Promise<ProjectDetail> {
    return request<ProjectDetail>(`/projects/${projectId}`);
  },

  deleteProject(projectId: string): Promise<void> {
    return request<void>(`/projects/${projectId}`, {
      method: "DELETE",
    });
  },

  async createProject(input: {
    name?: string;
    template: File;
    papers: File[];
    templateSchema?: TemplateSchema | null;
  }): Promise<ProjectDetail> {
    const formData = new FormData();
    if (input.name) {
      formData.append("name", input.name);
    }
    formData.append("template", input.template);
    input.papers.forEach((paper) => formData.append("papers", paper));
    if (input.templateSchema) {
      formData.append("template_guidance", JSON.stringify(input.templateSchema));
    }
    return request<ProjectDetail>("/projects", {
      method: "POST",
      body: formData,
    });
  },

  async previewTemplate(template: File): Promise<TemplateSchema> {
    const formData = new FormData();
    formData.append("template", template);
    return request<TemplateSchema>("/projects/template-preview", {
      method: "POST",
      body: formData,
    });
  },

  async addPapers(projectId: string, papers: File[]): Promise<ProjectDetail> {
    const formData = new FormData();
    papers.forEach((paper) => formData.append("papers", paper));
    return request<ProjectDetail>(`/projects/${projectId}/papers`, {
      method: "POST",
      body: formData,
    });
  },

  deletePaper(projectId: string, paperId: string): Promise<ProjectDetail> {
    return request<ProjectDetail>(`/projects/${projectId}/papers/${paperId}`, {
      method: "DELETE",
    });
  },

  async replaceTemplate(projectId: string, template: File): Promise<ProjectDetail> {
    const formData = new FormData();
    formData.append("template", template);
    return request<ProjectDetail>(`/projects/${projectId}/template`, {
      method: "POST",
      body: formData,
    });
  },

  updateTemplateGuidance(projectId: string, templateSchema: TemplateSchema): Promise<ProjectDetail> {
    return request<ProjectDetail>(`/projects/${projectId}/template-guidance`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(templateSchema),
    });
  },

  listRuns(projectId: string): Promise<RunSummary[]> {
    return request<RunSummary[]>(`/projects/${projectId}/runs`);
  },

  createRun(
    projectId: string,
    payload: RunCreatePayload,
    options?: {
      template?: File | null;
      papers?: File[];
    },
  ): Promise<RunDetail> {
    const formData = new FormData();
    formData.append("payload", JSON.stringify(payload));
    if (options?.template) {
      formData.append("template", options.template);
    }
    (options?.papers ?? []).forEach((paper) => formData.append("papers", paper));
    return request<RunDetail>(`/projects/${projectId}/runs`, {
      method: "POST",
      body: formData,
    });
  },

  getRun(projectId: string, runId: string): Promise<RunDetail> {
    return request<RunDetail>(`/projects/${projectId}/runs/${runId}`);
  },

  deleteRun(projectId: string, runId: string): Promise<void> {
    return request<void>(`/projects/${projectId}/runs/${runId}`, {
      method: "DELETE",
    });
  },

  listOpenAiModels(apiKey: string): Promise<{ models: string[] }> {
    return request<{ models: string[] }>("/openai/models", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ api_key: apiKey }),
    });
  },
};
