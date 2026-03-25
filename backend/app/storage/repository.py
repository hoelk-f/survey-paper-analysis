from datetime import datetime, timezone
from pathlib import Path
from shutil import copy2, rmtree
from typing import Iterable
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status

from app.core.config import get_settings
from app.schemas.project import ProjectRecord
from app.schemas.run import RunRecord


class Repository:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.projects_root = self.settings.data_dir / "projects"
        self.projects_root.mkdir(parents=True, exist_ok=True)

    def list_projects(self) -> list[ProjectRecord]:
        projects: list[ProjectRecord] = []
        for project_file in self.projects_root.glob("*/project.json"):
            projects.append(ProjectRecord.model_validate_json(project_file.read_text(encoding="utf-8")))
        return sorted(projects, key=lambda item: item.updated_at, reverse=True)

    def save_project(self, project: ProjectRecord) -> None:
        project_dir = self.get_project_dir(project.id)
        project_dir.mkdir(parents=True, exist_ok=True)
        (project_dir / "project.json").write_text(project.model_dump_json(indent=2), encoding="utf-8")

    def get_project(self, project_id: str) -> ProjectRecord:
        project_path = self.get_project_dir(project_id) / "project.json"
        if not project_path.exists():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")
        return ProjectRecord.model_validate_json(project_path.read_text(encoding="utf-8"))

    def delete_project(self, project_id: str) -> None:
        project_dir = self.get_project_dir(project_id)
        if not project_dir.exists():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

        resolved_root = self.projects_root.resolve()
        resolved_project_dir = project_dir.resolve()
        try:
            resolved_project_dir.relative_to(resolved_root)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid project path.") from exc

        rmtree(resolved_project_dir)

    def list_runs(self, project_id: str) -> list[RunRecord]:
        run_dir = self.get_runs_dir(project_id)
        if not run_dir.exists():
            return []
        runs = [RunRecord.model_validate_json(path.read_text(encoding="utf-8")) for path in run_dir.glob("*.json")]
        return sorted(runs, key=lambda item: item.version_number)

    def save_run(self, run: RunRecord) -> None:
        run_dir = self.get_runs_dir(run.project_id)
        run_dir.mkdir(parents=True, exist_ok=True)
        (run_dir / f"{run.id}.json").write_text(run.model_dump_json(indent=2), encoding="utf-8")

    def get_run(self, project_id: str, run_id: str) -> RunRecord:
        run_path = self.get_runs_dir(project_id) / f"{run_id}.json"
        if not run_path.exists():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found.")
        return RunRecord.model_validate_json(run_path.read_text(encoding="utf-8"))

    def delete_run(self, project_id: str, run_id: str) -> None:
        run_path = self.get_runs_dir(project_id) / f"{run_id}.json"
        if not run_path.exists():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found.")
        run_path.unlink()
        self.delete_directory(self.get_run_assets_dir(project_id, run_id))

    def delete_file(self, path: Path) -> None:
        if path.exists():
            path.unlink()

    def delete_directory(self, path: Path) -> None:
        if path.exists():
            rmtree(path)

    def copy_file(self, source: Path, destination: Path) -> None:
        destination.parent.mkdir(parents=True, exist_ok=True)
        copy2(source, destination)

    async def save_upload(self, destination: Path, upload: UploadFile) -> None:
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(await upload.read())

    def get_project_dir(self, project_id: str) -> Path:
        return self.projects_root / project_id

    def get_template_dir(self, project_id: str) -> Path:
        return self.get_project_dir(project_id) / "template"

    def get_papers_dir(self, project_id: str) -> Path:
        return self.get_project_dir(project_id) / "papers"

    def get_runs_dir(self, project_id: str) -> Path:
        return self.get_project_dir(project_id) / "runs"

    def get_run_assets_dir(self, project_id: str, run_id: str) -> Path:
        return self.get_project_dir(project_id) / "run_assets" / run_id

    def get_run_template_dir(self, project_id: str, run_id: str) -> Path:
        return self.get_run_assets_dir(project_id, run_id) / "template"

    def get_run_papers_dir(self, project_id: str, run_id: str) -> Path:
        return self.get_run_assets_dir(project_id, run_id) / "papers"

    def build_stored_filename(self, original_name: str) -> str:
        safe_name = "".join(ch if ch.isalnum() or ch in {".", "-", "_"} else "_" for ch in original_name)
        return f"{uuid4().hex}_{safe_name}"

    def template_path(self, project_id: str, stored_filename: str) -> Path:
        return self.get_template_dir(project_id) / stored_filename

    def paper_path(self, project_id: str, stored_filename: str) -> Path:
        return self.get_papers_dir(project_id) / stored_filename

    def run_template_path(self, project_id: str, run_id: str, stored_filename: str) -> Path:
        return self.get_run_template_dir(project_id, run_id) / stored_filename

    def run_paper_path(self, project_id: str, run_id: str, stored_filename: str) -> Path:
        return self.get_run_papers_dir(project_id, run_id) / stored_filename

    def workbook_path(self, project_id: str, workbook_filename: str) -> Path:
        return self.get_runs_dir(project_id) / workbook_filename

    def now(self) -> datetime:
        return datetime.now(timezone.utc)

    def ensure_suffix(self, filename: str, allowed_suffixes: Iterable[str], kind: str) -> None:
        suffix = Path(filename).suffix.lower()
        if suffix not in allowed_suffixes:
            allowed_text = ", ".join(sorted(allowed_suffixes))
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{kind} must use one of these extensions: {allowed_text}.",
            )


_repository = Repository()


def get_repository() -> Repository:
    return _repository
