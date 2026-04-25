"""ERP Enquiry List Excel export (Sheet1) using the provided template headers.

This module is intentionally standalone from ERP connectivity: it just produces
the Excel file on disk so humans can import into ERP.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import openpyxl
from openpyxl.styles import Alignment, Font, PatternFill


# Exact column headers from template Sheet1
ENQUIRY_HEADERS = [
    "Series ",  # A — trailing space intentional
    "PrefixString",  # B
    "Enquiry No.",  # C
    "Cust Code",  # D
    "Customer Name",  # E
    "Enquiry Date",  # F
    "Source",  # G
    "Priority",  # H
    "Referred By",  # I
    "Attended By",  # J
    "Remarks",  # K
    "Status",  # L
    "Followup Date",  # M
    "Followup Time",  # N
    "Contact Person Name",  # O
    "Contact No.",  # P
    "Email Id",  # Q
    "Ref. No",  # R
    "Ref. Date",  # S
    "ShipToAddCode",  # T
    "Quot Target Date",  # U
    "Plant",  # V
    "Country",  # W
    "Customer RFQ No",  # X
    "Customer RFQ Date",  # Y
    "Item No",  # Z
    "Item Desc",  # AA
    "Qty",  # AB
    "Unit Code",  # AC
    "Rate",  # AD
    "Total ",  # AE — trailing space intentional
    "Category Name",  # AF
    "Delivery Slab",  # AG
    "MarketingFeasibility",  # AH
    "EnggStatus",  # AI
    "EnggRemark",  # AJ
    "Sector",  # AK
    "RMGrade",  # AL
    "ForgedWt",  # AM
    "ForgedEquipement",  # AN
    "Follow Up IsConverted",  # AO
    "POExpectedWeek",  # AP
]


def _get_unit_code(unit: str) -> str:
    mapping = {
        "piece": "NOS",
        "pieces": "NOS",
        "nos": "NOS",
        "meter": "MTR",
        "meters": "MTR",
        "mtr": "MTR",
        "set": "SET",
        "sets": "SET",
    }
    return mapping.get((unit or "").lower().strip(), "NOS")


def _generate_enquiry_number() -> int:
    """Sequential-looking enquiry number.

    TODO: When ERP is connected, fetch actual next sequence from ERP.
    """
    year = datetime.now().year
    suffix = datetime.now().strftime("%H%M%S%f")[-6:]  # last 6 digits stable-length
    return int(f"{year}{suffix}")


def _source_label(input_type: str) -> str:
    it = (input_type or "email").lower()
    if it in ("indiamart", "india_mart", "india-mart"):
        return "IndiaMart"
    if it in ("manual",):
        return "Manual"
    return "Email"


async def generate_enquiry_list_excel(
    *,
    enquiry_id: str,
    client: Any,  # ClientExportAdapter, DummyClient, or legacy duck-typed client
    parsed_data: dict,
    matched_products: list[dict],
    quotation_data: dict | None,
    input_type: str = "Email",
    attended_by: str = "Marketing",
    subject: str | None = None,
) -> str:
    """Generate ERP Enquiry List Excel file.

    One row per line item (quotation line items preferred).
    Returns file path.
    """
    today = datetime.now(timezone.utc).date()
    followup_date = today + timedelta(days=3)
    quot_target = today + timedelta(days=7)

    company_name = getattr(client, "company_name", None) or parsed_data.get("client_company") or "Unknown"
    contact_name = getattr(client, "contact_name", None) or parsed_data.get("client_name") or ""
    phone = getattr(client, "phone", None) or parsed_data.get("client_phone") or ""
    email = getattr(client, "email", None) or parsed_data.get("client_email") or ""
    erp_code = getattr(client, "erp_code", None) or "NEW"

    ref_no = str(enquiry_id)[:8].upper()

    line_items: list[dict] = []
    if quotation_data and quotation_data.get("line_items"):
        for item in quotation_data["line_items"]:
            qty = int(item.get("quantity") or 1)
            rate = float(item.get("unit_price") or 0)
            total = float(item.get("line_total") or item.get("total") or (qty * rate))
            line_items.append(
                {
                    "item_no": (str(item.get("product_id") or "")[:10]) or "ITEM",
                    "item_desc": (f"{item.get('description', '')} {item.get('size', '')}").strip(),
                    "qty": qty,
                    "unit": _get_unit_code(item.get("unit", "piece")),
                    "rate": rate,
                    "total": total,
                }
            )
    elif matched_products:
        # Best-effort: use matcher output; quantity from parsed_data.products_requested if present.
        reqs = parsed_data.get("products_requested") or []
        for prod in matched_products:
            prod_id = str(prod.get("product_id") or "")
            qty = 1
            for req in reqs:
                if req.get("matched_product_id") == prod_id:
                    qty = int(req.get("quantity") or 1)
                    break
            rate = float(prod.get("unit_price") or 0)
            line_items.append(
                {
                    "item_no": prod_id[:10],
                    "item_desc": (f"{prod.get('product_name', '')} {prod.get('size', '')}").strip(),
                    "qty": qty,
                    "unit": "NOS",
                    "rate": rate,
                    "total": qty * rate,
                }
            )
    else:
        for req in parsed_data.get("products_requested") or [{}]:
            line_items.append(
                {
                    "item_no": "",
                    "item_desc": req.get("product_description", "") or "",
                    "qty": int(req.get("quantity") or 1),
                    "unit": "NOS",
                    "rate": 0,
                    "total": 0,
                }
            )

    if not line_items:
        line_items = [{"item_no": "", "item_desc": "", "qty": 1, "unit": "NOS", "rate": 0, "total": 0}]

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Sheet1"

    header_fill = PatternFill("solid", start_color="366092")
    header_font = Font(bold=True, color="FFFFFF", name="Arial", size=10)
    header_align = Alignment(horizontal="center", vertical="center")

    for col_idx, header in enumerate(ENQUIRY_HEADERS, start=1):
        cell = ws.cell(row=1, column=col_idx)
        cell.value = header
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_align

    ws.row_dimensions[1].height = 20

    data_font = Font(name="Arial", size=10)
    data_align = Alignment(vertical="center")
    enq_number = _generate_enquiry_number()

    for row_idx, item in enumerate(line_items, start=2):
        remarks = subject or ""
        if not remarks:
            remarks = "Enquiry via " + _source_label(input_type)

        row_data = [
            "ENQ",  # A
            "ENQ",  # B
            enq_number,  # C
            erp_code,  # D
            company_name,  # E
            today,  # F
            _source_label(input_type),  # G
            "Normal",  # H
            "",  # I
            attended_by,  # J
            remarks,  # K
            "Open",  # L
            followup_date,  # M
            "",  # N
            contact_name,  # O
            phone,  # P
            email,  # Q
            ref_no,  # R
            today,  # S
            erp_code,  # T
            quot_target,  # U
            "Pune",  # V
            "India",  # W
            "",  # X
            "",  # Y
            item["item_no"],  # Z
            item["item_desc"],  # AA
            item["qty"],  # AB
            item["unit"],  # AC
            item["rate"],  # AD
            item["total"],  # AE
            "Main",  # AF
            "",  # AG
            "Yes",  # AH
            "",  # AI
            "",  # AJ
            "",  # AK
            "",  # AL
            "",  # AM
            "",  # AN
            "NO",  # AO
            "",  # AP
        ]

        for col_idx, value in enumerate(row_data, start=1):
            cell = ws.cell(row=row_idx, column=col_idx)
            cell.value = value if value != "" else None
            cell.font = data_font
            cell.alignment = data_align

        ws.row_dimensions[row_idx].height = 18

    col_widths = {
        "A": 8,
        "B": 12,
        "C": 14,
        "D": 12,
        "E": 35,
        "F": 14,
        "G": 12,
        "H": 10,
        "I": 12,
        "J": 14,
        "K": 25,
        "L": 10,
        "M": 14,
        "N": 12,
        "O": 22,
        "P": 14,
        "Q": 28,
        "R": 12,
        "S": 14,
        "T": 14,
        "U": 16,
        "V": 10,
        "W": 10,
        "X": 16,
        "Y": 16,
        "Z": 12,
        "AA": 30,
        "AB": 8,
        "AC": 10,
        "AD": 10,
        "AE": 12,
        "AF": 12,
        "AG": 14,
        "AH": 20,
        "AI": 14,
        "AJ": 14,
        "AK": 12,
        "AL": 12,
        "AM": 10,
        "AN": 16,
        "AO": 20,
        "AP": 16,
    }
    for col_letter, width in col_widths.items():
        ws.column_dimensions[col_letter].width = width

    ws.freeze_panes = "A2"

    output_dir = Path("./output/erp_exports")
    output_dir.mkdir(parents=True, exist_ok=True)

    filename = f"EnquiryList_{ref_no}_{today.strftime('%Y%m%d')}.xlsx"
    filepath = output_dir / filename
    wb.save(str(filepath))
    return str(filepath)

