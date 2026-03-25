from datetime import datetime

from pydantic import BaseModel, Field


class ColumnSchema(BaseModel):
    name: str
    column_index: int
    excel_column: str
    description: str = ""


class SheetSchema(BaseModel):
    name: str
    header_row_index: int
    data_start_row_index: int
    columns: list[ColumnSchema] = Field(default_factory=list)


class TemplateSchema(BaseModel):
    workbook_filename: str
    sheets: list[SheetSchema] = Field(default_factory=list)


class PaperRecord(BaseModel):
    id: str
    original_filename: str
    stored_filename: str
    uploaded_at: datetime
    page_count: int | None = None


class ProjectRecord(BaseModel):
    id: str
    name: str
    created_at: datetime
    updated_at: datetime
    template_filename: str
    template_stored_filename: str
    template_schema: TemplateSchema
    papers: list[PaperRecord] = Field(default_factory=list)


class ProjectSummary(BaseModel):
    id: str
    name: str
    created_at: datetime
    updated_at: datetime
    template_filename: str
    paper_count: int
    run_count: int


class ProjectDetail(ProjectSummary):
    template_schema: TemplateSchema
    papers: list[PaperRecord] = Field(default_factory=list)
