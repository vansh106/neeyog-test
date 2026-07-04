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
from reportlab.lib.enums import TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Image as RLImage
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from core.config import get_settings
from services.quotation_description_sanitize import sanitize_quotation_description_for_display

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

_PRIMARY = colors.HexColor("#0F6E56")
_TEXT = colors.HexColor("#1f2733")
_MUTED = colors.HexColor("#6b7280")
_MUTED_TEXT = colors.HexColor("#4b5563")
_BORDER = colors.HexColor("#d7dbe0")
_LIGHT_TEAL = colors.HexColor("#f0f6f3")
_LIGHT_TEAL_BORDER = colors.HexColor("#cfe3da")
_PRE_GST_BG = colors.HexColor("#eef3f1")
_ROW_ALT = colors.HexColor("#fcfdfc")
_MID_GRAY = _MUTED


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


def _sanitize_description_for_display(desc: object, supplier_names: list[str] | None = None) -> str:
    return sanitize_quotation_description_for_display(desc, supplier_names)


def _description_paragraph_html(desc: object, supplier_names: list[str] | None = None) -> str:
    """Render multi-line key/value description (one pair per line) for ReportLab."""
    cleaned = _sanitize_description_for_display(desc, supplier_names)
    if not cleaned:
        return ""
    parts: list[str] = []
    for line in cleaned.split("\n"):
        line = line.strip()
        if not line:
            continue
        if " : " in line:
            label, _, val = line.partition(" : ")
            parts.append(f"{escape(label.strip())} : {escape(val.strip())}")
        else:
            parts.append(escape(line))
    return "<br/>".join(parts)


def _money_text(amount: float | int) -> str:
    """Use ASCII currency prefix — Helvetica lacks the rupee glyph (shows as ■)."""
    return f"Rs. {float(amount):,.2f}"


def _format_display_date(raw: object) -> str:
    s = str(raw or "").strip()
    if not s:
        return "—"
    for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt).strftime("%d %b %Y")
        except (ValueError, TypeError):
            continue
    return s


_ONES = (
    "Zero",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
)
_TENS = ("", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety")


def _two_digit_words(n: int) -> str:
    if n < 20:
        return _ONES[n]
    tens, ones = divmod(n, 10)
    return f"{_TENS[tens]}{' ' + _ONES[ones] if ones else ''}".strip()


def _indian_int_words(n: int) -> str:
    if n == 0:
        return "Zero"
    if n < 0:
        return f"Minus {_indian_int_words(-n)}"
    parts: list[str] = []
    crore, n = divmod(n, 10_000_000)
    lakh, n = divmod(n, 100_000)
    thousand, n = divmod(n, 1000)
    hundred, rem = divmod(n, 100)
    if crore:
        parts.append(f"{_indian_int_words(crore)} Crore")
    if lakh:
        parts.append(f"{_two_digit_words(lakh)} Lakh")
    if thousand:
        parts.append(f"{_two_digit_words(thousand)} Thousand")
    if hundred:
        parts.append(f"{_ONES[hundred]} Hundred")
    if rem:
        parts.append(_two_digit_words(rem))
    return " ".join(parts)


def _amount_in_words_inr(amount: float) -> str:
    rupees = int(amount)
    paise = int(round((float(amount) - rupees) * 100))
    rupee_words = _indian_int_words(rupees)
    if paise:
        paise_words = _indian_int_words(paise)
        return f"Rupees {rupee_words} and {paise_words} Paise Only"
    return f"Rupees {rupee_words} Only"


def _bank_details_rows(client_config: dict) -> list[tuple[str, str]]:
    bd = client_config.get("bank_details")
    if not isinstance(bd, dict):
        return []
    field_map = (
        ("account_name", "Account Name"),
        ("bank", "Bank"),
        ("account_no", "Account No."),
        ("ifsc", "IFSC"),
        ("branch", "Branch"),
        ("account_type", "A/C Type"),
        ("swift", "SWIFT"),
    )
    rows: list[tuple[str, str]] = []
    for key, label in field_map:
        val = str(bd.get(key) or "").strip()
        if val:
            rows.append((label, val))
    return rows


def _meta_value_paragraph_html(value: str) -> str:
    """Format meta-strip values on a single line when they fit."""
    v = str(value or "").strip()
    if not v:
        return "<b>—</b>"
    return f"<b>{escape(v)}</b>"


def _build_meta_col_table(
    items: list[tuple[str, str]],
    col_width: float,
    label_style: ParagraphStyle,
    value_style: ParagraphStyle,
) -> Table:
    # Outer meta strip cells already have horizontal padding — keep inner table narrower.
    inner_w = max(col_width - 18, 40)
    label_w = inner_w * 0.44
    value_w = inner_w * 0.56
    value_style_wrapped = ParagraphStyle(
        f"{value_style.name}Wrap",
        parent=value_style,
        alignment=TA_RIGHT,
        wordWrap="CJK",
    )
    rows = [
        [
            Paragraph(f'<font color="#6b7280">{escape(label)}</font>', label_style),
            Paragraph(_meta_value_paragraph_html(value), value_style_wrapped),
        ]
        for label, value in items
        if label or value
    ]
    if not rows:
        rows = [[Paragraph("—", label_style), Paragraph("—", value_style)]]
    tbl = Table(rows, colWidths=[label_w, value_w])
    tbl.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                ("TOPPADDING", (0, 0), (-1, -1), 1.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 2),
            ]
        )
    )
    return tbl


def _build_customer_kv_table(
    items: list[tuple[str, str]],
    col_width: float,
    label_style: ParagraphStyle,
    value_style: ParagraphStyle,
) -> Table:
    """Label column + value column so Contact/Email labels and values align."""
    label_w = 54
    value_w = max(col_width - label_w - 8, 40)
    rows = [
        [
            Paragraph(f'<font color="#6b7280">{escape(label)}</font>', label_style),
            Paragraph(value, value_style),
        ]
        for label, value in items
        if label or value
    ]
    if not rows:
        rows = [[Paragraph("—", label_style), Paragraph("—", value_style)]]
    tbl = Table(rows, colWidths=[label_w, value_w])
    tbl.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ALIGN", (0, 0), (0, -1), "LEFT"),
                ("ALIGN", (1, 0), (1, -1), "LEFT"),
                ("TOPPADDING", (0, 0), (-1, -1), 1.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 2),
            ]
        )
    )
    return tbl


def _table_col_widths(total_width: float, fractions: list[float]) -> list[float]:
    """Scale column fractions to fit exactly within ``total_width``."""
    scale = total_width / sum(fractions)
    return [f * scale for f in fractions]


def _edge_padded_col_sum(page_width: float, edge_pad: float) -> float:
    """Sum of ``colWidths`` so a table fits ``page_width`` with edge horizontal padding."""
    return page_width - (2 * edge_pad)


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
            leading=11,
            textColor=_MUTED_TEXT,
            alignment=TA_LEFT,
        )
        s_letter_co = ParagraphStyle(
            "LetterCo",
            parent=s_normal,
            fontName="Helvetica-Bold",
            fontSize=14,
            leading=16,
            textColor=_PRIMARY,
            spaceAfter=2,
            alignment=TA_LEFT,
        )
        s_quotation_title = ParagraphStyle(
            "QuotTitle",
            parent=s_normal,
            fontName="Helvetica-Bold",
            fontSize=20,
            leading=22,
            textColor=_TEXT,
            spaceBefore=0,
            spaceAfter=0,
            alignment=TA_LEFT,
        )
        s_section = ParagraphStyle(
            "Section",
            parent=s_normal,
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=10,
            textColor=_PRIMARY,
            spaceBefore=0,
            spaceAfter=3,
        )
        s_cust_co = ParagraphStyle(
            "CustCo",
            parent=s_normal,
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=12,
            textColor=_TEXT,
        )
        s_cust_kv_val = ParagraphStyle(
            "CustKvVal",
            parent=s_addr,
            alignment=TA_LEFT,
            wordWrap="CJK",
        )
        s_meta_l = ParagraphStyle("MetaL", parent=s_normal, fontSize=7.9, textColor=_MUTED, alignment=TA_LEFT)
        s_meta_v = ParagraphStyle("MetaV", parent=s_normal, fontSize=7.9, textColor=_TEXT, alignment=TA_LEFT)
        s_cell = ParagraphStyle("Cell", parent=s_normal, fontSize=8, leading=11, textColor=_TEXT)
        s_cell_head = ParagraphStyle(
            "CellH",
            parent=s_normal,
            fontName="Helvetica-Bold",
            fontSize=7.4,
            leading=9,
            textColor=colors.white,
        )
        s_desc = ParagraphStyle(
            "DescCell",
            parent=s_cell,
            fontSize=8,
            leading=11,
            spaceBefore=0,
            spaceAfter=0,
        )
        s_terms = ParagraphStyle("Terms", parent=s_normal, fontSize=7.3, leading=10, textColor=_MUTED_TEXT)
        s_thanks = ParagraphStyle("Thanks", parent=s_normal, fontSize=9, alignment=1, textColor=_PRIMARY, fontName="Helvetica-Bold")

        company = client_config.get("company_name", "PARTH VALVES AND HOSES LLP")
        address = client_config.get("address", "")
        phone = client_config.get("phone", "")
        email = client_config.get("email", "")
        sales_email = client_config.get("sales_email") or email
        website = client_config.get("website", "")
        gst = client_config.get("gst_number", "")
        prepared = client_config.get("prepared_by", "Sales Team")
        prep_email = (quotation_data.get("prepared_by_email") or "").strip() or sales_email
        prep_name = (quotation_data.get("prepared_by_name") or "").strip() or prepared
        prep_phone = (quotation_data.get("prepared_by_phone") or "").strip()

        el: list = []

        cell_h_pad = 5
        page_content_w = doc.width

        # ── Header: brand + QUOTATION title ───────────────────────────
        logo = _logo_flowable(26 * mm, 18 * mm)
        company_lines: list = [Paragraph(f"<b>{escape(str(company).upper())}</b>", s_letter_co)]
        if address:
            company_lines.append(Paragraph(escape(str(address)), s_addr))
        if gst or website:
            gst_web = []
            if gst:
                gst_web.append(f'<font color="#6b7280">GSTIN:</font> {escape(str(gst))}')
            if website:
                if gst_web:
                    gst_web.append(" · ")
                gst_web.append(f'<font color="#6b7280">Web:</font> {escape(str(website))}')
            company_lines.append(Paragraph("".join(gst_web), s_addr))

        brand_w = page_content_w * 0.72
        title_w = page_content_w * 0.28
        if logo:
            brand_cell = Table([[logo, company_lines]], colWidths=[28 * mm, brand_w - 28 * mm])
            brand_cell.setStyle(
                TableStyle(
                    [
                        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                        ("LEFTPADDING", (0, 0), (-1, -1), 0),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                        ("TOPPADDING", (0, 0), (-1, -1), 0),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                    ]
                )
            )
        else:
            brand_cell = company_lines

        header_top = Table(
            [[brand_cell, Paragraph("<b>QUOTATION</b>", s_quotation_title)]],
            colWidths=[brand_w, title_w],
        )
        header_top.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("ALIGN", (1, 0), (1, 0), "RIGHT"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                    ("TOPPADDING", (0, 0), (-1, -1), 0),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                    ("LINEBELOW", (0, 0), (-1, 0), 2.5, _PRIMARY),
                ]
            )
        )
        el.append(header_top)
        el.append(Spacer(1, 3 * mm))

        pdf_ov = quotation_data.get("pdf_display_overrides")
        supplier_names_raw = quotation_data.get("supplier_names")
        supplier_names: list[str] = []
        if isinstance(supplier_names_raw, list):
            supplier_names = [str(n).strip() for n in supplier_names_raw if str(n).strip()]

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
        enq_ref = str(quotation_data.get("enquiry_reference") or "").strip()

        meta_col_w = page_content_w / 3.0
        hl = _pdf_ov_list(pdf_ov, "header_left")
        hr = _pdf_ov_list(pdf_ov, "header_right")
        if hl is not None and hr is not None:
            # Legacy two-column overrides: split across quote + enquiry columns.
            col1_items = [(str(r.get("label") or ""), str(r.get("value") or "")) for r in hr[:3] if isinstance(r, dict)]
            col2_items = [(str(r.get("label") or ""), str(r.get("value") or "")) for r in hr[3:] if isinstance(r, dict)]
            col3_items = [(str(r.get("label") or ""), str(r.get("value") or "")) for r in hl if isinstance(r, dict)]
        else:
            col1_items = [
                ("Quotation No", str(quote_number)),
                ("Date", _format_display_date(q_date_str)),
                ("Valid Until", _format_display_date(valid_until.strftime("%d/%m/%Y"))),
            ]
            col2_items = []
            if enq_num or enq_id:
                col2_items.append(("Enquiry No", str(enq_num or enq_id)))
            if enq_date:
                col2_items.append(("Enquiry Date", _format_display_date(enq_date)))
            if enq_ref:
                col2_items.append(("Enquiry Reference", enq_ref))
            col3_items = [
                ("Quote Owner", str(prep_name)),
            ]
            if prep_phone:
                col3_items.append(("Contact", prep_phone))
            if prep_email:
                col3_items.append(("Email", prep_email))

        meta_strip = Table(
            [
                [
                    _build_meta_col_table(col1_items, meta_col_w, s_meta_l, s_meta_v),
                    _build_meta_col_table(col2_items, meta_col_w, s_meta_l, s_meta_v),
                    _build_meta_col_table(col3_items, meta_col_w, s_meta_l, s_meta_v),
                ]
            ],
            colWidths=[meta_col_w, meta_col_w, meta_col_w],
        )
        meta_strip.setStyle(
            TableStyle(
                [
                    ("BOX", (0, 0), (-1, -1), 0.8, _BORDER),
                    ("INNERGRID", (0, 0), (-1, -1), 0.8, _BORDER),
                    ("BACKGROUND", (0, 0), (-1, -1), _ROW_ALT),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 10),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                    ("TOPPADDING", (0, 0), (-1, -1), 8),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        el.append(meta_strip)
        el.append(Spacer(1, 3 * mm))

        # ── Customer: QUOTATION FOR ───────────────────────────────────
        client_name = quotation_data.get("client_name", "")
        client_company = quotation_data.get("client_company", "")
        client_email = quotation_data.get("client_email", "")
        client_phone = quotation_data.get("client_phone", "")

        co_display = (client_company or client_name or "Customer").strip()
        concern_text = ""
        emp_pdf = quotation_data.get("quotation_client_employee")
        if isinstance(emp_pdf, dict):
            fn = str(emp_pdf.get("full_name") or "").strip()
            if fn:
                des = str(emp_pdf.get("designation") or "").strip()
                concern_text = escape(fn) + (f" · {escape(des)}" if des else "")
        if not concern_text and client_name and client_name.strip() and client_name.strip() != co_display:
            concern_text = escape(client_name.strip())

        cust_left_lines: list = [Paragraph(f"<b>{escape(co_display)}</b>", s_cust_co)]
        extra_co = _pdf_ov_list(pdf_ov, "company_left_extra")
        if extra_co is not None:
            for row in extra_co:
                if isinstance(row, dict):
                    lab = str(row.get("label") or "").strip()
                    val = str(row.get("value") or "").strip()
                    if lab or val:
                        cust_left_lines.append(
                            Paragraph(
                                f'<font color="#6b7280">{escape(lab)}</font> {escape(val)}',
                                s_addr,
                            )
                        )

        cust_right_items: list[tuple[str, str]] = []
        if concern_text:
            cust_right_items.append(("Kind Attn.", concern_text))
        if client_phone:
            cust_right_items.append(("Contact", escape(str(client_phone))))
        if client_email:
            cust_right_items.append(("Email", escape(str(client_email).strip())))

        right_col_w = _table_col_widths(page_content_w, [0.52, 0.48])[1]
        cust_right_block: list = (
            [_build_customer_kv_table(cust_right_items, right_col_w - 14, s_meta_l, s_cust_kv_val)]
            if cust_right_items
            else []
        )

        cust_body = Table(
            [[cust_left_lines, cust_right_block]],
            colWidths=_table_col_widths(page_content_w, [0.52, 0.48]),
        )
        cust_body.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("ALIGN", (1, 0), (1, 0), "LEFT"),
                    ("LEFTPADDING", (0, 0), (0, 0), 10),
                    ("RIGHTPADDING", (1, 0), (1, 0), 10),
                    ("LEFTPADDING", (1, 0), (1, 0), 4),
                    ("RIGHTPADDING", (0, 0), (0, 0), 4),
                    ("TOPPADDING", (0, 0), (-1, -1), 8),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        customer_box = Table(
            [
                [Paragraph("<b>QUOTATION FOR</b>", ParagraphStyle("CustHead", parent=s_section, fontSize=7.5))],
                [cust_body],
            ],
            colWidths=[page_content_w],
        )
        customer_box.setStyle(
            TableStyle(
                [
                    ("BOX", (0, 0), (-1, -1), 0.8, _BORDER),
                    ("BACKGROUND", (0, 0), (-1, 0), _LIGHT_TEAL),
                    ("TEXTCOLOR", (0, 0), (-1, 0), _PRIMARY),
                    ("LEFTPADDING", (0, 0), (-1, 0), 8),
                    ("RIGHTPADDING", (0, 0), (-1, 0), 8),
                    ("TOPPADDING", (0, 0), (-1, 0), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, 0), 4),
                    ("LINEBELOW", (0, 0), (-1, 0), 0.8, _BORDER),
                    ("LEFTPADDING", (0, 1), (-1, 1), 0),
                    ("RIGHTPADDING", (0, 1), (-1, 1), 0),
                    ("TOPPADDING", (0, 1), (-1, 1), 0),
                    ("BOTTOMPADDING", (0, 1), (-1, 1), 0),
                ]
            )
        )
        el.append(customer_box)

        thank_txt = ""
        if isinstance(pdf_ov, dict) and str(pdf_ov.get("thank_you_row") or "").strip():
            thank_txt = str(pdf_ov.get("thank_you_row") or "").strip()
        if thank_txt:
            el.append(Spacer(1, 3 * mm))
            el.append(
                Paragraph(
                    f"<i>{escape(thank_txt)}</i>",
                    ParagraphStyle(
                        "CenterThanks",
                        parent=s_normal,
                        alignment=1,
                        fontSize=8.2,
                        textColor=_MUTED_TEXT,
                    ),
                )
            )
        el.append(Spacer(1, 3 * mm))

        # ── Line items table ──────────────────────────────────────────
        items_col_sum = page_content_w - (2 * cell_h_pad)
        val_col_w = _table_col_widths(items_col_sum, [0.08, 0.42, 0.10, 0.10, 0.11, 0.08, 0.11])

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

        line_items = quotation_data.get("line_items") or []
        if not isinstance(line_items, list):
            line_items = []

        for idx, item in enumerate(line_items, 1):
            if not isinstance(item, dict):
                continue
            row_ov = _line_pdf_override(pdf_ov, idx - 1)
            desc = item.get("product_name") or item.get("description", "")
            if row_ov.get("description"):
                desc = str(row_ov["description"])
            elif row_ov.get("product_name"):
                desc = str(row_ov["product_name"])
            desc = _sanitize_description_for_display(desc, supplier_names)
            size = item.get("size", "")
            if row_ov.get("size"):
                size = str(row_ov["size"])
            qty = item.get("quantity", 1)
            unit = item.get("unit", "Nos")
            price_tbd = bool(item.get("price_tbd"))
            price = float(item.get("unit_price", 0))
            total = float(item.get("line_total") or item.get("total", float(qty) * price))
            disc = item.get("customer_discount_pct")
            try:
                disc_f = float(disc) if disc is not None else 0.0
            except (TypeError, ValueError):
                disc_f = 0.0

            desc_html = _description_paragraph_html(desc, supplier_names)
            qty_cell = f"{escape(str(qty))} {escape(str(unit))}".strip()
            rate_cell = "TBD" if price_tbd else f"{price:,.2f}"
            total_cell = "TBD" if price_tbd else f"{total:,.2f}"
            table_data.append(
                [
                    Paragraph(str(idx), s_cell),
                    Paragraph(desc_html or "—", s_desc),
                    Paragraph(escape(str(size)) if size else "—", s_cell),
                    Paragraph(qty_cell, s_cell),
                    Paragraph(rate_cell, s_cell),
                    Paragraph(f"{disc_f:g}" if disc_f else "0", s_cell),
                    Paragraph(total_cell, s_cell),
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
                desc_html = _description_paragraph_html(desc, supplier_names) if desc != "—" else "—"
                table_data.append(
                    [
                        Paragraph(escape(sr), s_cell),
                        Paragraph(desc_html, s_desc),
                        Paragraph(escape(size), s_cell),
                        Paragraph(escape(qty), s_cell),
                        Paragraph(escape(rate), s_cell),
                        Paragraph(escape(disc), s_cell),
                        Paragraph(escape(tot), s_cell),
                    ]
                )

        if len(table_data) > 1:
            items_table = Table(table_data, colWidths=val_col_w, repeatRows=1, hAlign="LEFT")
            items_table.setStyle(
                TableStyle(
                    [
                        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                        ("FONTSIZE", (0, 0), (-1, -1), 8),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                        ("BACKGROUND", (0, 0), (-1, 0), _PRIMARY),
                        ("ALIGN", (0, 0), (0, -1), "CENTER"),
                        ("ALIGN", (3, 0), (-1, -1), "RIGHT"),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("LINEBELOW", (0, 1), (-1, -1), 0.6, _BORDER),
                        ("LEFTPADDING", (0, 0), (-1, -1), cell_h_pad),
                        ("RIGHTPADDING", (0, 0), (-1, -1), cell_h_pad),
                        ("TOPPADDING", (0, 0), (-1, -1), 6),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                    ]
                )
            )
            el.append(items_table)

        el.append(Spacer(1, 6 * mm))

        # ── Totals (recompute if needed — same logic as before) ──
        item_total = float(quotation_data.get("subtotal", 0))
        gst_amount = float(quotation_data.get("gst_amount", 0))
        pf_amount = float(quotation_data.get("pf_amount", 0))
        total_amount = float(quotation_data.get("total_amount", 0))
        gst_pct = float(quotation_data.get("gst_rate", 18))
        pf_pct = float(quotation_data.get("pf_rate", 3))
        freight = quotation_data.get("freight_note", "Extra at actual")
        freight_amount = float(quotation_data.get("freight_amount", 0) or 0)
        freight_rate = quotation_data.get("freight_rate")

        line_items_for_total = quotation_data.get("line_items") or []
        if (
            isinstance(line_items_for_total, list)
            and line_items_for_total
            and item_total == 0
            and total_amount == 0
        ):
            st = 0.0
            for item in line_items_for_total:
                if not isinstance(item, dict):
                    continue
                if bool(item.get("price_tbd")):
                    continue
                qty = float(item.get("quantity") or 1)
                up = float(item.get("unit_price") or 0)
                lt = item.get("line_total")
                if lt is not None:
                    st += float(lt)
                else:
                    st += float(item.get("total") or qty * up)
            item_total = round(st, 2)
            pf_amount = round(item_total * (pf_pct / 100.0), 2)

        taxable_subtotal = round(item_total + pf_amount + freight_amount, 2)
        gst_amount = round(taxable_subtotal * (gst_pct / 100.0), 2)
        total_amount = round(taxable_subtotal + gst_amount, 2)

        fin_cfg = pdf_ov.get("financial_config") if isinstance(pdf_ov, dict) else None
        cgst_amount = None
        sgst_amount = None
        igst_amount = None
        if isinstance(fin_cfg, dict):
            if fin_cfg.get("cgst_applicable") and fin_cfg.get("cgst_amount") is not None:
                cgst_amount = float(fin_cfg["cgst_amount"])
            if fin_cfg.get("sgst_applicable") and fin_cfg.get("sgst_amount") is not None:
                sgst_amount = float(fin_cfg["sgst_amount"])
            if fin_cfg.get("igst_applicable") and fin_cfg.get("igst_amount") is not None:
                igst_amount = float(fin_cfg["igst_amount"])
            tax_sum = (cgst_amount or 0) + (sgst_amount or 0) + (igst_amount or 0)
            if tax_sum > 0:
                gst_amount = round(tax_sum, 2)
                total_amount = round(taxable_subtotal + gst_amount, 2)

        # ── Terms + Financial summary side-by-side ────────────────
        ti = None
        if isinstance(pdf_ov, dict):
            ti = pdf_ov.get("terms_items")
        if isinstance(ti, list) and ti:
            terms_body = [str(x).strip() for x in ti if str(x).strip()]
        else:
            terms_body = [
                "Any modification to agreed specifications may attract additional commercial charges.",
                f"Prices are <b>Ex-works {escape(str(company))}, Pune</b>.",
                f"<b>GST</b> @ {gst_pct:g}% extra · <b>P&amp;F</b> @ {pf_pct:g}% extra.",
                (
                    f"<b>Freight</b> @ {float(freight_rate):g}% — included in valuation total as shown below."
                    if freight_amount > 0 and freight_rate is not None
                    else (
                        f"<b>Freight</b> — to-pay / door delivery, charges in customer's scope."
                        if freight_amount <= 0
                        else f"<b>Freight</b> — {_money_text(freight_amount)} included in valuation total as shown below."
                    )
                ),
                "<b>Warranty:</b> 12 months from date of invoice, against manufacturing defects only.",
                "Third-party inspection, if required — extra at actual and in customer's scope.",
                f"<b>Offer validity:</b> up to {validity_days} days from date of issue.",
                "Subject to <b>Pune jurisdiction</b> only.",
            ]
        terms_flow: list = [Paragraph("<b>TERMS &amp; CONDITIONS</b>", s_section)]
        for i, tb in enumerate(terms_body, 1):
            terms_flow.append(Paragraph(f"{i}. {tb}", s_terms))

        terms_left_w, terms_right_w = _table_col_widths(page_content_w, [0.60, 0.40])
        fin_edge_pad = 4
        fin_col_sum = terms_right_w - (2 * fin_edge_pad)
        fin_col_w = _table_col_widths(fin_col_sum, [0.62, 0.38])

        fin_rows: list[list] = [
            [Paragraph("Sub Total", s_cell), Paragraph(_money_text(item_total), s_cell)],
            [
                Paragraph(f"P &amp; F Charges ({pf_pct:g}%)", s_cell),
                Paragraph(_money_text(pf_amount), s_cell),
            ],
        ]
        if freight_amount > 0:
            if freight_rate is not None:
                freight_label = f"Freight Charges ({float(freight_rate):g} %)"
                freight_value = _money_text(freight_amount)
            else:
                freight_label = "Freight Charges"
                freight_value = _money_text(freight_amount)
        else:
            freight_label = "Freight Charges"
            freight_value = escape(str(freight or "To-pay"))
        fin_rows.append([Paragraph(freight_label, s_cell), Paragraph(freight_value, s_cell)])
        fin_rows.append([Paragraph("Other Charges", s_cell), Paragraph(_money_text(0), s_cell)])
        pre_gst_idx = len(fin_rows)
        fin_rows.append(
            [
                Paragraph("<b>Total before GST</b>", s_cell),
                Paragraph(f"<b>{_money_text(taxable_subtotal)}</b>", s_cell),
            ]
        )
        if isinstance(fin_cfg, dict) and fin_cfg.get("igst_applicable") and (igst_amount or 0) > 0:
            igst_rate = fin_cfg.get("igst_rate")
            igst_label = f"IGST @ {float(igst_rate):g}%" if igst_rate is not None else "IGST"
            fin_rows.append([Paragraph(igst_label, s_cell), Paragraph(_money_text(igst_amount or 0), s_cell)])
            fin_rows.append([Paragraph("CGST @ 0%", s_cell), Paragraph(_money_text(0), s_cell)])
            fin_rows.append([Paragraph("SGST @ 0%", s_cell), Paragraph(_money_text(0), s_cell)])
        elif isinstance(fin_cfg, dict) and (
            fin_cfg.get("cgst_applicable") or fin_cfg.get("sgst_applicable")
        ):
            if fin_cfg.get("cgst_applicable") and (cgst_amount or 0) > 0:
                fin_rows.append([Paragraph("CGST @ 9%", s_cell), Paragraph(_money_text(cgst_amount or 0), s_cell)])
            if fin_cfg.get("sgst_applicable") and (sgst_amount or 0) > 0:
                fin_rows.append([Paragraph("SGST @ 9%", s_cell), Paragraph(_money_text(sgst_amount or 0), s_cell)])
            fin_rows.append([Paragraph("IGST @ 0%", s_cell), Paragraph(_money_text(0), s_cell)])
        elif abs(gst_pct - 18.0) < 0.01 and gst_amount > 0:
            half = round(gst_amount / 2.0, 2)
            other = round(gst_amount - half, 2)
            fin_rows.append([Paragraph("CGST @ 9%", s_cell), Paragraph(_money_text(half), s_cell)])
            fin_rows.append([Paragraph("SGST @ 9%", s_cell), Paragraph(_money_text(other), s_cell)])
            fin_rows.append([Paragraph("IGST @ 0%", s_cell), Paragraph(_money_text(0), s_cell)])
        else:
            fin_rows.append(
                [Paragraph(f"GST ({gst_pct:g} %)", s_cell), Paragraph(_money_text(gst_amount), s_cell)]
            )
        grand_idx = len(fin_rows)
        fin_rows.append(
            [
                Paragraph("<b>GRAND TOTAL (INR)</b>", ParagraphStyle("GrandL", parent=s_cell, fontName="Helvetica-Bold", textColor=colors.white)),
                Paragraph(
                    f"<b>{escape(_money_text(total_amount))}</b>",
                    ParagraphStyle("GrandV", parent=s_cell, fontName="Helvetica-Bold", textColor=colors.white, alignment=TA_RIGHT),
                ),
            ]
        )
        fin_header = Paragraph("<b>VALUATION SUMMARY</b>", s_section)
        fin_tbl = Table(fin_rows, colWidths=fin_col_w, hAlign="LEFT")
        fin_tbl.setStyle(
            TableStyle(
                [
                    ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ("LEFTPADDING", (0, 0), (-1, -1), fin_edge_pad),
                    ("RIGHTPADDING", (0, 0), (-1, -1), fin_edge_pad),
                    ("LINEABOVE", (0, pre_gst_idx), (-1, pre_gst_idx), 0.8, _BORDER),
                    ("BACKGROUND", (0, pre_gst_idx), (-1, pre_gst_idx), _PRE_GST_BG),
                    ("BACKGROUND", (0, grand_idx), (-1, grand_idx), _PRIMARY),
                    ("TEXTCOLOR", (0, grand_idx), (-1, grand_idx), colors.white),
                ]
            )
        )
        totals_flow = [fin_header, fin_tbl]
        terms_summary = Table([[terms_flow, totals_flow]], colWidths=[terms_left_w, terms_right_w])
        terms_summary.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                    ("TOPPADDING", (0, 0), (-1, -1), 0),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ]
            )
        )
        el.append(terms_summary)

        el.append(Spacer(1, 3 * mm))
        words_para = Paragraph(
            (
                f'<font color="#6b7280"><b>AMOUNT IN WORDS:</b></font> '
                f'<b>{escape(_amount_in_words_inr(total_amount))}</b>'
            ),
            ParagraphStyle("Words", parent=s_terms, fontSize=8, leading=11, leftIndent=0),
        )
        words_tbl = Table([[words_para]], colWidths=[page_content_w])
        words_tbl.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fafbf9")),
                    ("LINEBEFORE", (0, 0), (0, -1), 3, _PRIMARY),
                    ("LEFTPADDING", (0, 0), (-1, -1), 10),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ]
            )
        )
        el.append(words_tbl)

        el.append(Spacer(1, 3 * mm))
        payment_terms = str(client_config.get("payment_terms") or "").strip()
        delivery_period = str(client_config.get("delivery_period") or "").strip()
        if isinstance(pdf_ov, dict):
            if str(pdf_ov.get("payment_terms") or "").strip():
                payment_terms = str(pdf_ov.get("payment_terms") or "").strip()
            if str(pdf_ov.get("delivery_period") or "").strip():
                delivery_period = str(pdf_ov.get("delivery_period") or "").strip()
        paydel_cells: list = []
        paydel_style = ParagraphStyle("PayDel", parent=s_terms, fontSize=7.7, leading=10)
        if payment_terms:
            paydel_cells.append(
                Paragraph(
                    f'<b><font color="#0F6E56">PAYMENT TERMS</font></b><br/>{escape(payment_terms)}',
                    paydel_style,
                )
            )
        if delivery_period:
            paydel_cells.append(
                Paragraph(
                    f'<b><font color="#0F6E56">DELIVERY PERIOD</font></b><br/>{escape(delivery_period)}',
                    paydel_style,
                )
            )
        if paydel_cells:
            while len(paydel_cells) < 2:
                paydel_cells.append(Paragraph("", paydel_style))
            paydel_w = page_content_w / 2.0 - 3
            paydel_tbl = Table([[paydel_cells[0], paydel_cells[1]]], colWidths=[paydel_w, paydel_w])
            paydel_tbl.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, -1), _LIGHT_TEAL),
                        ("BOX", (0, 0), (-1, -1), 0.8, _LIGHT_TEAL_BORDER),
                        ("INNERGRID", (0, 0), (-1, -1), 0.8, _LIGHT_TEAL_BORDER),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("LEFTPADDING", (0, 0), (-1, -1), 10),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                        ("TOPPADDING", (0, 0), (-1, -1), 6),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                    ]
                )
            )
            el.append(paydel_tbl)

        bank_rows = _bank_details_rows(client_config)
        if bank_rows:
            el.append(Spacer(1, 3 * mm))
            bank_cells: list[list] = []
            row_buf: list = []
            col_w = page_content_w / 3.0
            for label, value in bank_rows:
                cell = Paragraph(
                    f'<font color="#6b7280">{escape(label)}</font><br/><b>{escape(value)}</b>',
                    ParagraphStyle("BankCell", parent=s_terms, fontSize=7.6, leading=11),
                )
                row_buf.append(cell)
                if len(row_buf) == 3:
                    bank_cells.append(row_buf)
                    row_buf = []
            if row_buf:
                while len(row_buf) < 3:
                    row_buf.append(Paragraph("", s_terms))
                bank_cells.append(row_buf)
            bank_grid = Table(bank_cells, colWidths=[col_w, col_w, col_w])
            bank_grid.setStyle(
                TableStyle(
                    [
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("LEFTPADDING", (0, 0), (-1, -1), 0),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                        ("TOPPADDING", (0, 0), (-1, -1), 4),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ]
                )
            )
            bank_box = Table(
                [
                    [Paragraph("<b>BANK DETAILS</b>", s_section)],
                    [bank_grid],
                ],
                colWidths=[page_content_w],
            )
            bank_box.setStyle(
                TableStyle(
                    [
                        ("BOX", (0, 0), (-1, -1), 0.8, _BORDER),
                        ("LEFTPADDING", (0, 0), (-1, -1), 10),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                        ("TOPPADDING", (0, 0), (0, 0), 6),
                        ("BOTTOMPADDING", (0, 0), (0, 0), 4),
                        ("TOPPADDING", (0, 1), (0, 1), 0),
                        ("BOTTOMPADDING", (0, 1), (0, 1), 8),
                    ]
                )
            )
            el.append(bank_box)

        # ── Notes ──
        notes = quotation_data.get("professional_notes") or quotation_data.get("notes", "")
        if isinstance(pdf_ov, dict) and "notes" in pdf_ov:
            notes = str(pdf_ov.get("notes") or "")
        if notes:
            el.append(Spacer(1, 2 * mm))
            note_tbl = Table(
                [[Paragraph("<b>Notes</b>", s_section)], [Paragraph(escape(str(notes)), s_terms)]],
                colWidths=[_edge_padded_col_sum(page_content_w, 6)],
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
        contact_line = ""
        if isinstance(pdf_ov, dict) and str(pdf_ov.get("footer_contact") or "").strip():
            contact_line = escape(str(pdf_ov.get("footer_contact") or "").strip())
        if contact_line:
            el.append(Paragraph(contact_line, ParagraphStyle("Contact", parent=s_normal, fontSize=8.5)))
            el.append(Spacer(1, 4 * mm))
        thanks_line = "Thank You For Your Business!"
        if isinstance(pdf_ov, dict) and str(pdf_ov.get("footer_thanks") or "").strip():
            thanks_line = str(pdf_ov.get("footer_thanks") or "").strip()
        el.append(Paragraph(f"<b>{escape(thanks_line)}</b>", s_thanks))
        el.append(Spacer(1, 8 * mm))
        disc_line = "Ai quotation powered by ClevrScan"
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
