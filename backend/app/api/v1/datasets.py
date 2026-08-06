from collections.abc import Generator
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from sqlalchemy.orm import Session

from app.database.session import SessionLocal
from app.models.dataset import Dataset
from app.repositories.dataset_repository import DatasetRepository
from app.schemas.dataset_schema import (
    DatasetCreate,
    DatasetResponse,
    DatasetUpdate,
)
from app.services.dataset_reader_service import DatasetReaderService
from app.services.dataset_service import DatasetService
from app.services.file_storage_service import FileStorageService

router = APIRouter(prefix="/datasets", tags=["Datasets"])


def get_session() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def get_dataset_service(
    session: Session = Depends(get_session),
) -> DatasetService:
    repository = DatasetRepository(session)
    return DatasetService(repository)


@router.post("/upload", response_model=DatasetResponse, status_code=201)
def upload_file(
    file: UploadFile = File(...),
    service: DatasetService = Depends(get_dataset_service),
) -> Dataset:
    storage = FileStorageService()
    stored_path = storage.save_file(file)

    original_name = file.filename or ""
    name = Path(original_name).stem
    extension = Path(original_name).suffix.lstrip(".")
    file_size = file.size or 0

    dataset = Dataset(
        name=name,
        original_filename=original_name,
        file_path=stored_path,
        file_size=file_size,
        file_type=extension,
    )
    return service.create(dataset)


@router.get("/", response_model=list[DatasetResponse])
def list_datasets(
    service: DatasetService = Depends(get_dataset_service),
) -> list[Dataset]:
    return service.get_all()


@router.get("/{dataset_id}", response_model=DatasetResponse)
def get_dataset(
    dataset_id: int,
    service: DatasetService = Depends(get_dataset_service),
) -> Dataset:
    dataset = service.get_by_id(dataset_id)
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return dataset


@router.get("/{dataset_id}/profile")
def get_dataset_profile(
    dataset_id: int,
    service: DatasetService = Depends(get_dataset_service),
) -> dict:
    dataset = service.get_by_id(dataset_id)
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    reader = DatasetReaderService()
    return reader.profile(dataset.file_path)


@router.get("/{dataset_id}/quality")
def get_dataset_quality(
    dataset_id: int,
    service: DatasetService = Depends(get_dataset_service),
) -> dict:
    dataset = service.get_by_id(dataset_id)
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    reader = DatasetReaderService()
    return reader.evaluate_quality(dataset.file_path)


@router.post("/", response_model=DatasetResponse, status_code=201)
def create_dataset(
    payload: DatasetCreate,
    service: DatasetService = Depends(get_dataset_service),
) -> Dataset:
    dataset = Dataset(
        name=payload.name,
        original_filename=payload.original_filename,
        file_path=payload.file_path,
        file_size=payload.file_size,
        file_type=payload.file_type,
    )
    return service.create(dataset)


@router.put("/{dataset_id}", response_model=DatasetResponse)
def update_dataset(
    dataset_id: int,
    payload: DatasetUpdate,
    service: DatasetService = Depends(get_dataset_service),
) -> Dataset:
    dataset = service.get_by_id(dataset_id)
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(dataset, field, value)
    return service.update(dataset)


@router.delete("/{dataset_id}", status_code=204)
def delete_dataset(
    dataset_id: int,
    service: DatasetService = Depends(get_dataset_service),
) -> Response:
    dataset = service.get_by_id(dataset_id)
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    service.delete(dataset)
    return Response(status_code=204)