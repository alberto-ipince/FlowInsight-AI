from app.models.dataset import Dataset
from app.repositories.dataset_repository import DatasetRepository


class DatasetService:
    def __init__(self, repository: DatasetRepository) -> None:
        self._repository = repository

    def create(self, dataset: Dataset) -> Dataset:
        return self._repository.create(dataset)

    def get_by_id(self, dataset_id: int) -> Dataset | None:
        return self._repository.get_by_id(dataset_id)

    def get_all(self) -> list[Dataset]:
        return self._repository.get_all()

    def get_recent(self, limit: int = 50) -> list[Dataset]:
        return self._repository.get_recent(limit)

    def update(self, dataset: Dataset) -> Dataset:
        return self._repository.update(dataset)

    def delete(self, dataset: Dataset) -> None:
        self._repository.delete(dataset)