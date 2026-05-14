"""PDF generation logic using ReportLab.

The structure follows the provided quotation format:
- full page border
- boxed header + company/meta sections
- valuation grid
- terms and subtotal side-by-side within bounded sections
"""

from __future__ import annotations

import logging
import os
from datetime import date, datetime, timedelta
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Image as RLImage
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from core.config import get_settings

logger = logging.getLogger(__name__)

def _resolve_quotation_logo_path() -> Path | None:
    """Logo file: env override, then packaged under backend/assets (Docker), then repo docs/."""
    env = (os.environ.get("QUOTATION_LOGO_PATH") or "").strip()
    if env:
        p = Path(env).expanduser()
        if p.is_file():
            return p
    here = Path(__file__).resolve()
    candidates = [
        here.parent.parent / "assets" / "branding" / "parth_valve_logo.jpeg",
        here.parents[2] / "docs" / "parth_valve_logo.jpeg",
    ]
    for p in candidates:
        if p.is_file():
            return p
    return None

_DARK_NAVY = colors.HexColor("#1a2744")
_DARK_GREEN = colors.HexColor("#1f4d2e")
_LIGHT_GRAY = colors.HexColor("#f0f2ee")
_MID_GRAY = colors.HexColor("#6b7280")
_GRID = colors.HexColor("#c5cbc0")
_BORDER = colors.HexColor("#2f2f2f")


def _line_pdf_override(pdf_display_overrides: object, idx_zero_based: int) -> dict:
    """Return per-line override dict (description, size, …) from quotation PDF overlay settings."""
    if not isinstance(pdf_display_overrides, dict):
        return {}
    lines = pdf_display_overrides.get("lines")
    if isinstance(lines, list) and 0 <= idx_zero_based < len(lines):
        row = lines[idx_zero_based]
        return row if isinstance(row, dict) else {}
    key = str(idx_zero_based)
    row = pdf_display_overrides.get(key)
    return row if isinstance(row, dict) else {}


def _flow_from_kv_rows(rows: object, style: ParagraphStyle) -> list:
    """Build stacked Paragraphs from [{label, value}, …] for letterhead / client extras."""
    out: list = []
    if not isinstance(rows, list):
        return out
    for row in rows:
        if not isinstance(row, dict):
            continue
        lab = str(row.get("label") or "").strip()
        val = str(row.get("value") or "").strip()
        if not lab and not val:
            continue
        if lab:
            out.append(Paragraph(f"<b>{escape(lab)}</b> : {escape(val)}", style))
        else:
            out.append(Paragraph(escape(val), style))
    return out


def _pdf_ov_list(pdf_ov: object, key: str) -> list | None:
    if not isinstance(pdf_ov, dict):
        return None
    v = pdf_ov.get(key)
    if isinstance(v, list) and len(v) > 0:
        return v
    return None


def _logo_flowable(max_w: float, max_h: float) -> RLImage | None:
    logo_path = _resolve_quotation_logo_path()
    if logo_path is None:
        logger.warning(
            "Quotation logo not found (set QUOTATION_LOGO_PATH or add "
            "backend/assets/branding/parth_valve_logo.jpeg or docs/parth_valve_logo.jpeg)."
        )
        return None
    try:
        return RLImage(str(logo_path), width=max_w, height=max_h, kind="proportional")
    except Exception as exc:
        logger.warning("Could not load quotation logo: %s", exc)
        return None


def _make_footer_canvas_fn(footer_text: str):
    def _draw(canvas, doc) -> None:
        canvas.saveState()
        # Page border around the printable area
        canvas.setStrokeColor(_BORDER)
        canvas.setLineWidth(1.0)
        canvas.rect(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, stroke=1, fill=0)
        canvas.setFillColor(_MID_GRAY)
        canvas.setFont("Helvetica", 7)
        w, _h = A4
        canvas.drawCentredString(w / 2.0, 8 * mm, footer_text[:120])
        canvas.restoreState()

    return _draw


async def generate_quotation_pdf(
    quotation_data: dict,
    client_config: dict | str,
) -> str | None:
    """Generate a professional quotation PDF and return the file path."""
    try:
        settings = get_settings()

        if isinstance(client_config, str):
            client_config = settings.get_client_json()

        output_dir = Path(settings.PDF_OUTPUT_DIR)
        output_dir.mkdir(parents=True, exist_ok=True)

        quote_number = quotation_data.get("quote_number", "QT-DRAFT")
        filepath = output_dir / f"{quote_number}.pdf"

        footer_ref = str(
            client_config.get("quotation_form_footer_ref")
            or "PVH/MKT/04 Rev.No:02 Date:07/04/2025"
        )
        doc = SimpleDocTemplate(
            str(filepath),
            pagesize=A4,
            rightMargin=14 * mm,
            leftMargin=14 * mm,
            topMargin=12 * mm,
            bottomMargin=20 * mm,
        )

        styles = getSampleStyleSheet()
        s_normal = styles["Normal"]
        s_addr = ParagraphStyle(
            "Addr",
            parent=s_normal,
            fontSize=8,
            leading=10,
            textColor=colors.black,
            alignment=TA_LEFT,
        )
        s_letter_co = ParagraphStyle(
            "LetterCo",
            parent=s_normal,
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=13,
            textColor=_DARK_GREEN,
            spaceAfter=1,
            alignment=TA_LEFT,
        )
        s_quotation_title = ParagraphStyle(
            "QuotTitle",
            parent=s_normal,
            fontName="Helvetica-Bold",
            fontSize=14,
            leading=16,
            textColor=_DARK_NAVY,
            spaceBefore=2,
            spaceAfter=3,
            alignment=TA_LEFT,
        )
        s_section = ParagraphStyle(
            "Section",
            parent=s_normal,
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=12,
            textColor=_DARK_NAVY,
            spaceBefore=8,
            spaceAfter=4,
        )
        s_cust_co = ParagraphStyle(
            "CustCo",
            parent=s_normal,
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=12,
            textColor=colors.black,
        )
        s_meta_val = ParagraphStyle("MetaV", parent=s_normal, fontSize=8, textColor=colors.black, alignment=TA_LEFT)
        s_cell = ParagraphStyle("Cell", parent=s_normal, fontSize=7.5, leading=9)
        s_cell_head = ParagraphStyle("CellH", parent=s_normal, fontName="Helvetica-Bold", fontSize=7.5, leading=9)
        s_terms = ParagraphStyle("Terms", parent=s_normal, fontSize=8, leading=10)
        s_thanks = ParagraphStyle("Thanks", parent=s_normal, fontSize=9, alignment=1, textColor=_DARK_GREEN)

        company = client_config.get("company_name", "PARTH VALVES AND HOSES LLP")
        address = client_config.get("address", "")
        phone = client_config.get("phone", "")
        email = client_config.get("email", "")
        sales_email = client_config.get("sales_email") or email
        website = client_config.get("website", "")
        gst = client_config.get("gst_number", "")
        prepared = client_config.get("prepared_by", "Sales Team")

        el: list = []

        # ── Header box ──────────────────────────────────────────────
        logo = _logo_flowable(52 * mm, 30 * mm)
        title_cell = [
            Paragraph(f"<b>{escape(str(company).upper())}</b>", s_letter_co),
            Paragraph("<b>QUOTATION</b>", s_quotation_title),
        ]
        header_top = (
            Table([[logo, title_cell]], colWidths=[52 * mm, doc.width - 52 * mm])
            if logo
            else Table([[title_cell]], colWidths=[doc.width])
        )
        header_top.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("ALIGN", (1, 0), (1, 0), "CENTER"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ]
            )
        )

        pdf_ov = quotation_data.get("pdf_display_overrides")

        q_date_str = quotation_data.get("quotation_date") or date.today().strftime("%d/%m/%Y")
        validity_days = int(quotation_data.get("validity_days", 15))
        try:
            base_d = datetime.strptime(str(q_date_str).strip(), "%d/%m/%Y").date()
        except (ValueError, TypeError):
            base_d = date.today()
        valid_until = base_d + timedelta(days=validity_days)
        enq_id = quotation_data.get("enquiry_id")
        enq_num = quotation_data.get("enquiry_number")
        enq_date = quotation_data.get("enquiry_date")

        hl = _pdf_ov_list(pdf_ov, "header_left")
        hr = _pdf_ov_list(pdf_ov, "header_right")
        if hl is not None:
            left_info = _flow_from_kv_rows(hl, s_addr)
        else:
            left_info = []
            if address:
                left_info.append(Paragraph(f"<b>Address</b> : {escape(str(address))}", s_addr))
            if website:
                left_info.append(Paragraph(f"<b>Website</b> : {escape(str(website))}", s_addr))
            if sales_email:
                left_info.append(Paragraph(f"<b>E-Mail</b> : {escape(str(sales_email))}", s_addr))
            left_info.append(Paragraph(f"<b>Prepared By</b> : {escape(str(prepared))}", s_addr))

        if hr is not None:
            right_info = _flow_from_kv_rows(hr, s_meta_val)
        else:
            right_info = [
                Paragraph(f"<b>Date</b> : {escape(str(q_date_str))}", s_meta_val),
                Paragraph(f"<b>Quotation No</b> : {escape(str(quote_number))}", s_meta_val),
                Paragraph(f"<b>Valid Until</b> : {escape(valid_until.strftime('%d/%m/%Y'))}", s_meta_val),
            ]
            if enq_id or enq_num:
                ref = enq_num or enq_id
                line = f"<b>Enquiry No / Date</b> : {escape(str(ref))}"
                if enq_date:
                    line += f" / {escape(str(enq_date))}"
                right_info.append(Paragraph(line, s_meta_val))

        header_info = Table(
            [[left_info, right_info]],
            colWidths=[doc.width * 0.52, doc.width * 0.48],
        )
        header_info.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LINEABOVE", (0, 0), (-1, 0), 1, _BORDER),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ]
            )
        )

        header_box = Table([[header_top], [header_info]], colWidths=[doc.width])
        header_box.setStyle(
            TableStyle(
                [
                    ("BOX", (0, 0), (-1, -1), 1, _BORDER),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                    ("TOPPADDING", (0, 0), (-1, -1), 0),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ]
            )
        )
        el.append(header_box)
        el.append(Spacer(1, 3 * mm))

        # ── COMPANY box ─────────────────────────────────────────────
        client_name = quotation_data.get("client_name", "")
        client_company = quotation_data.get("client_company", "")
        client_email = quotation_data.get("client_email", "")
        client_phone = quotation_data.get("client_phone", "")

        cust_left: list = [Paragraph("<b>COMPANY</b>", s_section)]
        co_display = (client_company or client_name or "Customer").strip()
        cust_left.append(Paragraph(escape(co_display), s_cust_co))
        extra_co = _pdf_ov_list(pdf_ov, "company_left_extra")
        if extra_co is not None:
            cust_left.extend(_flow_from_kv_rows(extra_co, s_addr))
        concern_text = ""
        emp_pdf = quotation_data.get("quotation_client_employee")
        if isinstance(emp_pdf, dict):
            fn = str(emp_pdf.get("full_name") or "").strip()
            if fn:
                des = str(emp_pdf.get("designation") or "").strip()
                concern_text = escape(fn) + (f" · {escape(des)}" if des else "")
        if not concern_text and client_name and client_name.strip() and client_name.strip() != co_display:
            concern_text = escape(client_name.strip())

        cust_right: list = []
        cr_blurb = ""
        if isinstance(pdf_ov, dict) and pdf_ov.get("company_right_text"):
            cr_blurb = str(pdf_ov.get("company_right_text") or "").strip()
        if cr_blurb:
            cust_right.append(Paragraph(escape(cr_blurb), s_addr))
        if concern_text:
            cust_right.append(Paragraph(f"<b>Concern Person</b> : {concern_text}", s_addr))
        if client_phone:
            cust_right.append(Paragraph(f"<b>Contact No.</b> : {escape(str(client_phone))}", s_addr))
        if client_email:
            cust_right.append(Paragraph(f"<b>E-Mail</b> : {escape(str(client_email))}", s_addr))
        company_tbl = Table([[cust_left, cust_right]], colWidths=[doc.width * 0.52, doc.width * 0.48])
        company_tbl.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("BOX", (0, 0), (-1, -1), 1, _BORDER),
                    ("LINEBEFORE", (1, 0), (1, 0), 1, _BORDER),
                    ("TOPPADDING", (0, 0), (-1, -1), 2),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ]
            )
        )
        el.append(company_tbl)
        el.append(Spacer(1, 1.5 * mm))

        # Centered thanks row
        thank_txt = "Thank you for Your Enquiry considering us as faithful Supplier"
        if isinstance(pdf_ov, dict) and str(pdf_ov.get("thank_you_row") or "").strip():
            thank_txt = str(pdf_ov.get("thank_you_row") or "").strip()
        thank_row = Table(
            [[Paragraph(escape(thank_txt), ParagraphStyle("CenterThanks", parent=s_normal, alignment=1, fontSize=10))]],
            colWidths=[doc.width],
        )
        thank_row.setStyle(
            TableStyle(
                [
                    ("BOX", (0, 0), (-1, -1), 1, _BORDER),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ]
            )
        )
        el.append(thank_row)
        el.append(Spacer(1, 2 * mm))

        # ── VALUATION table ─────────────────────────────────────────
        valuation_title = Table([[Paragraph("<b>VALUATION</b>", s_section)]], colWidths=[doc.width])
        valuation_title.setStyle(
            TableStyle(
                [
                    ("BOX", (0, 0), (-1, -1), 1, _BORDER),
                    ("TOPPADDING", (0, 0), (-1, -1), 3),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ]
            )
        )
        el.append(valuation_title)
        el.append(
            Spacer(1, 0.5 * mm)
        )

        header = [
            Paragraph("<b>Sr.No</b>", s_cell_head),
            Paragraph("<b>Description</b>", s_cell_head),
            Paragraph("<b>Size</b>", s_cell_head),
            Paragraph("<b>Qty</b>", s_cell_head),
            Paragraph("<b>Rate</b>", s_cell_head),
            Paragraph("<b>Disc.%</b>", s_cell_head),
            Paragraph("<b>Total</b>", s_cell_head),
        ]
        table_data: list = [header]

        for idx, item in enumerate(line_items, 1):
            if not isinstance(item, dict):
                continue
            row_ov = _line_pdf_override(pdf_ov, idx - 1)
            desc = item.get("product_name") or item.get("description", "")
            if row_ov.get("description"):
                desc = str(row_ov["description"])
            elif row_ov.get("product_name"):
                desc = str(row_ov["product_name"])
            size = item.get("size", "")
            if row_ov.get("size"):
                size = str(row_ov["size"])
            qty = item.get("quantity", 1)
            unit = item.get("unit", "Nos")
            price = float(item.get("unit_price", 0))
            total = float(item.get("line_total") or item.get("total", float(qty) * price))
            disc = item.get("customer_discount_pct")
            try:
                disc_f = float(disc) if disc is not None else 0.0
            except (TypeError, ValueError):
                disc_f = 0.0

            qty_cell = f"{escape(str(qty))} {escape(str(unit))}".strip()
            table_data.append(
                [
                    Paragraph(str(idx), s_cell),
                    Paragraph(escape(str(desc)), s_cell),
                    Paragraph(escape(str(size)) if size else "—", s_cell),
                    Paragraph(qty_cell, s_cell),
                    Paragraph(f"{price:,.2f}", s_cell),
                    Paragraph(f"{disc_f:g}" if disc_f else "0", s_cell),
                    Paragraph(f"{total:,.2f}", s_cell),
                ]
            )

        sup_rows = _pdf_ov_list(pdf_ov, "valuation_supplement_rows")
        if sup_rows:
            for j, srow in enumerate(sup_rows):
                if not isinstance(srow, dict):
                    continue
                sr = str(srow.get("sr") or "").strip() or "—"
                desc = str(srow.get("description") or "").strip() or "—"
                size = str(srow.get("size") or "").strip() or "—"
                qty = str(srow.get("qty") or "").strip() or "—"
                rate = str(srow.get("rate") or "").strip() or "—"
                disc = str(srow.get("disc") or "").strip() or "—"
                tot = str(srow.get("total") or "").strip() or "—"
                table_data.append(
                    [
                        Paragraph(escape(sr), s_cell),
                        Paragraph(escape(desc), s_cell),
                        Paragraph(escape(size), s_cell),
                        Paragraph(escape(qty), s_cell),
                        Paragraph(escape(rate), s_cell),
                        Paragraph(escape(disc), s_cell),
                        Paragraph(escape(tot), s_cell),
                    ]
                )

        if len(table_data) > 1:
            col_w = [22 * mm, 72 * mm, 22 * mm, 24 * mm, 26 * mm, 18 * mm, 28 * mm]
            items_table = Table(table_data, colWidths=col_w, repeatRows=1)
            items_table.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), _DARK_NAVY),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                        ("FONTSIZE", (0, 1), (-1, -1), 7.5),
                        ("ALIGN", (0, 0), (0, -1), "CENTER"),
                        ("ALIGN", (3, 0), (-1, -1), "RIGHT"),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("GRID", (0, 0), (-1, -1), 0.6, _BORDER),
                        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, _LIGHT_GRAY]),
                        ("TOPPADDING", (0, 0), (-1, -1), 4),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ]
                )
            )
            el.append(items_table)

        el.append(Spacer(1, 5 * mm))

        # ── Totals (recompute if needed — same logic as before) ──
        subtotal = float(quotation_data.get("subtotal", 0))
        gst_amount = float(quotation_data.get("gst_amount", 0))
        pf_amount = float(quotation_data.get("pf_amount", 0))
        total_amount = float(quotation_data.get("total_amount", 0))
        gst_pct = float(quotation_data.get("gst_rate", 18))
        pf_pct = float(quotation_data.get("pf_rate", 3))
        freight = quotation_data.get("freight_note", "Extra at actual")

        line_items_for_total = quotation_data.get("line_items") or []
        if (
            isinstance(line_items_for_total, list)
            and line_items_for_total
            and subtotal == 0
            and total_amount == 0
        ):
            st = 0.0
            for item in line_items_for_total:
                if not isinstance(item, dict):
                    continue
                qty = float(item.get("quantity") or 1)
                up = float(item.get("unit_price") or 0)
                lt = item.get("line_total")
                if lt is not None:
                    st += float(lt)
                else:
                    st += float(item.get("total") or qty * up)
            subtotal = round(st, 2)
            gst_amount = round(subtotal * (gst_pct / 100.0), 2)
            pf_amount = round(subtotal * (pf_pct / 100.0), 2)
            total_amount = round(subtotal + gst_amount + pf_amount, 2)

        # ── Terms + Financial summary side-by-side ────────────────
        ti = None
        if isinstance(pdf_ov, dict):
            ti = pdf_ov.get("terms_items")
        if isinstance(ti, list) and ti:
            terms_body = [str(x).strip() for x in ti if str(x).strip()]
        else:
            terms_body = [
                "Any modification to agreed specifications may attract additional commercial charges.",
                "Third party inspection, if required — extra at actual and in customer's scope.",
                f"Freight — {str(freight)}.",
                f"GST @ {gst_pct:g}% — included in valuation total as shown below.",
                f"P &amp; F @ {pf_pct:g}% — included in valuation total as shown below.",
                f"Offer validity — {validity_days} days from date of issue.",
                "Subject to Pune jurisdiction only.",
            ]
        terms_flow: list = [Paragraph("<b>TERMS AND CONDITIONS</b>", s_section)]
        for i, tb in enumerate(terms_body, 1):
            terms_flow.append(Paragraph(f"{i}. {escape(tb)}", s_terms))

        fin_rows: list[list] = [
            [Paragraph("<b>SUB TOTAL</b>", s_cell_head), Paragraph(f"₹{subtotal:,.2f}", s_cell)],
            [
                Paragraph(f"<b>P &amp; F CHARGES</b> ({pf_pct:g} %)", s_cell_head),
                Paragraph(f"₹{pf_amount:,.2f}", s_cell),
            ],
        ]
        if abs(gst_pct - 18.0) < 0.01 and gst_amount > 0:
            half = round(gst_amount / 2.0, 2)
            other = round(gst_amount - half, 2)
            fin_rows.append(
                [Paragraph("<b>CGST</b> (9 %)", s_cell_head), Paragraph(f"₹{half:,.2f}", s_cell)]
            )
            fin_rows.append(
                [Paragraph("<b>SGST</b> (9 %)", s_cell_head), Paragraph(f"₹{other:,.2f}", s_cell)]
            )
        else:
            fin_rows.append(
                [
                    Paragraph(f"<b>GST</b> ({gst_pct:g} %)", s_cell_head),
                    Paragraph(f"₹{gst_amount:,.2f}", s_cell),
                ]
            )
        fin_rows.append(
            [
                Paragraph("<b>FREIGHT</b>", s_cell_head),
                Paragraph(escape(str(freight)), s_cell),
            ]
        )
        fin_rows.append(
            [
                Paragraph("<b>GRAND TOTAL INR</b>", s_cell_head),
                Paragraph(f"<b>₹{total_amount:,.2f}</b>", ParagraphStyle("Grand", parent=s_cell, fontName="Helvetica-Bold")),
            ]
        )
        fin_tbl = Table(fin_rows, colWidths=[doc.width * 0.24, doc.width * 0.14], hAlign="LEFT")
        fin_tbl.setStyle(
            TableStyle(
                [
                    ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ("GRID", (0, 0), (-1, -1), 0.6, _BORDER),
                ]
            )
        )
        terms_summary = Table([[terms_flow, fin_tbl]], colWidths=[doc.width * 0.62, doc.width * 0.38])
        terms_summary.setStyle(
            TableStyle(
                [
                    ("BOX", (0, 0), (-1, -1), 1, _BORDER),
                    ("LINEBEFORE", (1, 0), (1, 0), 1, _BORDER),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        el.append(terms_summary)

        # ── Notes ──
        notes = quotation_data.get("professional_notes") or quotation_data.get("notes", "")
        if isinstance(pdf_ov, dict) and "notes" in pdf_ov:
            notes = str(pdf_ov.get("notes") or "")
        if notes:
            el.append(Spacer(1, 2 * mm))
            note_tbl = Table(
                [[Paragraph("<b>Notes</b>", s_section)], [Paragraph(escape(str(notes)), s_terms)]],
                colWidths=[doc.width],
            )
            note_tbl.setStyle(
                TableStyle(
                    [
                        ("BOX", (0, 0), (-1, -1), 1, _BORDER),
                        ("LEFTPADDING", (0, 0), (-1, -1), 6),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                        ("TOPPADDING", (0, 0), (-1, -1), 3),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ]
                )
            )
            el.append(note_tbl)

        el.append(Spacer(1, 6 * mm))
        contact_line = f"If you have any questions about this quote, please contact {escape(str(prepared))}"
        if phone:
            contact_line += f", {escape(str(phone))}"
        if sales_email:
            contact_line += f", {escape(str(sales_email))}"
        contact_line += "."
        if isinstance(pdf_ov, dict) and str(pdf_ov.get("footer_contact") or "").strip():
            contact_line = escape(str(pdf_ov.get("footer_contact") or "").strip())
        el.append(Paragraph(contact_line, ParagraphStyle("Contact", parent=s_normal, fontSize=8.5)))
        el.append(Spacer(1, 4 * mm))
        thanks_line = "Thank You For Your Business !"
        if isinstance(pdf_ov, dict) and str(pdf_ov.get("footer_thanks") or "").strip():
            thanks_line = str(pdf_ov.get("footer_thanks") or "").strip()
        el.append(Paragraph(f"<b>{escape(thanks_line)}</b>", s_thanks))
        el.append(Spacer(1, 8 * mm))
        disc_line = "This quotation was prepared with AI assistance and reviewed by our team."
        if isinstance(pdf_ov, dict) and str(pdf_ov.get("footer_disclaimer") or "").strip():
            disc_line = str(pdf_ov.get("footer_disclaimer") or "").strip()
        el.append(
            Paragraph(
                f"<i>{escape(disc_line)}</i>",
                ParagraphStyle("AI", parent=s_normal, fontSize=7, textColor=_MID_GRAY, alignment=1),
            )
        )

        doc.build(
            el,
            onFirstPage=_make_footer_canvas_fn(footer_ref),
            onLaterPages=_make_footer_canvas_fn(footer_ref),
        )
        logger.info("PDF generated: %s", filepath)
        return str(filepath)

    except Exception as e:
        logger.error("PDF generation failed: %s", e)
        return None
