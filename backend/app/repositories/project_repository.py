from sqlalchemy.orm import Session

from app.models.project import Project


class ProjectRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def create(self, project: Project) -> Project:
        self._session.add(project)
        self._session.commit()
        self._session.refresh(project)
        return project

    def get_by_id(self, project_id: int) -> Project | None:
        return self._session.get(Project, project_id)

    def get_all(self) -> list[Project]:
        return self._session.query(Project).all()

    def update(self, project: Project) -> Project:
        self._session.commit()
        self._session.refresh(project)
        return project

    def delete(self, project: Project) -> None:
        self._session.delete(project)
        self._session.commit()