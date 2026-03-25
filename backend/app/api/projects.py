from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import ValidationError

from app.schemas.project import ProjectDetail, ProjectSummary, TemplateSchema
from app.services.project_service import ProjectService, get_project_service

router = APIRouter()


@router.get("", response_model=list[ProjectSummary])
def list_projects(project_service: ProjectService = Depends(get_project_service)) -> list[ProjectSummary]:
    return project_service.list_projects()


@router.post("", response_model=ProjectDetail, status_code=status.HTTP_201_CREATED)
async def create_project(
    name: str | None = Form(default=None),
    template: UploadFile = File(...),
    papers: list[UploadFile] = File(...),
    template_guidance: str | None = Form(default=None),
    project_service: ProjectService = Depends(get_project_service),
) -> ProjectDetail:
    if not papers:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one PDF is required.")
    try:
        parsed_guidance = TemplateSchema.model_validate_json(template_guidance) if template_guidance else None
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid template guidance payload: {exc}") from exc
    project = await project_service.create_project(name=name, template=template, papers=papers)
    if parsed_guidance:
        return project_service.update_template_guidance(project.id, parsed_guidance)
    return project


@router.post("/template-preview", response_model=TemplateSchema)
async def preview_template(
    template: UploadFile = File(...),
    project_service: ProjectService = Depends(get_project_service),
) -> TemplateSchema:
    return await project_service.preview_template(template)


@router.get("/{project_id}", response_model=ProjectDetail)
def get_project(
    project_id: str,
    project_service: ProjectService = Depends(get_project_service),
) -> ProjectDetail:
    return project_service.get_project_detail(project_id)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: str,
    project_service: ProjectService = Depends(get_project_service),
) -> None:
    project_service.delete_project(project_id)


@router.put("/{project_id}/template-guidance", response_model=ProjectDetail)
def update_template_guidance(
    project_id: str,
    template_schema: TemplateSchema,
    project_service: ProjectService = Depends(get_project_service),
) -> ProjectDetail:
    return project_service.update_template_guidance(project_id=project_id, template_schema=template_schema)


@router.post("/{project_id}/papers", response_model=ProjectDetail)
async def add_papers(
    project_id: str,
    papers: list[UploadFile] = File(...),
    project_service: ProjectService = Depends(get_project_service),
) -> ProjectDetail:
    if not papers:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one PDF is required.")
    return await project_service.add_papers(project_id=project_id, papers=papers)


@router.delete("/{project_id}/papers/{paper_id}", response_model=ProjectDetail)
def delete_paper(
    project_id: str,
    paper_id: str,
    project_service: ProjectService = Depends(get_project_service),
) -> ProjectDetail:
    return project_service.delete_paper(project_id=project_id, paper_id=paper_id)


@router.post("/{project_id}/template", response_model=ProjectDetail)
async def replace_template(
    project_id: str,
    template: UploadFile = File(...),
    project_service: ProjectService = Depends(get_project_service),
) -> ProjectDetail:
    return await project_service.replace_template(project_id=project_id, template=template)
