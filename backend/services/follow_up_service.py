"""Follow-up date, note, and history helpers for enquiries and quotations."""

from __future__ import annotations

from datetime import date, datetime, timezone


def parse_follow_up_date(raw: object) -> date | None:
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None
    return date.fromisoformat(s[:10])


def parse_follow_up_note(raw: object) -> str | None:
    s = str(raw or "").strip()
    return s if s else None


def normalize_follow_up_history(raw: object) -> list[dict]:
    if not isinstance(raw, list):
        return []
    out: list[dict] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        d = str(item.get("date") or "").strip()
        if not d:
            continue
        out.append(
            {
                "date": d[:10],
                "note": str(item.get("note") or "").strip(),
                "recorded_at": str(item.get("recorded_at") or "").strip() or None,
                "recorded_by_name": str(item.get("recorded_by_name") or "").strip() or None,
            }
        )
    return out


def follow_up_history_payload(raw: object) -> list[dict]:
    return normalize_follow_up_history(raw)


def _archive_current_follow_up(entity, *, performed_by_name: str | None) -> None:
    old_date = getattr(entity, "next_follow_up_date", None)
    if old_date is None:
        return
    old_note = str(getattr(entity, "next_follow_up_note", None) or "").strip()
    history = normalize_follow_up_history(getattr(entity, "follow_up_history", None))
    history.insert(
        0,
        {
            "date": old_date.isoformat(),
            "note": old_note,
            "recorded_at": datetime.now(timezone.utc).isoformat(),
            "recorded_by_name": (performed_by_name or "").strip() or None,
        },
    )
    entity.follow_up_history = history


def apply_follow_up_fields(
    entity,
    *,
    new_date: date,
    new_note: str | None,
    performed_by_name: str | None,
    archive_on_date_change: bool = True,
) -> None:
    old_date = getattr(entity, "next_follow_up_date", None)
    new_note_norm = parse_follow_up_note(new_note)
    if archive_on_date_change and old_date is not None and old_date != new_date:
        _archive_current_follow_up(entity, performed_by_name=performed_by_name)
    entity.next_follow_up_date = new_date
    entity.next_follow_up_note = new_note_norm


def require_follow_up_date(raw: object, *, field_label: str = "next_follow_up_date") -> date:
    parsed = parse_follow_up_date(raw)
    if parsed is None:
        raise ValueError(f"{field_label} is required")
    return parsed
