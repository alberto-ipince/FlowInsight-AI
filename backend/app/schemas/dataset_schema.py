from datetime import datetime

from pydantic import BaseModel, ConfigDict


class DatasetCreate(BaseModel):
    name: str
    original_filename: str
    file_path: str
    file_size: int
    file_type: str


class DatasetUpdate(BaseModel):
    name: str | None = None
    original_filename: str | None = None
    file_path: str | None = None
    file_size: int | None = None
    file_type: str | None = None


class DatasetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    original_filename: str
    file_path: str
    file_size: int
    file_type: str
    created_at: datetime