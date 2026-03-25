from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import LLMProvider, PaperResultStatus, RunStatus
from app.schemas.project import PaperRecord, TemplateSchema


class LLMSettings(BaseModel):
    provider: LLMProvider = LLMProvider.MOCK
    model: str
    temperature: float = Field(default=0.1, ge=0.0, le=2.0)
    mock_mode: bool = False


class RunCreateRequest(BaseModel):
    parent_run_id: str | None = None
    provider: LLMProvider = LLMProvider.MOCK
    model: str | None = None
    api_key: str | None = None
    temperature: float = Field(default=0.1, ge=0.0, le=2.0)
    label: str | None = None
    system_prompt: str = ""
    analyst_instructions: str = ""
    retained_paper_ids: list[str] | None = None
    template_schema: TemplateSchema | None = None


class PaperExtractionResult(BaseModel):
    paper_id: str
    paper_filename: str
    sequence_number: int
    status: PaperResultStatus = PaperResultStatus.PENDING
    extracted_text_char_count: int = 0
    started_at: datetime | None = None
    completed_at: datetime | None = None
    notes: str | None = None
    confidence: str | None = None
    validation_warnings: list[str] = Field(default_factory=list)
    normalized_output: dict[str, dict[str, str]] = Field(default_factory=dict)
    llm_raw_output: str | None = None
    error: str | None = None


class RunRecord(BaseModel):
    id: str
    project_id: str
    version_number: int
    parent_run_id: str | None = None
    label: str
    created_at: datetime
    updated_at: datetime
    status: RunStatus = RunStatus.PENDING
    llm_settings: LLMSettings
    system_prompt: str = ""
    analyst_instructions: str = ""
    template_filename_snapshot: str = ""
    template_stored_filename_snapshot: str = ""
    template_schema_snapshot: TemplateSchema
    papers_snapshot: list[PaperRecord] = Field(default_factory=list)
    paper_results: list[PaperExtractionResult] = Field(default_factory=list)
    workbook_filename: str | None = None
    error: str | None = None


class RunSummary(BaseModel):
    id: str
    version_number: int
    parent_run_id: str | None = None
    label: str
    created_at: datetime
    updated_at: datetime
    status: RunStatus
    llm_settings: LLMSettings
    completed_papers: int
    failed_papers: int
    total_papers: int
    workbook_download_url: str | None = None


class RunDetail(RunSummary):
    system_prompt: str
    analyst_instructions: str
    template_filename_snapshot: str = ""
    template_schema_snapshot: TemplateSchema
    papers_snapshot: list[PaperRecord] = Field(default_factory=list)
    paper_results: list[PaperExtractionResult] = Field(default_factory=list)
    error: str | None = None
