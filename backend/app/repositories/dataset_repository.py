from sqlalchemy.orm import Session

from app.models.dataset import Dataset


class DatasetRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def create(self, dataset: Dataset) -> Dataset:
        self._session.add(dataset)
        self._session.commit()
        self._session.refresh(dataset)
        return dataset

    def get_by_id(self, dataset_id: int) -> Dataset | None:
        return self._session.get(Dataset, dataset_id)

    def get_all(self) -> list[Dataset]:
        return self._session.query(Dataset).all()

    def update(self, dataset: Dataset) -> Dataset:
        self._session.commit()
        self._session.refresh(dataset)
        return dataset

    def delete(self, dataset: Dataset) -> None:
        self._session.delete(dataset)
        self._session.commit()