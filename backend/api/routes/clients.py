"""Client CRM: companies + branches."""

from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from controllers import client_controller
from controllers.client_controller import (
    AddBranchRequest,
    BranchResponse,
    CompanyResponse,
    CreateCompanyRequest,
)
from core.database import get_db

router = APIRouter(prefix="/clients", tags=["clients"])


@router.get("/", response_model=list[CompanyResponse])
async def list_clients_route(
    search: str | None = Query(None),
    limit: int = Query(20, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    return await client_controller.handle_list_companies(db, search, limit)


@router.get("/{company_id}", response_model=CompanyResponse)
async def get_company_route(
    company_id: str,
    db: AsyncSession = Depends(get_db),
):
    return await client_controller.handle_get_company(company_id, db)


@router.post("/", response_model=CompanyResponse)
async def create_company_route(
    body: CreateCompanyRequest,
    db: AsyncSession = Depends(get_db),
):
    return await client_controller.handle_create_company(body, db)


@router.patch("/{company_id}", response_model=CompanyResponse)
async def patch_company_route(
    company_id: str,
    body: dict[str, Any],
    db: AsyncSession = Depends(get_db),
):
    return await client_controller.handle_patch_company(company_id, body, db)


@router.post("/{company_id}/branches", response_model=BranchResponse)
async def add_branch_route(
    company_id: str,
    body: AddBranchRequest,
    db: AsyncSession = Depends(get_db),
):
    return await client_controller.handle_add_branch(company_id, body, db)


@router.patch("/{company_id}/branches/{branch_id}", response_model=BranchResponse)
async def patch_branch_route(
    company_id: str,
    branch_id: str,
    body: dict[str, Any],
    db: AsyncSession = Depends(get_db),
):
    return await client_controller.handle_patch_branch(company_id, branch_id, body, db)


@router.patch("/{company_id}/branches/{branch_id}/deactivate", response_model=BranchResponse)
async def deactivate_branch_route(
    company_id: str,
    branch_id: str,
    db: AsyncSession = Depends(get_db),
):
    return await client_controller.handle_deactivate_branch(company_id, branch_id, db)
