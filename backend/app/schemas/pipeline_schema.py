from pydantic import BaseModel


class PipelineStep(BaseModel):
    operation: str
    params: dict = {}


class PipelineRequest(BaseModel):
    steps: list[PipelineStep]


class PipelineResponse(BaseModel):
    original_rows: int
    resulting_rows: int
    resulting_columns: int
    message: str


class PipelinePreviewResponse(BaseModel):
    original_rows: int
    resulting_rows: int
    removed_rows: int
    operations: list[str]
