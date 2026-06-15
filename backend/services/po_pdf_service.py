"""Purchase order PDF generation (cream-themed, quotation-inspired layout)."""

from __future__ import annotations

import logging
from datetime import date
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from core.config import get_settings
from services.pdf_service import (
    _BORDER,
    _DARK_GREEN,
    _DARK_NAVY,
    _MID_GRAY,
    _description_paragraph_html,
    _edge_padded_col_sum,
    _logo_flowable,
    _make_footer_canvas_fn,
    _money_text,
    _sanitize_description_for_display,
    _table_col_widths,
)

logger = logging.getLogger(__name__)

_PO_CREAM = colors.HexColor("#FFF8E7")
_PO_CREAM_ALT = colors.HexColor("#FDF6E3")
_PO_ACCENT = colors.HexColor("#B8860B")


async def generate_purchase_order_pdf(
    po_data: dict,
    client_config: dict | str,
) -> str | None:
    try:
        settings = get_settings()
        if isinstance(client_config, str):
            client_config = settings.get_client_json()

        output_dir = Path(settings.PDF_OUTPUT_DIR)
        output_dir.mkdir(parents=True, exist_ok=True)

        po_number = po_data.get("po_number", "PO-DRAFT")
        filepath = output_dir / f"{po_number}.pdf"

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
            "POAddr",
            parent=s_normal,
            fontSize=8,
            leading=10,
            textColor=colors.black,
            alignment=TA_LEFT,
        )
        s_letter_co = ParagraphStyle(
            "POLetterCo",
            parent=s_normal,
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=13,
            textColor=_DARK_GREEN,
            spaceAfter=1,
        )
        s_title = ParagraphStyle(
            "POTitle",
            parent=s_normal,
            fontName="Helvetica-Bold",
            fontSize=14,
            leading=16,
            textColor=_DARK_NAVY,
            spaceBefore=2,
            spaceAfter=3,
        )
        s_section = ParagraphStyle(
            "POSection",
            parent=s_normal,
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=12,
            textColor=_DARK_NAVY,
            spaceBefore=8,
            spaceAfter=4,
        )
        s_cust_co = ParagraphStyle(
            "POCustCo",
            parent=s_normal,
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=12,
        )
        s_meta_val = ParagraphStyle("POMetaV", parent=s_normal, fontSize=8)
        s_cell = ParagraphStyle("POCell", parent=s_normal, fontSize=7.5, leading=10)
        s_cell_head = ParagraphStyle("POCellH", parent=s_normal, fontName="Helvetica-Bold", fontSize=7.5, leading=10)
        s_desc = ParagraphStyle("PODescCell", parent=s_cell, fontSize=7.5, leading=10)
        s_thanks = ParagraphStyle("POThanks", parent=s_normal, fontSize=9, alignment=1, textColor=_DARK_GREEN)

        company = client_config.get("company_name", "PARTH VALVES AND HOSES LLP")
        address = client_config.get("address", "")
        phone = client_config.get("phone", "")
        email = client_config.get("email", "")
        sales_email = client_config.get("sales_email") or email
        prepared = client_config.get("prepared_by", "Sales Team")
        prep_email = (po_data.get("prepared_by_email") or "").strip() or sales_email
        prep_name = (po_data.get("prepared_by_name") or "").strip() or prepared

        el: list = []
        box_h_pad = 8
        header_h_pad = 6
        cell_h_pad = 5
        page_content_w = doc.width

        logo = _logo_flowable(52 * mm, 30 * mm)
        title_cell = [
            Paragraph(f"<b>{escape(str(company).upper())}</b>", s_letter_co),
            Paragraph("<b>PURCHASE ORDER</b>", s_title),
        ]
        logo_w = 52 * mm
        if logo:
            header_top = Table([[logo, title_cell]], colWidths=[logo_w, page_content_w - logo_w - (2 * header_h_pad)])
        else:
            header_top = Table([[title_cell]], colWidths=[_edge_padded_col_sum(page_content_w, header_h_pad)])

        header_top.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), _PO_CREAM),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("ALIGN", (1, 0), (1, 0), "CENTER"),
                    ("LEFTPADDING", (0, 0), (-1, -1), header_h_pad),
                    ("RIGHTPADDING", (0, 0), (-1, -1), header_h_pad),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ]
            )
        )

        po_date = po_data.get("po_date") or date.today().strftime("%d/%m/%Y")
        quote_number = po_data.get("quote_number")
        left_info = []
        if address:
            left_info.append(Paragraph(f"<b>Address</b> : {escape(str(address))}", s_addr))
        if prep_email:
            left_info.append(Paragraph(f"<b>E-Mail</b> : {escape(str(prep_email))}", s_addr))
        left_info.append(Paragraph(f"<b>Prepared By</b> : {escape(str(prep_name))}", s_addr))

        right_info = [
            Paragraph(f"<b>Date</b> : {escape(str(po_date))}", s_meta_val),
            Paragraph(f"<b>PO No</b> : {escape(str(po_number))}", s_meta_val),
        ]
        if quote_number:
            right_info.append(
                Paragraph(f"<b>Quote Ref</b> : {escape(str(quote_number))}", s_meta_val)
            )

        header_info_inner = _edge_padded_col_sum(page_content_w, header_h_pad)
        header_info = Table(
            [[left_info, right_info]],
            colWidths=_table_col_widths(header_info_inner, [0.52, 0.48]),
        )
        header_info.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), _PO_CREAM),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LINEABOVE", (0, 0), (-1, 0), 1, _BORDER),
                    ("LEFTPADDING", (0, 0), (-1, -1), header_h_pad),
                    ("RIGHTPADDING", (0, 0), (-1, -1), header_h_pad),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ]
            )
        )

        header_box = Table([[header_top], [header_info]], colWidths=[page_content_w])
        header_box.setStyle(
            TableStyle(
                [
                    ("BOX", (0, 0), (-1, -1), 1, _BORDER),
                    ("BACKGROUND", (0, 0), (-1, -1), _PO_CREAM),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ]
            )
        )
        el.append(header_box)
        el.append(Spacer(1, 4 * mm))

        client_name = po_data.get("client_name", "")
        client_company = po_data.get("client_company", "")
        client_email = po_data.get("client_email", "")
        client_phone = po_data.get("client_phone", "")

        cust_left: list = [Paragraph("<b>COMPANY</b>", s_section)]
        co_display = (client_company or client_name or "Customer").strip()
        cust_left.append(Paragraph(escape(co_display), s_cust_co))

        concern_text = ""
        emp_pdf = po_data.get("quotation_client_employee")
        if isinstance(emp_pdf, dict):
            fn = str(emp_pdf.get("full_name") or "").strip()
            if fn:
                des = str(emp_pdf.get("designation") or "").strip()
                concern_text = escape(fn) + (f" · {escape(des)}" if des else "")
        if not concern_text and client_name and client_name.strip() != co_display:
            concern_text = escape(client_name.strip())

        cust_right: list = []
        if concern_text:
            cust_right.append(Paragraph(f"<b>Concern Person</b> : {concern_text}", s_addr))
        if client_phone:
            cust_right.append(Paragraph(f"<b>Contact No.</b> : {escape(str(client_phone))}", s_addr))
        if client_email:
            cust_right.append(Paragraph(f"<b>E-Mail</b> : {escape(str(client_email))}", s_addr))

        company_inner = _edge_padded_col_sum(page_content_w, box_h_pad)
        company_tbl = Table(
            [[cust_left, cust_right]],
            colWidths=_table_col_widths(company_inner, [0.52, 0.48]),
        )
        company_tbl.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), _PO_CREAM_ALT),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("BOX", (0, 0), (-1, -1), 1, _BORDER),
                    ("LINEBEFORE", (1, 0), (1, 0), 1, _BORDER),
                    ("LEFTPADDING", (0, 0), (-1, -1), box_h_pad),
                    ("RIGHTPADDING", (0, 0), (-1, -1), box_h_pad),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        el.append(company_tbl)
        el.append(Spacer(1, 4 * mm))

        block_col_w = _edge_padded_col_sum(page_content_w, box_h_pad)
        items_col_sum = block_col_w - (2 * box_h_pad) - (2 * cell_h_pad)
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
        line_items = po_data.get("line_items") or []
        if not isinstance(line_items, list):
            line_items = []

        for idx, item in enumerate(line_items, 1):
            if not isinstance(item, dict):
                continue
            desc = _sanitize_description_for_display(item.get("product_name") or item.get("description", ""))
            size = item.get("size", "")
            qty = item.get("quantity", 1)
            unit = item.get("unit", "Nos")
            price = float(item.get("unit_price", 0))
            total = float(item.get("line_total") or item.get("total", float(qty) * price))
            disc = item.get("customer_discount_pct")
            try:
                disc_f = float(disc) if disc is not None else 0.0
            except (TypeError, ValueError):
                disc_f = 0.0
            table_data.append(
                [
                    Paragraph(str(idx), s_cell),
                    Paragraph(_description_paragraph_html(desc) or "—", s_desc),
                    Paragraph(escape(str(size)) if size else "—", s_cell),
                    Paragraph(f"{escape(str(qty))} {escape(str(unit))}".strip(), s_cell),
                    Paragraph(f"{price:,.2f}", s_cell),
                    Paragraph(f"{disc_f:g}" if disc_f else "0", s_cell),
                    Paragraph(f"{total:,.2f}", s_cell),
                ]
            )

        if len(table_data) > 1:
            items_table = Table(table_data, colWidths=val_col_w, repeatRows=1)
            items_table.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), _PO_CREAM),
                        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                        ("ALIGN", (0, 0), (0, -1), "CENTER"),
                        ("ALIGN", (3, 0), (-1, -1), "RIGHT"),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("GRID", (0, 0), (-1, -1), 0.6, _BORDER),
                        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [_PO_CREAM_ALT, colors.white]),
                        ("LEFTPADDING", (0, 0), (-1, -1), cell_h_pad),
                        ("RIGHTPADDING", (0, 0), (-1, -1), cell_h_pad),
                        ("TOPPADDING", (0, 0), (-1, -1), 6),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                    ]
                )
            )
            valuation_block = Table(
                [[Paragraph("<b>ORDER DETAILS</b>", s_section)], [items_table]],
                colWidths=[block_col_w],
            )
            valuation_block.setStyle(
                TableStyle(
                    [
                        ("BOX", (0, 0), (-1, -1), 1, _BORDER),
                        ("BACKGROUND", (0, 0), (-1, -1), _PO_CREAM_ALT),
                        ("LEFTPADDING", (0, 0), (-1, -1), box_h_pad),
                        ("RIGHTPADDING", (0, 0), (-1, -1), box_h_pad),
                    ]
                )
            )
            el.append(valuation_block)

        el.append(Spacer(1, 6 * mm))

        item_total = float(po_data.get("subtotal", 0))
        pf_amount = float(po_data.get("pf_amount", 0))
        pf_pct = float(po_data.get("pf_rate", 3))
        freight_amount = float(po_data.get("freight_amount", 0) or 0)
        freight_rate = po_data.get("freight_rate")
        freight = po_data.get("freight_note", "")
        gst_amount = float(po_data.get("gst_amount", 0))
        total_amount = float(po_data.get("total_amount", 0))
        taxable_subtotal = round(item_total + pf_amount + freight_amount, 2)

        fin_cfg = po_data.get("financial_config") if isinstance(po_data.get("financial_config"), dict) else {}
        cgst_amount = fin_cfg.get("cgst_amount")
        sgst_amount = fin_cfg.get("sgst_amount")
        igst_amount = fin_cfg.get("igst_amount")

        fin_edge_pad = 4
        fin_w = page_content_w * 0.42
        fin_col_sum = fin_w - (2 * fin_edge_pad)
        fin_col_w = _table_col_widths(fin_col_sum, [0.62, 0.38])

        fin_rows: list[list] = [
            [Paragraph("<b>ITEM TOTAL</b>", s_cell_head), Paragraph(_money_text(item_total), s_cell)],
            [
                Paragraph(f"<b>P &amp; F</b> ({pf_pct:g} %)", s_cell_head),
                Paragraph(_money_text(pf_amount), s_cell),
            ],
        ]
        if freight_amount > 0:
            fl = f"<b>FREIGHT</b> ({float(freight_rate):g} %)" if freight_rate else "<b>FREIGHT</b>"
            fin_rows.append([Paragraph(fl, s_cell_head), Paragraph(_money_text(freight_amount), s_cell)])
        else:
            fin_rows.append(
                [
                    Paragraph("<b>FREIGHT</b>", s_cell_head),
                    Paragraph(escape(str(freight or "—")), s_cell),
                ]
            )
        fin_rows.append(
            [Paragraph("<b>SUB TOTAL</b>", s_cell_head), Paragraph(_money_text(taxable_subtotal), s_cell)]
        )
        if fin_cfg.get("igst_applicable") and (igst_amount or 0) > 0:
            fin_rows.append(
                [Paragraph("<b>IGST</b>", s_cell_head), Paragraph(_money_text(float(igst_amount or 0)), s_cell)]
            )
        else:
            if fin_cfg.get("cgst_applicable", True) and (cgst_amount or gst_amount / 2) > 0:
                fin_rows.append(
                    [
                        Paragraph("<b>CGST</b> (9 %)", s_cell_head),
                        Paragraph(_money_text(float(cgst_amount or gst_amount / 2)), s_cell),
                    ]
                )
            if fin_cfg.get("sgst_applicable", True) and (sgst_amount or gst_amount / 2) > 0:
                fin_rows.append(
                    [
                        Paragraph("<b>SGST</b> (9 %)", s_cell_head),
                        Paragraph(_money_text(float(sgst_amount or gst_amount / 2)), s_cell),
                    ]
                )
        fin_rows.append(
            [
                Paragraph("<b>GRAND TOTAL INR</b>", s_cell_head),
                Paragraph(f"<b>{_money_text(total_amount)}</b>", s_cell),
            ]
        )

        fin_table = Table(fin_rows, colWidths=fin_col_w)
        fin_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), _PO_CREAM),
                    ("GRID", (0, 0), (-1, -1), 0.6, _BORDER),
                    ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                    ("BACKGROUND", (0, -1), (-1, -1), _PO_ACCENT),
                    ("LEFTPADDING", (0, 0), (-1, -1), fin_edge_pad),
                    ("RIGHTPADDING", (0, 0), (-1, -1), fin_edge_pad),
                ]
            )
        )
        fin_wrap = Table([[fin_table]], colWidths=[fin_w], hAlign="RIGHT")
        el.append(fin_wrap)

        el.append(Spacer(1, 8 * mm))
        contact_line = f"If you have any questions about this order, please contact {prep_name}, {phone}, {prep_email}."
        el.append(Paragraph(contact_line, ParagraphStyle("POContact", parent=s_normal, fontSize=8.5)))
        el.append(Spacer(1, 4 * mm))
        el.append(Paragraph("<b>Thank You For Your Business !</b>", s_thanks))

        doc.build(el, onFirstPage=_make_footer_canvas_fn(footer_ref), onLaterPages=_make_footer_canvas_fn(footer_ref))
        return str(filepath)
    except Exception as exc:
        logger.exception("PO PDF generation failed: %s", exc)
        return None
