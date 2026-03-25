from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import ValidationError

from app.schemas.run import RunCreateRequest, RunDetail, RunSummary
from app.services.run_service import RunService, get_run_service

router = APIRouter()


@router.get("", response_model=list[RunSummary])
def list_runs(project_id: str, run_service: RunService = Depends(get_run_service)) -> list[RunSummary]:
    return run_service.list_runs(project_id)


@router.post("", response_model=RunDetail, status_code=status.HTTP_201_CREATED)
async def create_run(
    project_id: str,
    payload: str = Form(...),
    template: UploadFile | None = File(default=None),
    papers: list[UploadFile] | None = File(default=None),
    run_service: RunService = Depends(get_run_service),
) -> RunDetail:
    try:
        parsed_payload = RunCreateRequest.model_validate_json(payload)
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid run payload: {exc}") from exc
    return await run_service.create_and_start_run(
        project_id=project_id,
        payload=parsed_payload,
        template=template,
        papers=papers or [],
    )


@router.get("/{run_id}", response_model=RunDetail)
def get_run(project_id: str, run_id: str, run_service: RunService = Depends(get_run_service)) -> RunDetail:
    return run_service.get_run_detail(project_id, run_id)


@router.delete("/{run_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_run(project_id: str, run_id: str, run_service: RunService = Depends(get_run_service)) -> None:
    run_service.delete_run(project_id, run_id)


@router.get("/{run_id}/export")
def export_run(project_id: str, run_id: str, run_service: RunService = Depends(get_run_service)) -> FileResponse:
    run_detail = run_service.get_run_detail(project_id, run_id)
    if not run_detail.workbook_download_url:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Workbook export is not ready for this run.",
        )
    workbook_path = run_service.get_workbook_path(project_id, run_id)
    media_type = (
        "application/vnd.ms-excel.sheet.macroEnabled.12"
        if workbook_path.suffix.lower() == ".xlsm"
        else "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    return FileResponse(
        path=workbook_path,
        filename=workbook_path.name,
        media_type=media_type,
    )
