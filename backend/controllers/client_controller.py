"""HTTP layer for client companies and branches."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import ClientBranch, ClientCompany, ClientEmployee
from services import client_service
from core.config import get_settings


class BranchResponse(BaseModel):
    id: str
    branch_name: str
    is_headquarters: bool
    contact_name: str | None
    designation: str | None
    phone: str | None
    email: str | None
    city: str
    state: str | None
    pincode: str | None
    address_line1: str | None
    country: str
    enquiry_count: int
    is_active: bool


class CompanyResponse(BaseModel):
    id: str
    company_name: str
    gst_number: str | None
    industry: str | None
    erp_code: str | None
    default_discount_pct: float | None = None
    is_erp_synced: bool
    total_enquiry_count: int
    branch_count: int
    branches: list[BranchResponse]
    is_active: bool
    created_at: str
    recent_enquiries: list[dict] = Field(default_factory=list)


class CreateCompanyRequest(BaseModel):
    company_name: str
    gst_number: str | None = None
    industry: str | None = None
    notes: str | None = None
    branch_name: str = "Main"
    contact_name: str | None = None
    designation: str | None = None
    phone: str | None = None
    email: str | None = None
    city: str
    state: str | None = None
    pincode: str | None = None
    address_line1: str | None = None
    country: str = "India"


class AddBranchRequest(BaseModel):
    branch_name: str
    contact_name: str | None = None
    designation: str | None = None
    phone: str | None = None
    email: str | None = None
    city: str
    state: str | None = None
    pincode: str | None = None
    address_line1: str | None = None
    country: str = "India"


class ClientEmployeeResponse(BaseModel):
    id: str
    branch_id: str
    full_name: str
    email: str | None = None
    phone: str | None = None
    designation: str | None = None
    is_active: bool = True


class CreateClientEmployeeRequest(BaseModel):
    full_name: str
    email: str | None = None
    phone: str | None = None
    designation: str | None = None


def _branch_resp(b: ClientBranch) -> BranchResponse:
    return BranchResponse(
        id=str(b.id),
        branch_name=b.branch_name,
        is_headquarters=bool(b.is_headquarters),
        contact_name=b.contact_name,
        designation=b.designation,
        phone=b.phone,
        email=b.email,
        city=b.city,
        state=b.state,
        pincode=b.pincode,
        address_line1=b.address_line1,
        country=b.country,
        enquiry_count=int(b.enquiry_count or 0),
        is_active=bool(b.is_active),
    )


async def _company_resp(
    c: ClientCompany,
    db: AsyncSession,
    *,
    include_recent: bool = False,
) -> CompanyResponse:
    branches = sorted(c.branches or [], key=lambda x: (not x.is_headquarters, x.branch_name.lower()))
    recent: list[dict] = []
    if include_recent:
        rows = await client_service.list_recent_enquiries_for_company(c.id, db, limit=5)
        for e in rows:
            bn = ""
            if e.branch is not None:
                bn = e.branch.branch_name or ""
            recent.append(
                {
                    "enquiry_id": str(e.id),
                    "created_at": e.created_at.isoformat() if e.created_at else "",
                    "branch_name": bn,
                    "status": e.status,
                }
            )
    return CompanyResponse(
        id=str(c.id),
        company_name=c.company_name,
        gst_number=c.gst_number,
        industry=c.industry,
        erp_code=c.erp_code,
        default_discount_pct=float(c.default_discount_pct) if c.default_discount_pct is not None else None,
        is_erp_synced=bool(c.is_erp_synced),
        total_enquiry_count=int(c.total_enquiry_count or 0),
        branch_count=len(branches),
        branches=[_branch_resp(b) for b in branches],
        is_active=bool(c.is_active),
        created_at=c.created_at.isoformat() if c.created_at else "",
        recent_enquiries=recent,
    )


def _client_cfg() -> str:
    return get_settings().ACTIVE_CLIENT


def _employee_resp(e: ClientEmployee) -> ClientEmployeeResponse:
    return ClientEmployeeResponse(
        id=str(e.id),
        branch_id=str(e.branch_id),
        full_name=e.full_name,
        email=e.email,
        phone=e.phone,
        designation=e.designation,
        is_active=bool(e.is_active),
    )


async def handle_list_branch_employees(
    company_id: str,
    branch_id: str,
    db: AsyncSession,
) -> list[ClientEmployeeResponse]:
    try:
        bid = uuid.UUID(branch_id)
        cid = uuid.UUID(company_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid id") from exc
    b = await db.get(ClientBranch, bid)
    if b is None or b.company_id != cid:
        raise HTTPException(status_code=404, detail="Branch not found")
    rows = await client_service.list_branch_employees(bid, db)
    return [_employee_resp(e) for e in rows]


async def handle_create_branch_employee(
    company_id: str,
    branch_id: str,
    body: CreateClientEmployeeRequest,
    db: AsyncSession,
) -> ClientEmployeeResponse:
    try:
        bid = uuid.UUID(branch_id)
        cid = uuid.UUID(company_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid id") from exc
    b = await db.get(ClientBranch, bid)
    if b is None or b.company_id != cid:
        raise HTTPException(status_code=404, detail="Branch not found")
    if not b.is_active:
        raise HTTPException(status_code=400, detail="Cannot add employees to an inactive branch")
    try:
        emp = await client_service.create_branch_employee(
            bid,
            full_name=body.full_name.strip(),
            email=body.email,
            phone=body.phone,
            designation=body.designation,
            db=db,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return _employee_resp(emp)


async def handle_list_companies(
    db: AsyncSession,
    search: str | None,
    limit: int,
) -> list[CompanyResponse]:
    rows = await client_service.search_companies(_client_cfg(), search, db, limit=limit)
    return [await _company_resp(c, db) for c in rows]


async def handle_get_company(company_id: str, db: AsyncSession) -> CompanyResponse:
    c = await client_service.get_company_with_branches(company_id, db)
    if c is None:
        raise HTTPException(status_code=404, detail="Company not found")
    return await _company_resp(c, db, include_recent=True)


async def handle_create_company(body: CreateCompanyRequest, db: AsyncSession) -> CompanyResponse:
    cfg = _client_cfg()
    company, _branch = await client_service.create_company_with_branch(
        client_config=cfg,
        company_name=body.company_name.strip(),
        gst_number=body.gst_number,
        industry=body.industry,
        notes=body.notes,
        source="manual",
        branch_name=body.branch_name.strip() or "Main",
        contact_name=body.contact_name,
        designation=body.designation,
        phone=body.phone,
        email=body.email,
        city=body.city.strip(),
        state=body.state,
        pincode=body.pincode,
        address_line1=body.address_line1,
        country=body.country or "India",
        db=db,
    )
    reloaded = await client_service.get_company_with_branches(str(company.id), db)
    assert reloaded is not None
    return await _company_resp(reloaded, db)


async def handle_patch_company(company_id: str, body: dict[str, Any], db: AsyncSession) -> CompanyResponse:
    c = await client_service.get_company_with_branches(company_id, db)
    if c is None:
        raise HTTPException(status_code=404, detail="Company not found")
    allowed = {
        "company_name",
        "gst_number",
        "industry",
        "website",
        "erp_code",
        "default_discount_pct",
        "is_erp_synced",
        "notes",
        "is_active",
    }
    for k, v in body.items():
        if k in allowed and hasattr(c, k):
            setattr(c, k, v)
    await db.commit()
    await db.refresh(c)
    reloaded = await client_service.get_company_with_branches(company_id, db)
    assert reloaded is not None
    return await _company_resp(reloaded, db)


async def handle_add_branch(company_id: str, body: AddBranchRequest, db: AsyncSession) -> BranchResponse:
    c = await client_service.get_company_with_branches(company_id, db)
    if c is None:
        raise HTTPException(status_code=404, detail="Company not found")
    b = await client_service.add_branch(
        company_id=company_id,
        branch_name=body.branch_name.strip(),
        contact_name=body.contact_name,
        designation=body.designation,
        phone=body.phone,
        email=body.email,
        city=body.city.strip(),
        state=body.state,
        pincode=body.pincode,
        address_line1=body.address_line1,
        country=body.country or "India",
        db=db,
    )
    return _branch_resp(b)


async def handle_patch_branch(
    company_id: str,
    branch_id: str,
    body: dict[str, Any],
    db: AsyncSession,
) -> BranchResponse:
    try:
        bid = uuid.UUID(branch_id)
        cid = uuid.UUID(company_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid id") from exc
    b = await db.get(ClientBranch, bid)
    if b is None or b.company_id != cid:
        raise HTTPException(status_code=404, detail="Branch not found")
    allowed = {
        "branch_name",
        "is_headquarters",
        "contact_name",
        "designation",
        "phone",
        "email",
        "city",
        "state",
        "pincode",
        "address_line1",
        "address_line2",
        "country",
        "branch_erp_code",
        "is_active",
    }
    for k, v in body.items():
        if k in allowed and hasattr(b, k):
            setattr(b, k, v)
    await db.commit()
    await db.refresh(b)
    return _branch_resp(b)


async def handle_deactivate_branch(company_id: str, branch_id: str, db: AsyncSession) -> BranchResponse:
    try:
        bid = uuid.UUID(branch_id)
        cid = uuid.UUID(company_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid id") from exc
    b = await db.get(ClientBranch, bid)
    if b is None or b.company_id != cid:
        raise HTTPException(status_code=404, detail="Branch not found")
    n_active = (
        await db.execute(
            select(func.count())
            .select_from(ClientBranch)
            .where(ClientBranch.company_id == cid, ClientBranch.is_active.is_(True))
        )
    ).scalar_one()
    if int(n_active or 0) <= 1 and b.is_active:
        raise HTTPException(status_code=400, detail="Cannot deactivate the only active branch")
    b.is_active = False
    await db.commit()
    await db.refresh(b)
    return _branch_resp(b)
