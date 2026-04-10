from enum import Enum


class LLMProvider(str, Enum):
    OPENAI = "openai"
    KI4BUW = "ki4buw"
    ANTHROPIC = "anthropic"
    MOCK = "mock"


class RunStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    COMPLETED_WITH_ERRORS = "completed_with_errors"
    FAILED = "failed"


class PaperResultStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
