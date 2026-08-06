from sqlalchemy.orm import Session

from app.models.user import User


class UserRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def create(self, user: User) -> User:
        self._session.add(user)
        self._session.commit()
        self._session.refresh(user)
        return user

    def get_by_id(self, user_id: int) -> User | None:
        return self._session.get(User, user_id)

    def get_by_email(self, email: str) -> User | None:
        return self._session.query(User).filter(User.email == email).first()

    def get_all(self) -> list[User]:
        return self._session.query(User).all()

    def delete(self, user: User) -> None:
        self._session.delete(user)
        self._session.commit()