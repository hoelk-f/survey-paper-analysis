from pydantic import BaseModel

from app.models.enums import LLMProvider


class LLMModelsRequest(BaseModel):
    provider: LLMProvider
    api_key: str | None = None


class LLMModelsResponse(BaseModel):
    models: list[str]
