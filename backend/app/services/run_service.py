import asyncio
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status

from app.core.config import get_settings
from app.models.enums import PaperResultStatus, RunStatus
from app.schemas.project import PaperRecord, ProjectRecord, TemplateSchema
from app.schemas.run import LLMSettings, PaperExtractionResult, RunCreateRequest, RunDetail, RunRecord, RunSummary
from app.services.llm_service import LLMService, get_llm_service
from app.services.pdf_service import PdfService, get_pdf_service
from app.services.template_service import TemplateService, get_template_service
from app.storage.repository import Repository, get_repository


class RunService:
    def __init__(
        self,
        repository: Repository,
        pdf_service: PdfService,
        template_service: TemplateService,
        llm_service: LLMService,
    ) -> None:
        self.repository = repository
        self.pdf_service = pdf_service
        self.template_service = template_service
        self.llm_service = llm_service
        self.settings = get_settings()
        self.tasks: dict[str, asyncio.Task] = {}

    def list_runs(self, project_id: str) -> list[RunSummary]:
        return [self._to_summary(project_id, run) for run in self.repository.list_runs(project_id)]

    def get_run_detail(self, project_id: str, run_id: str) -> RunDetail:
        project = self.repository.get_project(project_id)
        run = self.repository.get_run(project_id, run_id)
        effective_template_schema = run.template_schema_snapshot if run.template_schema_snapshot.sheets else project.template_schema
        effective_papers = self._get_effective_papers_snapshot(project, run)
        summary = self._to_summary(project_id, run)
        return RunDetail(
            **summary.model_dump(),
            system_prompt=run.system_prompt,
            analyst_instructions=run.analyst_instructions,
            template_filename_snapshot=run.template_filename_snapshot or project.template_filename,
            template_schema_snapshot=effective_template_schema,
            papers_snapshot=effective_papers,
            paper_results=run.paper_results,
            error=run.error,
        )

    def get_workbook_path(self, project_id: str, run_id: str) -> Path:
        run = self.repository.get_run(project_id, run_id)
        if not run.workbook_filename:
            raise FileNotFoundError("Workbook file is not available yet.")
        return self.repository.workbook_path(project_id, run.workbook_filename)

    def delete_run(self, project_id: str, run_id: str) -> None:
        run = self.repository.get_run(project_id, run_id)
        if run.status in {RunStatus.PENDING, RunStatus.RUNNING}:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Active versions cannot be deleted.",
            )

        dependent_run = next(
            (item for item in self.repository.list_runs(project_id) if item.parent_run_id == run_id),
            None,
        )
        if dependent_run:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Delete dependent version v{dependent_run.version_number} first.",
            )

        if run.workbook_filename:
            workbook_path = self.repository.workbook_path(project_id, run.workbook_filename)
            self.repository.delete_file(workbook_path)

        self.repository.delete_run(project_id, run_id)

        project = self.repository.get_project(project_id)
        project.updated_at = self.repository.now()
        self.repository.save_project(project)

    async def create_and_start_run(
        self,
        project_id: str,
        payload: RunCreateRequest,
        template: UploadFile | None = None,
        papers: list[UploadFile] | None = None,
    ) -> RunDetail:
        project = self.repository.get_project(project_id)
        papers = papers or []
        parent_run = self.repository.get_run(project_id, payload.parent_run_id) if payload.parent_run_id else None

        base_template_filename = (
            parent_run.template_filename_snapshot
            if parent_run and parent_run.template_filename_snapshot
            else project.template_filename
        )
        base_template_stored_filename = (
            parent_run.template_stored_filename_snapshot
            if parent_run and parent_run.template_stored_filename_snapshot
            else project.template_stored_filename
        )
        base_template_schema = (
            parent_run.template_schema_snapshot
            if parent_run and parent_run.template_schema_snapshot.sheets
            else project.template_schema
        )
        base_papers = (
            self._get_effective_papers_snapshot(project, parent_run)
            if parent_run
            else project.papers
        )

        retained_paper_ids = payload.retained_paper_ids if payload.retained_paper_ids is not None else [paper.id for paper in base_papers]
        paper_map = {paper.id: paper for paper in base_papers}
        unknown_paper_ids = [paper_id for paper_id in retained_paper_ids if paper_id not in paper_map]
        if unknown_paper_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown retained paper(s): {', '.join(unknown_paper_ids)}.",
            )

        existing_runs = self.repository.list_runs(project_id)
        version_number = max((item.version_number for item in existing_runs), default=0) + 1
        run_id = uuid4().hex

        template_source_path = (
            self._get_template_source_path(project, parent_run, base_template_stored_filename)
            if base_template_stored_filename
            else None
        )
        template_stored_filename_snapshot = self.repository.build_stored_filename(
            (template.filename if template else base_template_filename) or "template.xlsx"
        )
        template_asset_path = self.repository.run_template_path(project_id, run_id, template_stored_filename_snapshot)

        if template is not None:
            self.repository.ensure_suffix(template.filename or "", {".xlsx", ".xlsm"}, "Template")
            await self.repository.save_upload(template_asset_path, template)
            parsed_template_schema = self.template_service.parse_template_schema(
                template_path=template_asset_path,
                workbook_filename=template.filename or "template.xlsx",
            )
            template_schema_snapshot = self.template_service.apply_template_guidance(
                parsed_template_schema,
                payload.template_schema or base_template_schema,
            )
            template_filename_snapshot = template.filename or "template.xlsx"
        else:
            if template_source_path is None or not template_source_path.exists():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="A template is required to create a version.",
                )
            self.repository.copy_file(template_source_path, template_asset_path)
            template_schema_snapshot = self.template_service.apply_template_guidance(
                base_template_schema,
                payload.template_schema or base_template_schema,
            )
            template_filename_snapshot = base_template_filename

        papers_snapshot: list[PaperRecord] = []
        for paper_id in retained_paper_ids:
            base_paper = paper_map[paper_id]
            paper_copy = base_paper.model_copy(deep=True)
            source_path = self._get_paper_source_path(project, parent_run, base_paper)
            destination_path = self.repository.run_paper_path(project_id, run_id, paper_copy.stored_filename)
            self.repository.copy_file(source_path, destination_path)
            papers_snapshot.append(paper_copy)

        for paper in papers:
            self.repository.ensure_suffix(paper.filename or "", {".pdf"}, "Paper")
            stored_filename = self.repository.build_stored_filename(paper.filename or "paper.pdf")
            destination = self.repository.run_paper_path(project_id, run_id, stored_filename)
            await self.repository.save_upload(destination, paper)
            page_count = self.pdf_service.get_page_count(destination)
            papers_snapshot.append(
                PaperRecord(
                    id=uuid4().hex,
                    original_filename=paper.filename or stored_filename,
                    stored_filename=stored_filename,
                    uploaded_at=self.repository.now(),
                    page_count=page_count,
                )
            )

        if not papers_snapshot:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one PDF is required to create a version.",
            )

        run = RunRecord(
            id=run_id,
            project_id=project_id,
            version_number=version_number,
            parent_run_id=payload.parent_run_id,
            label=payload.label or f"Version {version_number}",
            created_at=self.repository.now(),
            updated_at=self.repository.now(),
            status=RunStatus.PENDING,
            llm_settings=LLMSettings(
                provider=payload.provider,
                model=payload.model or self.settings.default_model,
                temperature=payload.temperature,
                mock_mode=not bool(payload.api_key),
            ),
            system_prompt=payload.system_prompt.strip(),
            analyst_instructions=payload.analyst_instructions.strip(),
            template_filename_snapshot=template_filename_snapshot,
            template_stored_filename_snapshot=template_stored_filename_snapshot,
            template_schema_snapshot=template_schema_snapshot,
            papers_snapshot=papers_snapshot,
            paper_results=[
                PaperExtractionResult(
                    paper_id=paper.id,
                    paper_filename=paper.original_filename,
                    sequence_number=index + 1,
                )
                for index, paper in enumerate(papers_snapshot)
            ],
        )

        self.repository.save_run(run)
        task = asyncio.create_task(self._execute_run(project, run.id, payload.api_key))
        self.tasks[run.id] = task
        task.add_done_callback(lambda _: self.tasks.pop(run.id, None))
        return self.get_run_detail(project_id, run.id)

    def recover_interrupted_runs(self) -> None:
        for project in self.repository.list_projects():
            runs = self.repository.list_runs(project.id)
            project_changed = False
            for run in runs:
                if run.status in {RunStatus.PENDING, RunStatus.RUNNING}:
                    run.status = RunStatus.FAILED
                    run.error = "Run was interrupted before completion. Start a new version to continue."
                    run.updated_at = self.repository.now()
                    self.repository.save_run(run)
                    project_changed = True
            if project_changed:
                project.updated_at = self.repository.now()
                self.repository.save_project(project)

    async def _execute_run(self, project: ProjectRecord, run_id: str, api_key: str | None) -> None:
        run = self.repository.get_run(project.id, run_id)
        try:
            run.updated_at = self.repository.now()
            run.status = RunStatus.RUNNING
            self.repository.save_run(run)

            had_failures = False
            completed_count = 0

            for index, paper in enumerate(run.papers_snapshot):
                paper_result = run.paper_results[index]
                paper_result.status = PaperResultStatus.RUNNING
                paper_result.started_at = self.repository.now()
                run.updated_at = self.repository.now()
                self.repository.save_run(run)

                try:
                    pdf_path = self._get_run_snapshot_paper_path(project, run, paper)
                    paper_text, page_count = self.pdf_service.extract_text(pdf_path)
                    if paper.page_count != page_count:
                        paper.page_count = page_count
                        run.papers_snapshot[index].page_count = page_count
                        run.updated_at = self.repository.now()
                        self.repository.save_run(run)

                    llm_response = await self.llm_service.extract_structured_data(
                        llm_settings=run.llm_settings,
                        api_key=api_key,
                        template_schema=run.template_schema_snapshot,
                        paper=paper,
                        paper_text=paper_text,
                        system_prompt=run.system_prompt,
                        analyst_instructions=run.analyst_instructions,
                    )

                    paper_result.extracted_text_char_count = len(paper_text)
                    paper_result.llm_raw_output = llm_response["raw_text"]
                    paper_result.normalized_output = llm_response["normalized_output"]
                    paper_result.validation_warnings = llm_response["validation_warnings"]
                    paper_result.notes = llm_response["notes"]
                    paper_result.confidence = llm_response["confidence"]
                    paper_result.status = PaperResultStatus.COMPLETED
                    paper_result.completed_at = self.repository.now()
                    paper_result.error = None
                    completed_count += 1
                except Exception as exc:  # noqa: BLE001
                    had_failures = True
                    paper_result.status = PaperResultStatus.FAILED
                    paper_result.error = str(exc)
                    paper_result.completed_at = self.repository.now()

                run.updated_at = self.repository.now()
                self.repository.save_run(run)

            if completed_count > 0:
                workbook_path = self.template_service.write_run_workbook(project, run)
                run.workbook_filename = workbook_path.name

            if had_failures and completed_count == 0:
                run.status = RunStatus.FAILED
                run.error = "All papers failed during extraction. Review the paper results for details."
            elif had_failures:
                run.status = RunStatus.COMPLETED_WITH_ERRORS
                run.error = "One or more papers failed during extraction. Partial workbook export is available."
            else:
                run.status = RunStatus.COMPLETED
                run.error = None
        except Exception as exc:  # noqa: BLE001
            run.status = RunStatus.FAILED
            run.error = str(exc)

        run.updated_at = self.repository.now()
        self.repository.save_run(run)

        project.updated_at = self.repository.now()
        self.repository.save_project(project)

    def _to_summary(self, project_id: str, run: RunRecord) -> RunSummary:
        completed_papers = sum(1 for item in run.paper_results if item.status == PaperResultStatus.COMPLETED)
        failed_papers = sum(1 for item in run.paper_results if item.status == PaperResultStatus.FAILED)
        workbook_download_url = (
            f"{self.settings.api_prefix}/projects/{project_id}/runs/{run.id}/export"
            if run.workbook_filename
            else None
        )
        return RunSummary(
            id=run.id,
            version_number=run.version_number,
            parent_run_id=run.parent_run_id,
            label=run.label,
            created_at=run.created_at,
            updated_at=run.updated_at,
            status=run.status,
            llm_settings=run.llm_settings,
            completed_papers=completed_papers,
            failed_papers=failed_papers,
            total_papers=len(run.paper_results),
            workbook_download_url=workbook_download_url,
        )

    def _get_template_source_path(
        self,
        project: ProjectRecord,
        parent_run: RunRecord | None,
        stored_filename: str,
    ) -> Path:
        if parent_run and stored_filename:
            run_template_path = self.repository.run_template_path(project.id, parent_run.id, stored_filename)
            if run_template_path.exists():
                return run_template_path
        return self.repository.template_path(project.id, stored_filename or project.template_stored_filename)

    def _get_paper_source_path(
        self,
        project: ProjectRecord,
        parent_run: RunRecord | None,
        paper: PaperRecord,
    ) -> Path:
        if parent_run:
            run_paper_path = self.repository.run_paper_path(project.id, parent_run.id, paper.stored_filename)
            if run_paper_path.exists():
                return run_paper_path
        return self.repository.paper_path(project.id, paper.stored_filename)

    def _get_run_snapshot_paper_path(
        self,
        project: ProjectRecord,
        run: RunRecord,
        paper: PaperRecord,
    ) -> Path:
        run_paper_path = self.repository.run_paper_path(project.id, run.id, paper.stored_filename)
        if run_paper_path.exists():
            return run_paper_path
        return self.repository.paper_path(project.id, paper.stored_filename)

    def _get_effective_papers_snapshot(
        self,
        project: ProjectRecord,
        run: RunRecord | None,
    ) -> list[PaperRecord]:
        if run is None:
            return project.papers
        if run.papers_snapshot:
            return run.papers_snapshot

        project_paper_map = {paper.id: paper for paper in project.papers}
        hydrated_snapshot: list[PaperRecord] = []
        for result in run.paper_results:
            matching_paper = project_paper_map.get(result.paper_id)
            if matching_paper:
                hydrated_snapshot.append(matching_paper.model_copy(deep=True))
            else:
                hydrated_snapshot.append(
                    PaperRecord(
                        id=result.paper_id,
                        original_filename=result.paper_filename,
                        stored_filename=result.paper_filename,
                        uploaded_at=run.created_at,
                        page_count=None,
                    )
                )
        return hydrated_snapshot or project.papers


_run_service = RunService(get_repository(), get_pdf_service(), get_template_service(), get_llm_service())


def get_run_service() -> RunService:
    return _run_service
