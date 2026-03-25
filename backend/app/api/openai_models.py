from fastapi import APIRouter, Depends

from app.schemas.openai import OpenAIModelsRequest, OpenAIModelsResponse
from app.services.llm_service import LLMService, get_llm_service

router = APIRouter()


@router.post("/models", response_model=OpenAIModelsResponse)
async def list_openai_models(
    payload: OpenAIModelsRequest,
    llm_service: LLMService = Depends(get_llm_service),
) -> OpenAIModelsResponse:
    models = await llm_service.list_openai_models(payload.api_key)
    return OpenAIModelsResponse(models=models)
