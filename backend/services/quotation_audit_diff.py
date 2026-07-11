"""Structured before/after views for quotation audit logs."""

from __future__ import annotations

from typing import Any


def _money(n: float | int | None) -> str:
    try:
        v = round(float(n or 0), 2)
    except (TypeError, ValueError):
        v = 0.0
    return f"₹{v:,.2f}"


def _row(key: str, label: str, value: str) -> dict:
    return {"key": key, "label": label, "value": value}


def _section(title: str, rows: list[dict], *, highlight_all: bool = False) -> dict:
    out: dict[str, Any] = {"title": title, "rows": rows}
    if highlight_all:
        out["highlight_all"] = True
    return out


def _line_key(li: dict) -> str:
    """Must match ``quotation_service._line_key``."""
    ct = str(li.get("catalog_table") or "").strip().lower()
    cr = str(li.get("catalog_row_id") or "").strip().lower()
    desc = str(li.get("description") or li.get("product_name") or "").strip().lower()
    if ct and cr:
        return f"{ct}:{cr}"
    return desc or "line"


def _line_label(line: dict, line_key: str = "") -> str:
    for k in ("product_name", "description"):
        v = str(line.get(k) or "").strip()
        if v:
            return v[:120]
    if line_key and line_key != "line":
        return line_key[:120]
    for k in ("catalog_table", "category"):
        v = str(line.get(k) or "").strip()
        if v:
            return v[:120]
    return "Product line"


def _line_maps(before_lines: list[dict], after_lines: list[dict]) -> tuple[dict[str, dict], dict[str, dict]]:
    bmap = {_line_key(x): x for x in (before_lines or []) if isinstance(x, dict)}
    amap = {_line_key(x): x for x in (after_lines or []) if isinstance(x, dict)}
    return bmap, amap


def _line_detail_rows(line_key: str, line: dict) -> list[dict]:
    desc = _line_label(line, line_key)
    qty = line.get("quantity")
    unit = str(line.get("unit") or "Nos").strip() or "Nos"
    unit_price = line.get("unit_price")
    line_total = line.get("line_total")
    if line_total is None and unit_price is not None:
        try:
            line_total = round(float(unit_price) * float(qty or 1), 2)
        except (TypeError, ValueError):
            line_total = None
    rows = [_row(f"line.{line_key}.title", "Product", desc)]
    if qty is not None:
        rows.append(_row(f"line.{line_key}.quantity", "Quantity", f"{qty} {unit}"))
    if unit_price is not None:
        rows.append(_row(f"line.{line_key}.unit_price", "Unit price", _money(unit_price)))
    if line_total is not None:
        rows.append(_row(f"line.{line_key}.line_total", "Line total", _money(line_total)))
    disc = line.get("customer_discount_pct")
    if disc is not None:
        rows.append(_row(f"line.{line_key}.discount", "Discount", f"{disc} %"))
    return rows


def _line_field_rows(line_key: str, line: dict, changes: dict, side: str) -> list[dict]:
    labels = {
        "description": "Description",
        "quantity": "Quantity",
        "unit_price": "Unit price",
        "line_total": "Line total",
        "customer_discount_pct": "Discount",
        "unit": "Unit",
        "base_unit_price": "Base price",
        "customer_discount_amount": "Discount amount",
    }
    title = _line_label(line, line_key)
    rows = [_row(f"line.{line_key}.title", "Product", title)]
    for field, delta in changes.items():
        if not isinstance(delta, dict):
            continue
        raw = delta.get("from") if side == "before" else delta.get("to")
        if field in ("unit_price", "line_total", "base_unit_price", "customer_discount_amount"):
            val = _money(raw)
        elif field == "quantity":
            unit = str(line.get("unit") or "Nos").strip() or "Nos"
            val = f"{raw} {unit}"
        elif field == "customer_discount_pct":
            val = f"{raw} %"
        else:
            val = str(raw if raw is not None else "—")
        rows.append(_row(f"line.{line_key}.{field}", labels.get(field, field), val))
    return rows


def financial_rows(
    *,
    subtotal: float,
    pf_amount: float,
    pf_rate: float | None = None,
    freight_amount: float = 0.0,
    freight_rate: float | None = None,
    gst_amount: float = 0.0,
    cgst_amount: float | None = None,
    sgst_amount: float | None = None,
    igst_amount: float | None = None,
    total_amount: float = 0.0,
) -> list[dict]:
    taxable = round(float(subtotal or 0) + float(pf_amount or 0) + float(freight_amount or 0), 2)
    pf_label = f"P & F ({pf_rate:g} %)" if pf_rate is not None else "P & F"
    freight_label = (
        f"FREIGHT ({freight_rate:g} %)" if freight_rate is not None else "FREIGHT"
    )
    rows = [
        _row("financial.item_total", "ITEM TOTAL", _money(subtotal)),
        _row("financial.pf_amount", pf_label, _money(pf_amount)),
        _row("financial.freight_amount", freight_label, _money(freight_amount)),
        _row("financial.taxable_subtotal", "SUB TOTAL", _money(taxable)),
    ]
    if cgst_amount is not None and cgst_amount > 0:
        rows.append(_row("financial.cgst_amount", "CGST", _money(cgst_amount)))
    if sgst_amount is not None and sgst_amount > 0:
        rows.append(_row("financial.sgst_amount", "SGST", _money(sgst_amount)))
    if igst_amount is not None and igst_amount > 0:
        rows.append(_row("financial.igst_amount", "IGST", _money(igst_amount)))
    if not any(x is not None and x > 0 for x in (cgst_amount, sgst_amount, igst_amount)):
        rows.append(_row("financial.gst_amount", "GST", _money(gst_amount)))
    rows.append(_row("financial.total_amount", "GRAND TOTAL INR", _money(total_amount)))
    return rows


def financial_rows_from_quotation(q: object, computed: dict | None = None) -> list[dict]:
    comp = computed or {}
    subtotal = float(getattr(q, "subtotal", 0) or comp.get("item_total") or 0)
    pf_amount = float(comp.get("pf_amount", getattr(q, "pf_amount", 0) or 0))
    pf_rate = comp.get("pf_rate", getattr(q, "pf_rate", None))
    freight_amount = float(comp.get("freight_amount", getattr(q, "freight_amount", 0) or 0))
    freight_rate = comp.get("freight_rate", getattr(q, "freight_rate", None))
    gst_amount = float(comp.get("gst_amount", getattr(q, "gst_amount", 0) or 0))
    total_amount = float(comp.get("total_amount", getattr(q, "total_amount", 0) or 0))
    return financial_rows(
        subtotal=subtotal,
        pf_amount=pf_amount,
        pf_rate=float(pf_rate) if pf_rate is not None else None,
        freight_amount=freight_amount,
        freight_rate=float(freight_rate) if freight_rate is not None else None,
        gst_amount=gst_amount,
        cgst_amount=comp.get("cgst_amount"),
        sgst_amount=comp.get("sgst_amount"),
        igst_amount=comp.get("igst_amount"),
        total_amount=total_amount,
    )


def build_line_items_change_view(
    before_lines: list[dict],
    after_lines: list[dict],
    diff: dict,
) -> dict:
    """Product-line edits only — no financial summary cascade."""
    bmap, amap = _line_maps(before_lines, after_lines)
    added = list(diff.get("added") or [])
    removed = list(diff.get("removed") or [])
    changed = list(diff.get("changed") or [])

    before_sections: list[dict] = []
    after_sections: list[dict] = []

    for line_key in removed:
        line = bmap.get(line_key) or {}
        title = _line_label(line, line_key)
        before_sections.append(
            _section(title, _line_detail_rows(line_key, line), highlight_all=True),
        )

    for line_key in added:
        line = amap.get(line_key) or {}
        title = _line_label(line, line_key)
        after_sections.append(
            _section(title, _line_detail_rows(line_key, line), highlight_all=True),
        )

    for item in changed:
        if not isinstance(item, dict):
            continue
        line_key = str(item.get("line") or "")
        changes = item.get("changes") if isinstance(item.get("changes"), dict) else {}
        if not changes:
            continue
        bline = bmap.get(line_key) or {}
        aline = amap.get(line_key) or {}
        title = _line_label(bline or aline, line_key)
        highlight_all = len(changes) >= 3
        if highlight_all:
            before_sections.append(
                _section(title, _line_detail_rows(line_key, bline), highlight_all=True),
            )
            after_sections.append(
                _section(title, _line_detail_rows(line_key, aline), highlight_all=True),
            )
        else:
            before_sections.append(
                _section(title, _line_field_rows(line_key, bline, changes, "before"), highlight_all=False),
            )
            after_sections.append(
                _section(title, _line_field_rows(line_key, aline, changes, "after"), highlight_all=False),
            )

    view = build_change_view(before_sections, after_sections)
    return _filter_view_to_changed_rows_only(view)


def build_financial_change_view(before_rows: list[dict], after_rows: list[dict]) -> dict:
    view = build_change_view(
        [_section("Financial summary", before_rows)],
        [_section("Financial summary", after_rows)],
    )
    return _filter_view_to_changed_rows_only(view)


def _norm_terms(items: object) -> list[str]:
    if not isinstance(items, list):
        return []
    return [str(x).strip() for x in items if str(x).strip()]


def _terms_change_sections(before_terms: list[str], after_terms: list[str]) -> tuple[list[dict], list[dict]]:
    before_sections: list[dict] = []
    after_sections: list[dict] = []
    before_rows: list[dict] = []
    after_rows: list[dict] = []

    after_set = set(after_terms)
    before_set = set(before_terms)

    for i, term in enumerate(before_terms):
        if term not in after_set:
            before_rows.append(_row(f"pdf.terms.removed.{i}", f"Removed term", term))
            after_rows.append(_row(f"pdf.terms.removed.{i}", f"Removed term", "—"))

    for i, term in enumerate(after_terms):
        if term not in before_set:
            before_rows.append(_row(f"pdf.terms.added.{i}", f"Added term", "—"))
            after_rows.append(_row(f"pdf.terms.added.{i}", f"Added term", term))

    if before_rows or after_rows:
        before_sections.append(_section("Terms & conditions", before_rows))
        after_sections.append(_section("Terms & conditions", after_rows))
    return before_sections, after_sections


def _kv_change_sections(
    title: str,
    prefix: str,
    before_rows: list[dict] | None,
    after_rows: list[dict] | None,
) -> tuple[list[dict], list[dict]]:
    before_list = before_rows if isinstance(before_rows, list) else []
    after_list = after_rows if isinstance(after_rows, list) else []
    max_len = max(len(before_list), len(after_list))
    b_out: list[dict] = []
    a_out: list[dict] = []
    for i in range(max_len):
        b = before_list[i] if i < len(before_list) else {}
        a = after_list[i] if i < len(after_list) else {}
        bl = str(b.get("label") or "").strip()
        bv = str(b.get("value") or "").strip()
        al = str(a.get("label") or "").strip()
        av = str(a.get("value") or "").strip()
        if bl == al and bv == av:
            continue
        label = al or bl or f"Row {i + 1}"
        b_out.append(_row(f"{prefix}.{i}.{label}", label, bv or "—"))
        a_out.append(_row(f"{prefix}.{i}.{label}", label, av or "—"))
    if not b_out and not a_out:
        return [], []
    return [_section(title, b_out)], [_section(title, a_out)]


def _scalar_change_row(key: str, label: str, before_val: str, after_val: str) -> tuple[list[dict], list[dict]]:
    if before_val == after_val:
        return [], []
    return (
        [_section(label, [_row(key, label, before_val or "—")])],
        [_section(label, [_row(key, label, after_val or "—")])],
    )


def build_pdf_change_view(before_ov: dict | None, after_ov: dict | None) -> dict:
    """PDF display edits — only sections that actually changed (terms, header, footer, etc.)."""
    before = before_ov if isinstance(before_ov, dict) else {}
    after = after_ov if isinstance(after_ov, dict) else {}

    before_sections: list[dict] = []
    after_sections: list[dict] = []

    # Terms
    bt, at = _terms_change_sections(_norm_terms(before.get("terms_items")), _norm_terms(after.get("terms_items")))
    before_sections.extend(bt)
    after_sections.extend(at)

    # Header columns
    for title, key, prefix in (
        ("Header (left)", "header_left", "pdf.header_left"),
        ("Header (right)", "header_right", "pdf.header_right"),
        ("Company extras", "company_left_extra", "pdf.company_left_extra"),
    ):
        bs, as_ = _kv_change_sections(title, prefix, before.get(key), after.get(key))
        before_sections.extend(bs)
        after_sections.extend(as_)

    for key, label in (
        ("thank_you_row", "Thank-you banner"),
        ("company_right_text", "Company blurb"),
        ("footer_contact", "Footer contact"),
        ("footer_thanks", "Footer thanks"),
        ("footer_disclaimer", "Footer disclaimer"),
        ("notes", "Notes"),
    ):
        bs, as_ = _scalar_change_row(
            f"pdf.{key}",
            label,
            str(before.get(key) or "").strip(),
            str(after.get(key) or "").strip(),
        )
        before_sections.extend(bs)
        after_sections.extend(as_)

    # PDF line description/size overrides
    bl = before.get("lines") if isinstance(before.get("lines"), list) else []
    al = after.get("lines") if isinstance(after.get("lines"), list) else []
    max_lines = max(len(bl), len(al))
    for i in range(max_lines):
        brow = bl[i] if i < len(bl) and isinstance(bl[i], dict) else {}
        arow = al[i] if i < len(al) and isinstance(al[i], dict) else {}
        bd = str(brow.get("description") or brow.get("product_name") or "").strip()
        ad = str(arow.get("description") or arow.get("product_name") or "").strip()
        bs = str(brow.get("size") or "").strip()
        az = str(arow.get("size") or "").strip()
        if bd == ad and bs == az:
            continue
        title = f"Line {i + 1} display"
        b_rows = []
        a_rows = []
        if bd != ad:
            b_rows.append(_row(f"pdf.lines.{i}.description", "Description", bd or "—"))
            a_rows.append(_row(f"pdf.lines.{i}.description", "Description", ad or "—"))
        if bs != az:
            b_rows.append(_row(f"pdf.lines.{i}.size", "Size", bs or "—"))
            a_rows.append(_row(f"pdf.lines.{i}.size", "Size", az or "—"))
        if b_rows:
            before_sections.append(_section(title, b_rows))
            after_sections.append(_section(title, a_rows))

    if not before_sections and not after_sections:
        before_sections = [_section("PDF display", [_row("pdf.empty", "Status", "No visible changes")])]
        after_sections = [_section("PDF display", [_row("pdf.empty", "Status", "No visible changes")])]

    view = build_change_view(before_sections, after_sections)
    return _filter_view_to_changed_rows_only(view)


def build_change_view(before_sections: list[dict], after_sections: list[dict]) -> dict:
    before_map = _section_row_map(before_sections)
    after_map = _section_row_map(after_sections)
    changed_keys: set[str] = set()
    for key in set(before_map.keys()) | set(after_map.keys()):
        if before_map.get(key) != after_map.get(key):
            changed_keys.add(key)

    for sec in before_sections + after_sections:
        if sec.get("highlight_all"):
            for row in sec.get("rows") or []:
                if isinstance(row, dict) and row.get("key"):
                    changed_keys.add(str(row["key"]))

    return {
        "before": {"sections": before_sections},
        "after": {"sections": after_sections},
        "changed_keys": sorted(changed_keys),
    }


def _section_row_map(sections: list[dict]) -> dict[str, str]:
    out: dict[str, str] = {}
    for sec in sections:
        for row in sec.get("rows") or []:
            if isinstance(row, dict) and row.get("key"):
                out[str(row["key"])] = str(row.get("value") or "")
    return out


def _filter_view_to_changed_rows_only(view: dict) -> dict:
    changed_keys = set(view.get("changed_keys") or [])
    if not changed_keys:
        return view

    def filter_side(sections: list[dict]) -> list[dict]:
        out: list[dict] = []
        for sec in sections:
            if sec.get("highlight_all"):
                out.append(sec)
                continue
            rows = [
                row
                for row in (sec.get("rows") or [])
                if isinstance(row, dict) and str(row.get("key")) in changed_keys
            ]
            if rows:
                out.append({**sec, "rows": rows, "highlight_all": False})
        return out

    before_secs = filter_side(view.get("before", {}).get("sections") or [])
    after_secs = filter_side(view.get("after", {}).get("sections") or [])
    return {
        "before": {"sections": before_secs},
        "after": {"sections": after_secs},
        "changed_keys": sorted(changed_keys),
    }
