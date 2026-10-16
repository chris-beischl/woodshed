from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from woodshed_api.deps import DbDep, ManifestDep, NowDep
from woodshed_api.models import CardRow, LessonProgress
from woodshed_api.schemas import LessonCompleteOut

router = APIRouter()


@router.post("/lessons/{lesson_id}/complete", response_model=LessonCompleteOut)
def complete_lesson(
    lesson_id: str, db: DbDep, manifest: ManifestDep, now: NowDep
) -> LessonCompleteOut:
    lesson = manifest.lesson(lesson_id)
    if lesson is None:
        raise HTTPException(404, f"Unknown lesson: {lesson_id}")
    existing = set(db.scalars(select(CardRow.id)))
    created = 0
    for template_id in lesson.introduces:
        template = manifest.template(template_id)
        if template is None or template.deprecated:
            continue
        for key in template.keys:
            card_id = f"{template.id}@{key}"
            if card_id in existing:
                continue
            db.add(
                CardRow(
                    id=card_id,
                    template_id=template.id,
                    key=key,
                    variant=None,
                    fsrs_state=None,
                    due=None,
                    introduced_at=now,
                    suspended=False,
                )
            )
            existing.add(card_id)
            created += 1
    if db.get(LessonProgress, lesson_id) is None:
        db.add(LessonProgress(lesson_id=lesson_id, completed_at=now))
    db.commit()
    return LessonCompleteOut(lesson_id=lesson_id, cards_created=created)
