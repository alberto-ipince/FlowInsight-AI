import shutil
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile

UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"


class FileStorageService:
    def save_file(self, file: UploadFile) -> str:
        extension = Path(file.filename or "").suffix
        unique_name = f"{uuid4()}{extension}"
        destination = UPLOAD_DIR / unique_name

        with destination.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        return str(Path("app/uploads") / unique_name)