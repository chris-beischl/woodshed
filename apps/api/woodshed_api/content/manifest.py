"""Manifest loading. Covers only the fields the backend uses; extras are ignored."""

from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field


class Template(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    id: str
    mode: str | None = None
    importance: int
    estimated_seconds: float = Field(alias="estimatedSeconds")
    keys: list[str]
    deprecated: bool = False


class Lesson(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    id: str
    order: int
    title: str
    estimated_minutes: float = Field(alias="estimatedMinutes")
    introduces: list[str] = []
    prerequisites: list[str] = []
    hidden: bool = False
    unit: int | None = None


class Manifest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    version: str
    templates: list[Template]
    lessons: list[Lesson]

    def template(self, template_id: str) -> Template | None:
        return next((t for t in self.templates if t.id == template_id), None)

    def lesson(self, lesson_id: str) -> Lesson | None:
        return next((x for x in self.lessons if x.id == lesson_id), None)


def load_manifest(path: Path) -> Manifest:
    return Manifest.model_validate_json(path.read_text(encoding="utf-8"))
