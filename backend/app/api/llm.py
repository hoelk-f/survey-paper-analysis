from fastapi import APIRouter, Depends, HTTPException, status

from app.schemas.llm import LLMModelsRequest, LLMModelsResponse
from app.services.llm_service import LLMService, get_llm_service

router = APIRouter()


@router.post("/models", response_model=LLMModelsResponse)
async def list_models(
    payload: LLMModelsRequest,
    llm_service: LLMService = Depends(get_llm_service),
) -> LLMModelsResponse:
    try:
        models = await llm_service.list_models(provider=payload.provider, api_key=payload.api_key)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return LLMModelsResponse(models=models)
