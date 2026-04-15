"""PDF generation logic using ReportLab.

Pure service — no FastAPI imports, no HTTP concerns.
Takes quotation data and client config, returns file path.
"""

import logging
from datetime import date, timedelta
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from core.config import get_settings

logger = logging.getLogger(__name__)

_DARK = colors.HexColor("#2c3e50")
_LIGHT_GRAY = colors.HexColor("#f5f5f5")
_MID_GRAY = colors.HexColor("#888888")


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

        doc = SimpleDocTemplate(
            str(filepath),
            pagesize=A4,
            rightMargin=15 * mm,
            leftMargin=15 * mm,
            topMargin=15 * mm,
            bottomMargin=15 * mm,
        )

        styles = getSampleStyleSheet()
        s_company = ParagraphStyle("Company", parent=styles["Heading1"], fontSize=16, alignment=1, spaceAfter=2)
        s_sub = ParagraphStyle("Sub", parent=styles["Normal"], fontSize=8, alignment=1, spaceAfter=1, textColor=_MID_GRAY)
        s_title = ParagraphStyle("Title", parent=styles["Heading1"], fontSize=18, alignment=1, spaceAfter=4)
        s_normal = styles["Normal"]
        s_small = ParagraphStyle("Small", parent=s_normal, fontSize=8, textColor=_MID_GRAY)
        s_bold = ParagraphStyle("Bold", parent=s_normal, fontName="Helvetica-Bold")
        s_section = ParagraphStyle("Section", parent=styles["Heading3"], fontSize=11, spaceBefore=8, spaceAfter=4)

        company = client_config.get("company_name", "PARTH VALVES AND HOSES LLP")
        address = client_config.get("address", "")
        phone = client_config.get("phone", "")
        email = client_config.get("email", "")
        gst = client_config.get("gst_number", "")

        el: list = []

        # --- HEADER ---
        el.append(Paragraph(f"<b>{company.upper()}</b>", s_company))
        el.append(Paragraph(address, s_sub))
        el.append(Paragraph(f"Phone: {phone}  |  Email: {email}  |  GST: {gst}", s_sub))
        el.append(Spacer(1, 2 * mm))
        el.append(HRFlowable(width="100%", thickness=1, color=_DARK))
        el.append(Spacer(1, 4 * mm))
        el.append(Paragraph("<b>QUOTATION</b>", s_title))

        today = date.today()
        validity_days = int(quotation_data.get("validity_days", 15))
        valid_until = today + timedelta(days=validity_days)

        meta_data = [
            [f"Quote No: {quote_number}", f"Date: {today.strftime('%d-%b-%Y')}"],
            [f"Valid for {validity_days} days from date of issue", f"Valid Until: {valid_until.strftime('%d-%b-%Y')}"],
        ]
        meta_table = Table(meta_data, colWidths=[270, 270])
        meta_table.setStyle(TableStyle([
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ALIGN", (1, 0), (1, -1), "RIGHT"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ]))
        el.append(meta_table)
        el.append(Spacer(1, 4 * mm))

        # --- CLIENT SECTION ---
        client_name = quotation_data.get("client_name", "")
        client_company = quotation_data.get("client_company", "")
        client_email = quotation_data.get("client_email", "")
        client_phone = quotation_data.get("client_phone", "")

        el.append(Paragraph("<b>To:</b>", s_bold))
        to_lines = []
        if client_name:
            to_lines.append(client_name)
        if client_company:
            to_lines.append(client_company)
        if client_email:
            to_lines.append(f"Email: {client_email}")
        if client_phone:
            to_lines.append(f"Phone: {client_phone}")
        if to_lines:
            el.append(Paragraph("<br/>".join(to_lines), s_normal))
        el.append(Spacer(1, 5 * mm))

        # --- ITEMS TABLE ---
        line_items = quotation_data.get("line_items", [])
        header = ["Sr No", "Description", "Size", "Qty", "Unit", "Unit Price (₹)", "Total (₹)"]
        table_data = [header]

        for idx, item in enumerate(line_items, 1):
            desc = item.get("product_name") or item.get("description", "")
            size = item.get("size", "")
            qty = item.get("quantity", 1)
            unit = item.get("unit", "Nos")
            price = float(item.get("unit_price", 0))
            total = float(item.get("line_total") or item.get("total", qty * price))
            table_data.append([
                str(idx), str(desc), str(size), str(qty), str(unit),
                f"{price:,.2f}", f"{total:,.2f}",
            ])

        if len(table_data) > 1:
            col_w = [30, 175, 55, 30, 30, 70, 70]
            items_table = Table(table_data, colWidths=col_w, repeatRows=1)
            items_table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), _DARK),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 8),
                ("FONTSIZE", (0, 1), (-1, -1), 8),
                ("ALIGN", (3, 0), (-1, -1), "RIGHT"),
                ("ALIGN", (0, 0), (0, -1), "CENTER"),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, _LIGHT_GRAY]),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]))
            el.append(items_table)

        el.append(Spacer(1, 5 * mm))

        # --- TOTALS SECTION ---
        subtotal = float(quotation_data.get("subtotal", 0))
        gst_amount = float(quotation_data.get("gst_amount", 0))
        pf_amount = float(quotation_data.get("pf_amount", 0))
        total_amount = float(quotation_data.get("total_amount", 0))
        gst_pct = float(quotation_data.get("gst_rate", 18))
        pf_pct = float(quotation_data.get("pf_rate", 3))
        freight = quotation_data.get("freight_note", "Extra at actual")

        # If rollups missing but line items exist, match quote_agent math
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

        summary_data = [
            ["Subtotal:", f"₹{subtotal:,.2f}"],
            [f"GST @ {gst_pct:g}%:", f"₹{gst_amount:,.2f}"],
            [f"P&F @ {pf_pct:g}%:", f"₹{pf_amount:,.2f}"],
            ["Freight:", str(freight)],
        ]
        summary = Table(summary_data, colWidths=[120, 110], hAlign="RIGHT")
        summary.setStyle(TableStyle([
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ALIGN", (1, 0), (1, -1), "RIGHT"),
            ("TOPPADDING", (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ]))
        el.append(summary)

        el.append(HRFlowable(width="42%", thickness=1, color=_DARK, hAlign="RIGHT"))

        total_row = Table(
            [["TOTAL:", f"₹{total_amount:,.2f}"]],
            colWidths=[120, 110],
            hAlign="RIGHT",
        )
        total_row.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 11),
            ("ALIGN", (1, 0), (1, 0), "RIGHT"),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]))
        el.append(total_row)
        el.append(Spacer(1, 6 * mm))

        # --- TERMS SECTION ---
        el.append(Paragraph("<b>Terms &amp; Conditions:</b>", s_section))
        terms = [
            "1. GST 18% extra (included in total above).",
            "2. P&amp;F 3% extra (included in total above).",
            "3. Freight: Extra at actual.",
            "4. Payment: 50% advance and 50% against Proforma Invoice.",
            "5. MTC: Parth will provide all Material Test Certificates.",
            f"6. Quotation validity: {validity_days} days from date of issue.",
        ]
        for t in terms:
            el.append(Paragraph(t, ParagraphStyle("Term", parent=s_normal, fontSize=8, spaceBefore=1)))

        # --- NOTES ---
        notes = quotation_data.get("professional_notes") or quotation_data.get("notes", "")
        if notes:
            el.append(Spacer(1, 4 * mm))
            el.append(Paragraph("<b>Notes:</b>", s_bold))
            el.append(Paragraph(str(notes), ParagraphStyle("Notes", parent=s_normal, fontSize=8)))

        el.append(Spacer(1, 10 * mm))
        el.append(HRFlowable(width="100%", thickness=0.5, color=_MID_GRAY))
        el.append(Spacer(1, 4 * mm))

        # --- FOOTER ---
        el.append(Paragraph(
            "Thank you for your enquiry. We look forward to your business.",
            ParagraphStyle("Footer", parent=s_normal, fontSize=9, alignment=1),
        ))
        el.append(Spacer(1, 6 * mm))
        el.append(Paragraph(f"<b>For {company}</b>", s_bold))
        el.append(Spacer(1, 12 * mm))
        el.append(Paragraph("Authorised Signatory", s_normal))
        el.append(Spacer(1, 6 * mm))
        el.append(Paragraph(
            "<i>This quotation was prepared with AI assistance and reviewed by our team.</i>",
            ParagraphStyle("AI", parent=s_normal, fontSize=7, textColor=_MID_GRAY, alignment=1),
        ))

        doc.build(el)
        logger.info("PDF generated: %s", filepath)
        return str(filepath)

    except Exception as e:
        logger.error("PDF generation failed: %s", e)
        return None
