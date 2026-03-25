import tempfile
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status

from app.models.enums import RunStatus
from app.schemas.project import PaperRecord, ProjectDetail, ProjectRecord, ProjectSummary, TemplateSchema
from app.services.pdf_service import PdfService, get_pdf_service
from app.services.template_service import TemplateService, get_template_service
from app.storage.repository import Repository, get_repository


class ProjectService:
    def __init__(
        self,
        repository: Repository,
        template_service: TemplateService,
        pdf_service: PdfService,
    ) -> None:
        self.repository = repository
        self.template_service = template_service
        self.pdf_service = pdf_service

    def list_projects(self) -> list[ProjectSummary]:
        return [self._to_summary(project) for project in self.repository.list_projects()]

    async def create_project(
        self,
        name: str | None,
        template: UploadFile,
        papers: list[UploadFile],
    ) -> ProjectDetail:
        self.repository.ensure_suffix(template.filename or "", {".xlsx", ".xlsm"}, "Template")
        for paper in papers:
            self.repository.ensure_suffix(paper.filename or "", {".pdf"}, "Paper")

        project_id = uuid4().hex
        template_stored_filename = self.repository.build_stored_filename(template.filename or "template.xlsx")
        template_path = self.repository.template_path(project_id, template_stored_filename)
        await self.repository.save_upload(template_path, template)

        try:
            template_schema = self.template_service.parse_template_schema(
                template_path=template_path,
                workbook_filename=template.filename or "template.xlsx",
            )
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to read the Excel template: {exc}",
            ) from exc
        template_schema = self.template_service.apply_template_guidance(template_schema, None)

        now = self.repository.now()
        project = ProjectRecord(
            id=project_id,
            name=(name or Path(template.filename or "Survey Project").stem).strip() or "Survey Project",
            created_at=now,
            updated_at=now,
            template_filename=template.filename or "template.xlsx",
            template_stored_filename=template_stored_filename,
            template_schema=template_schema,
            papers=await self._store_papers(project_id, papers),
        )
        self.repository.save_project(project)
        return self.get_project_detail(project.id)

    async def preview_template(self, template: UploadFile) -> TemplateSchema:
        self.repository.ensure_suffix(template.filename or "", {".xlsx", ".xlsm"}, "Template")

        suffix = Path(template.filename or "template.xlsx").suffix or ".xlsx"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_path = Path(temp_file.name)
            temp_file.write(await template.read())

        try:
            return self.template_service.parse_template_schema(
                template_path=temp_path,
                workbook_filename=template.filename or "template.xlsx",
            )
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to read the Excel template: {exc}",
            ) from exc
        finally:
            self.repository.delete_file(temp_path)

    async def add_papers(self, project_id: str, papers: list[UploadFile]) -> ProjectDetail:
        project = self.repository.get_project(project_id)
        for paper in papers:
            self.repository.ensure_suffix(paper.filename or "", {".pdf"}, "Paper")

        project.papers.extend(await self._store_papers(project_id, papers))
        project.updated_at = self.repository.now()
        self.repository.save_project(project)
        return self.get_project_detail(project_id)

    def update_template_guidance(self, project_id: str, template_schema: TemplateSchema) -> ProjectDetail:
        project = self.repository.get_project(project_id)
        project.template_schema = self.template_service.apply_template_guidance(project.template_schema, template_schema)
        project.updated_at = self.repository.now()
        self.repository.save_project(project)
        return self.get_project_detail(project_id)

    def delete_paper(self, project_id: str, paper_id: str) -> ProjectDetail:
        project = self.repository.get_project(project_id)
        if any(run.status in {RunStatus.PENDING, RunStatus.RUNNING} for run in self.repository.list_runs(project_id)):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="PDFs cannot be changed while a version is running.",
            )

        paper = next((item for item in project.papers if item.id == paper_id), None)
        if not paper:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paper not found.")

        project.papers = [item for item in project.papers if item.id != paper_id]
        project.updated_at = self.repository.now()
        self.repository.save_project(project)
        self.repository.delete_file(self.repository.paper_path(project_id, paper.stored_filename))
        return self.get_project_detail(project_id)

    async def replace_template(self, project_id: str, template: UploadFile) -> ProjectDetail:
        project = self.repository.get_project(project_id)
        self.repository.ensure_suffix(template.filename or "", {".xlsx", ".xlsm"}, "Template")

        stored_filename = self.repository.build_stored_filename(template.filename or "template.xlsx")
        template_path = self.repository.template_path(project_id, stored_filename)
        await self.repository.save_upload(template_path, template)

        try:
            schema = self.template_service.parse_template_schema(
                template_path=template_path,
                workbook_filename=template.filename or "template.xlsx",
            )
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to read the Excel template: {exc}",
            ) from exc
        schema = self.template_service.apply_template_guidance(schema, project.template_schema)

        project.template_filename = template.filename or "template.xlsx"
        project.template_stored_filename = stored_filename
        project.template_schema = schema
        project.updated_at = self.repository.now()
        self.repository.save_project(project)
        return self.get_project_detail(project_id)

    def get_project_detail(self, project_id: str) -> ProjectDetail:
        project = self.repository.get_project(project_id)
        summary = self._to_summary(project, run_count=len(self.repository.list_runs(project.id)))
        return ProjectDetail(
            **summary.model_dump(),
            template_schema=project.template_schema,
            papers=project.papers,
        )

    def delete_project(self, project_id: str) -> None:
        if any(run.status in {RunStatus.PENDING, RunStatus.RUNNING} for run in self.repository.list_runs(project_id)):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Projects cannot be deleted while a version is running.",
            )
        self.repository.delete_project(project_id)

    async def _store_papers(self, project_id: str, papers: list[UploadFile]) -> list[PaperRecord]:
        stored_papers: list[PaperRecord] = []
        for paper in papers:
            stored_filename = self.repository.build_stored_filename(paper.filename or "paper.pdf")
            destination = self.repository.paper_path(project_id, stored_filename)
            await self.repository.save_upload(destination, paper)
            page_count = self.pdf_service.get_page_count(destination)
            stored_papers.append(
                PaperRecord(
                    id=uuid4().hex,
                    original_filename=paper.filename or stored_filename,
                    stored_filename=stored_filename,
                    uploaded_at=self.repository.now(),
                    page_count=page_count,
                )
            )
        return stored_papers

    def _to_summary(self, project: ProjectRecord, run_count: int | None = None) -> ProjectSummary:
        return ProjectSummary(
            id=project.id,
            name=project.name,
            created_at=project.created_at,
            updated_at=project.updated_at,
            template_filename=project.template_filename,
            paper_count=len(project.papers),
            run_count=run_count if run_count is not None else len(self.repository.list_runs(project.id)),
        )


_project_service = ProjectService(get_repository(), get_template_service(), get_pdf_service())


def get_project_service() -> ProjectService:
    return _project_service
