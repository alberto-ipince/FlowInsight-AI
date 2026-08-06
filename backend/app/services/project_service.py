from app.models.project import Project
from app.repositories.project_repository import ProjectRepository


class ProjectService:
    def __init__(self, repository: ProjectRepository) -> None:
        self._repository = repository

    def create(self, project: Project) -> Project:
        return self._repository.create(project)

    def get_by_id(self, project_id: int) -> Project | None:
        return self._repository.get_by_id(project_id)

    def get_all(self) -> list[Project]:
        return self._repository.get_all()

    def update(self, project: Project) -> Project:
        return self._repository.update(project)

    def delete(self, project: Project) -> None:
        self._repository.delete(project)