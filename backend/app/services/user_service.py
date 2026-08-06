from app.models.user import User
from app.repositories.user_repository import UserRepository


class UserService:
    def __init__(self, repository: UserRepository) -> None:
        self._repository = repository

    def create(self, user: User) -> User:
        return self._repository.create(user)

    def get_by_id(self, user_id: int) -> User | None:
        return self._repository.get_by_id(user_id)

    def get_by_email(self, email: str) -> User | None:
        return self._repository.get_by_email(email)

    def get_all(self) -> list[User]:
        return self._repository.get_all()

    def delete(self, user: User) -> None:
        self._repository.delete(user)