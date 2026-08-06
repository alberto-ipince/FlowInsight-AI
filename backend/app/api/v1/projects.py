from collections.abc import Generator

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.database.session import SessionLocal
from app.models.project import Project
from app.repositories.project_repository import ProjectRepository
from app.schemas.project_schema import ProjectCreate, ProjectResponse, ProjectUpdate
from app.services.project_service import ProjectService

router = APIRouter(prefix="/projects", tags=["Projects"])


def get_session() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def get_project_service(
    session: Session = Depends(get_session),
) -> ProjectService:
    repository = ProjectRepository(session)
    return ProjectService(repository)


@router.get("/", response_model=list[ProjectResponse])
def list_projects(
    service: ProjectService = Depends(get_project_service),
) -> list[Project]:
    return service.get_all()


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: int,
    service: ProjectService = Depends(get_project_service),
) -> Project:
    project = service.get_by_id(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.post("/", response_model=ProjectResponse, status_code=201)
def create_project(
    payload: ProjectCreate,
    service: ProjectService = Depends(get_project_service),
) -> Project:
    project = Project(name=payload.name, description=payload.description)
    return service.create(project)


@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int,
    payload: ProjectUpdate,
    service: ProjectService = Depends(get_project_service),
) -> Project:
    project = service.get_by_id(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(project, field, value)
    return service.update(project)


@router.delete("/{project_id}", status_code=204)
def delete_project(
    project_id: int,
    service: ProjectService = Depends(get_project_service),
) -> Response:
    project = service.get_by_id(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    service.delete(project)
    return Response(status_code=204)