"""Client companies + branches — CRM-style subdivision for enquiries."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from db.models import ClientBranch, ClientCompany, ClientEmployee, Enquiry


@dataclass
class DummyClient:
    id: str
    company_name: str
    contact_name: str | None = None
    email: str | None = None
    phone: str | None = None
    city: str | None = None
    erp_code: str | None = None
    is_erp_synced: bool = False


@dataclass
class ClientExportAdapter:
    """Flatten branch + company for ERP export (duck-types like legacy ClientRecord)."""

    company_name: str
    contact_name: str | None
    email: str | None
    phone: str | None
    erp_code: str | None
    is_erp_synced: bool

    @classmethod
    def from_branch(cls, branch: ClientBranch) -> ClientExportAdapter:
        c = branch.company
        return cls(
            company_name=c.company_name if c else "",
            contact_name=branch.contact_name,
            email=branch.email,
            phone=branch.phone,
            erp_code=c.erp_code if c else None,
            is_erp_synced=bool(c.is_erp_synced) if c else False,
        )


DUMMY_CLIENTS: list[dict] = [
    {
        "id": "dummy-001",
        "company_name": "Bharat Industrial Supplies",
        "contact_name": "Ramesh Joshi",
        "email": "ramesh@bharatind.com",
        "phone": "9823001001",
        "city": "Pune",
        "erp_code": "FC0101",
        "is_erp_synced": True,
    },
    {
        "id": "dummy-002",
        "company_name": "Nashik Engineering Works",
        "contact_name": "Sunita Patil",
        "email": "sunita@nashikeng.in",
        "phone": "9765400200",
        "city": "Nashik",
        "erp_code": "FC0202",
        "is_erp_synced": True,
    },
    {
        "id": "dummy-003",
        "company_name": "Maharashtra Process Equipment",
        "contact_name": "Vijay Kulkarni",
        "email": "vijay@mpequip.com",
        "phone": "9712300303",
        "city": "Mumbai",
        "erp_code": "FC0303",
        "is_erp_synced": True,
    },
    {
        "id": "dummy-004",
        "company_name": "Aurangabad Fluid Systems",
        "contact_name": "Pradeep Shinde",
        "email": "pradeep@afsystems.in",
        "phone": "9823400404",
        "city": "Aurangabad",
        "erp_code": "FC0404",
        "is_erp_synced": True,
    },
]


def _clean_phone(phone: str) -> str:
    digits = "".join(c for c in phone if c.isdigit())
    return digits[-10:] if len(digits) >= 10 else digits


def get_dummy_clients() -> list[dict]:
    return DUMMY_CLIENTS


async def lookup_client(
    company_name: str | None,
    email: str | None,
    phone: str | None,
    db: AsyncSession,
) -> ClientBranch | None:
    if not any([company_name, email, phone]):
        return None

    base = (
        select(ClientBranch)
        .join(ClientCompany, ClientBranch.company_id == ClientCompany.id)
        .options(selectinload(ClientBranch.company))
    )

    conditions = []
    if email:
        conditions.append(ClientBranch.email == email.lower().strip())
    if phone:
        clean = _clean_phone(phone)
        if clean:
            conditions.append(ClientBranch.phone.like(f"%{clean}"))

    if conditions:
        result = await db.execute(base.where(or_(*conditions)).limit(1))
        found = result.scalar_one_or_none()
        if found:
            return found

    if company_name and len(company_name) > 3:
        needle = company_name.lower().strip()[:20]
        result = await db.execute(
            base.where(func.lower(ClientCompany.company_name).contains(needle)).limit(1)
        )
        return result.scalar_one_or_none()

    return None


async def search_companies(
    client_config: str,
    search: str | None,
    db: AsyncSession,
    limit: int = 20,
) -> list[ClientCompany]:
    q = (
        select(ClientCompany)
        .where(
            ClientCompany.client_config == client_config,
            ClientCompany.is_active.is_(True),
        )
        .options(selectinload(ClientCompany.branches))
        .order_by(ClientCompany.company_name)
        .limit(limit)
    )
    if search and search.strip():
        q = q.where(ClientCompany.company_name.ilike(f"%{search.strip()}%"))
    result = await db.execute(q)
    return list(result.scalars().all())


async def get_company_with_branches(company_id: str, db: AsyncSession) -> ClientCompany | None:
    result = await db.execute(
        select(ClientCompany)
        .options(selectinload(ClientCompany.branches))
        .where(ClientCompany.id == uuid.UUID(company_id))
    )
    return result.scalar_one_or_none()


async def get_branch_with_company(branch_id: str, db: AsyncSession) -> ClientBranch | None:
    if branch_id.startswith("dummy-"):
        return None
    try:
        bid = uuid.UUID(branch_id)
    except ValueError:
        return None
    result = await db.execute(
        select(ClientBranch)
        .options(selectinload(ClientBranch.company))
        .where(ClientBranch.id == bid)
    )
    return result.scalar_one_or_none()


async def client_for_export(selection_id: str, db: AsyncSession) -> ClientExportAdapter | DummyClient | None:
    if selection_id.startswith("dummy-"):
        for d in DUMMY_CLIENTS:
            if d["id"] == selection_id:
                return DummyClient(**d)
        return None
    branch = await get_branch_with_company(selection_id, db)
    if branch is None:
        return None
    return ClientExportAdapter.from_branch(branch)


async def create_company_with_branch(
    client_config: str,
    company_name: str,
    gst_number: str | None,
    industry: str | None,
    notes: str | None,
    source: str,
    branch_name: str,
    contact_name: str | None,
    designation: str | None,
    phone: str | None,
    email: str | None,
    city: str,
    state: str | None,
    pincode: str | None,
    address_line1: str | None,
    country: str,
    db: AsyncSession,
) -> tuple[ClientCompany, ClientBranch]:
    company = ClientCompany(
        client_config=client_config,
        company_name=company_name,
        gst_number=gst_number,
        industry=industry,
        notes=notes,
        source=source,
    )
    db.add(company)
    await db.flush()

    branch = ClientBranch(
        company_id=company.id,
        branch_name=branch_name,
        is_headquarters=True,
        contact_name=contact_name,
        designation=designation,
        phone=phone,
        email=(email or "").lower().strip() or None,
        city=city,
        state=state,
        pincode=pincode,
        address_line1=address_line1,
        country=country or "India",
    )
    db.add(branch)
    await db.commit()
    await db.refresh(company)
    await db.refresh(branch)
    return company, branch


async def add_branch(
    company_id: str,
    branch_name: str,
    contact_name: str | None,
    designation: str | None,
    phone: str | None,
    email: str | None,
    city: str,
    state: str | None,
    pincode: str | None,
    address_line1: str | None,
    country: str,
    db: AsyncSession,
) -> ClientBranch:
    branch = ClientBranch(
        company_id=uuid.UUID(company_id),
        branch_name=branch_name,
        is_headquarters=False,
        contact_name=contact_name,
        designation=designation,
        phone=phone,
        email=(email or "").lower().strip() or None,
        city=city,
        state=state,
        pincode=pincode,
        address_line1=address_line1,
        country=country or "India",
    )
    db.add(branch)
    await db.commit()
    await db.refresh(branch)
    return branch


async def increment_branch_enquiry_count(branch_id: str, db: AsyncSession) -> None:
    if branch_id.startswith("dummy-"):
        return
    try:
        bid = uuid.UUID(branch_id)
    except ValueError:
        return
    branch = await db.get(ClientBranch, bid)
    if branch is None:
        return
    branch.enquiry_count = int(branch.enquiry_count or 0) + 1
    company = await db.get(ClientCompany, branch.company_id)
    if company is not None:
        company.total_enquiry_count = int(company.total_enquiry_count or 0) + 1
    await db.commit()


async def set_company_default_discount(
    company_id: uuid.UUID,
    default_discount_pct: float,
    db: AsyncSession,
) -> None:
    company = await db.get(ClientCompany, company_id)
    if company is None:
        return
    company.default_discount_pct = float(default_discount_pct)
    await db.commit()


async def list_recent_enquiries_for_company(
    company_id: uuid.UUID,
    db: AsyncSession,
    limit: int = 5,
) -> list[Enquiry]:
    result = await db.execute(
        select(Enquiry)
        .options(selectinload(Enquiry.branch))
        .where(Enquiry.company_id == company_id)
        .order_by(Enquiry.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def list_branch_employees(branch_id: uuid.UUID, db: AsyncSession) -> list[ClientEmployee]:
    result = await db.execute(
        select(ClientEmployee)
        .where(ClientEmployee.branch_id == branch_id, ClientEmployee.is_active.is_(True))
        .order_by(ClientEmployee.full_name)
    )
    return list(result.scalars().all())


async def get_employee_for_branch(
    employee_id: uuid.UUID,
    branch_id: uuid.UUID,
    db: AsyncSession,
) -> ClientEmployee | None:
    result = await db.execute(
        select(ClientEmployee).where(
            ClientEmployee.id == employee_id,
            ClientEmployee.branch_id == branch_id,
            ClientEmployee.is_active.is_(True),
        )
    )
    return result.scalar_one_or_none()


async def create_branch_employee(
    branch_id: uuid.UUID,
    *,
    full_name: str,
    address_code: str | None = None,
    phone: str | None = None,
    email: str | None = None,
    department: str | None = None,
    designation: str | None = None,
    db: AsyncSession,
) -> ClientEmployee:
    name = (full_name or "").strip()
    if not name:
        raise ValueError("Employee name is required")
    em = (email or "").strip().lower() or None
    emp = ClientEmployee(
        branch_id=branch_id,
        address_code=(address_code or "").strip() or None,
        full_name=name,
        phone=(phone or "").strip() or None,
        email=em,
        department=(department or "").strip() or None,
        designation=(designation or "").strip() or None,
        is_active=True,
    )
    db.add(emp)
    await db.commit()
    await db.refresh(emp)
    return emp
