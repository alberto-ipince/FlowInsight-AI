from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.session import SessionLocal
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.user_schema import UserCreate, UserResponse, UserUpdate
from app.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["Users"])


def get_session() -> Session:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def get_user_service(session: Session = Depends(get_session)) -> UserService:
    repository = UserRepository(session)
    return UserService(repository)


@router.get("/", response_model=list[UserResponse])
def list_users(service: UserService = Depends(get_user_service)) -> list[User]:
    return service.get_all()


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int, service: UserService = Depends(get_user_service)
) -> User | None:
    return service.get_by_id(user_id)


@router.post("/", response_model=UserResponse, status_code=201)
def create_user(
    payload: UserCreate, service: UserService = Depends(get_user_service)
) -> User:
    user = User(name=payload.name, email=payload.email)
    return service.create(user)


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    payload: UserUpdate,
    service: UserService = Depends(get_user_service),
) -> User:
    user = service.get_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)
    return service.update(user)
