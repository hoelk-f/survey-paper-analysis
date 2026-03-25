from pydantic import BaseModel


class OpenAIModelsRequest(BaseModel):
    api_key: str


class OpenAIModelsResponse(BaseModel):
    models: list[str]
