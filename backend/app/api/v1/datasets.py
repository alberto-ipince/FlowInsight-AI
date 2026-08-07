from collections.abc import Generator
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database.session import SessionLocal
from app.models.dataset import Dataset
from app.repositories.dataset_repository import DatasetRepository
from app.schemas.dataset_schema import (
    DatasetCreate,
    DatasetResponse,
    DatasetUpdate,
)
from app.schemas.pipeline_schema import PipelineRequest, PipelineResponse
from app.services.analytics_service import AnalyticsService
from app.services.dataset_reader_service import DatasetReaderService
from app.services.dataset_service import DatasetService
from app.services.etl_pipeline_service import ETLPipelineService
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


@router.post("/{dataset_id}/pipeline", response_model=PipelineResponse)
def run_dataset_pipeline(
    dataset_id: int,
    payload: PipelineRequest,
    service: DatasetService = Depends(get_dataset_service),
) -> PipelineResponse:
    dataset = service.get_by_id(dataset_id)
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    reader = DatasetReaderService()
    df = reader.read(dataset.file_path)
    original_rows = len(df)

    pipeline = ETLPipelineService()
    steps_dicts = [step.model_dump() for step in payload.steps]
    result_df = pipeline.run_pipeline(df, steps_dicts)

    # Export cleaned DataFrame
    original_path = Path(dataset.file_path)
    clean_name = f"{original_path.stem}_clean{original_path.suffix}"
    clean_path = f"app/uploads/{clean_name}"
    pipeline.export_dataframe(result_df, clean_path)

    # Update dataset record
    dataset.file_path = clean_path
    dataset.file_size = clean_path and Path(clean_path).stat().st_size or dataset.file_size
    service.update(dataset)

    return PipelineResponse(
        original_rows=original_rows,
        resulting_rows=len(result_df),
        resulting_columns=len(result_df.columns),
        message=f"Pipeline executed successfully. {original_rows} → {len(result_df)} rows.",
    )


@router.get("/{dataset_id}/download")
def download_dataset(
    dataset_id: int,
    service: DatasetService = Depends(get_dataset_service),
) -> FileResponse:
    dataset = service.get_by_id(dataset_id)
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    file_path = Path(dataset.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(
        path=str(file_path),
        filename=dataset.original_filename,
        media_type="application/octet-stream",
    )


@router.get("/{dataset_id}/analytics")
def get_dataset_analytics(
    dataset_id: int,
    service: DatasetService = Depends(get_dataset_service),
) -> dict:
    dataset = service.get_by_id(dataset_id)
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    analytics = AnalyticsService()
    return analytics.analyze(dataset.file_path)


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