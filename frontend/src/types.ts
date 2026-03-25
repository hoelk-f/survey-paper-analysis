export type Provider = "openai" | "anthropic" | "mock";
export type RunStatus = "pending" | "running" | "completed" | "completed_with_errors" | "failed";
export type PaperStatus = "pending" | "running" | "completed" | "failed";

export interface ColumnSchema {
  name: string;
  column_index: number;
  excel_column: string;
  description: string;
}

export interface SheetSchema {
  name: string;
  header_row_index: number;
  data_start_row_index: number;
  columns: ColumnSchema[];
}

export interface TemplateSchema {
  workbook_filename: string;
  sheets: SheetSchema[];
}

export interface PaperRecord {
  id: string;
  original_filename: string;
  stored_filename: string;
  uploaded_at: string;
  page_count: number | null;
}

export interface ProjectSummary {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  template_filename: string;
  paper_count: number;
  run_count: number;
}

export interface ProjectDetail extends ProjectSummary {
  template_schema: TemplateSchema;
  papers: PaperRecord[];
}

export interface LLMSettings {
  provider: Provider;
  model: string;
  temperature: number;
  mock_mode: boolean;
}

export interface PaperExtractionResult {
  paper_id: string;
  paper_filename: string;
  sequence_number: number;
  status: PaperStatus;
  extracted_text_char_count: number;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  confidence: string | null;
  validation_warnings: string[];
  normalized_output: Record<string, Record<string, string>>;
  llm_raw_output: string | null;
  error: string | null;
}

export interface RunSummary {
  id: string;
  version_number: number;
  parent_run_id: string | null;
  label: string;
  created_at: string;
  updated_at: string;
  status: RunStatus;
  llm_settings: LLMSettings;
  completed_papers: number;
  failed_papers: number;
  total_papers: number;
  workbook_download_url: string | null;
}

export interface RunDetail extends RunSummary {
  system_prompt: string;
  analyst_instructions: string;
  template_filename_snapshot: string;
  template_schema_snapshot: TemplateSchema;
  papers_snapshot: PaperRecord[];
  paper_results: PaperExtractionResult[];
  error: string | null;
}

export interface RunCreatePayload {
  parent_run_id?: string;
  provider: Provider;
  model?: string;
  api_key?: string;
  temperature: number;
  label?: string;
  system_prompt: string;
  analyst_instructions: string;
  retained_paper_ids?: string[] | null;
  template_schema?: TemplateSchema | null;
}
