import importlib
import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── Database ───────────────────────────────────────────────
    # Async URL for FastAPI (asyncpg). Points at Supabase's transaction
    # pooler (port 6543) in production, or localhost in dev.
    DATABASE_URL: str
    # Sync URL (psycopg2) — session pooler on Supabase (port 5432).
    DATABASE_URL_SYNC: str
    # Direct connection URL — used only for Alembic migrations, since
    # PgBouncer transaction mode does not support DDL / prepared statements.
    # Falls back to DATABASE_URL_SYNC when not explicitly configured.
    DATABASE_URL_DIRECT: str = ""

    # ── Supabase API (optional — only used if Supabase is the DB) ──
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    REDIS_URL: str

    LITELLM_MODEL: str = "gemini/gemini-2.5-pro"
    ANTHROPIC_API_KEY: str = ""
    GEMINI_API_KEY: str = ""

    APP_ENV: str = "development"
    ACTIVE_CLIENT: str = "parth_valves"
    CONFIDENCE_THRESHOLD: float = 0.85
    LOG_LEVEL: str = "INFO"

    PDF_OUTPUT_DIR: str = "./output/pdfs"

    # ── Auth / JWT (env: JWT_SECRET_KEY, …) ───────────────────
    jwt_secret_key: str = "development-only-set-JWT_SECRET_KEY-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 30
    superadmin_email: str = "admin@parthvalve.com"
    superadmin_password: str = "ChangeMe@123"
    superadmin_name: str = "Super Admin"

    #: Optional Fernet key (44 chars) for mailbox IMAP secrets; if unset, derived from ``jwt_secret_key``.
    mailbox_credentials_fernet_key: str = ""

    #: Per LLM HTTP call (parser / matcher / quote / missing-fields)
    LLM_REQUEST_TIMEOUT_SECONDS: float = 180.0
    #: Full LangGraph pipeline (all agents + PDF); Postman should use a longer client timeout than this
    ENQUIRY_FLOW_TIMEOUT_SECONDS: float = 900.0

    # Gmail IMAP sync (env: EMAIL_SYNC_ENABLED, EMAIL_IMAP_HOST, …)
    email_sync_enabled: bool = True
    email_imap_host: str = "imap.gmail.com"
    email_imap_port: int = 993
    email_address: str = ""
    email_app_password: str = ""
    email_sync_interval_seconds: int = 120
    email_sync_label: str = "INBOX"
    email_filter_unread_only: bool = True
    #: Legacy broad list (kept for env compatibility); sync uses quotation/product rules below.
    email_enquiry_keywords: str = (
        "valve,hose,fitting,quotation,quote,inquiry,enquiry,butterfly,requirement,price,supply"
    )
    #: When true, sync still creates enquiries but does not start the AI pipeline automatically.
    email_sync_auto_process: bool = False
    #: Commerce / RFQ language (any + product context, or portal rules in code).
    email_quotation_commerce_terms: str = (
        "quotation,quote,rfq,price,pricing,rate,cost,enquiry,inquiry,budget,bom,supply,order"
    )
    #: Product / technical context (paired with commerce terms for non-portal mail).
    email_quotation_product_terms: str = (
        "valve,butterfly,ball,gate,globe,needle,check,nrv,disc,flange,actuator,"
        "bfv,bv,wcb,cf8,ss304,dn,pn,class"
    )
    #: If From/body mentions these, portal-style looser matching applies (Indiamart, etc.).
    email_portal_signal_terms: str = "indiamart,tradeindia"
    #: Extra signals for portal leads when commerce+product words are missing.
    email_portal_loose_terms: str = (
        "buyer,query,contacted,requirement,looking for,interested,message,product"
    )

    model_config = {
        "env_file": str(Path(__file__).resolve().parent.parent / ".env"),
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }

    def get_client_config_dir(self) -> Path:
        return Path(__file__).resolve().parent.parent / "config" / "clients" / self.ACTIVE_CLIENT

    def get_client_json(self) -> dict[str, Any]:
        config_path = self.get_client_config_dir() / "client.json"
        with open(config_path) as f:
            return json.load(f)

    def get_client_module(self, module_name: str) -> Any:
        """Import a module from the active client config package.

        Usage: settings.get_client_module("prompts") → imports
        config.clients.parth_valves.prompts
        """
        module_path = f"config.clients.{self.ACTIVE_CLIENT}.{module_name}"
        return importlib.import_module(module_path)

    @property
    def enquiry_keywords_list(self) -> list[str]:
        return [k.strip().lower() for k in self.email_enquiry_keywords.split(",") if k.strip()]

    @property
    def migration_url(self) -> str:
        """URL Alembic should use.

        Prefers the direct connection (``DATABASE_URL_DIRECT``) over the
        pooler, falling back to ``DATABASE_URL_SYNC``. Always returns a
        plain ``postgresql://`` URL (asyncpg driver stripped) because
        Alembic runs synchronously via psycopg2.
        """
        url = self.DATABASE_URL_DIRECT or self.DATABASE_URL_SYNC
        return url.replace("postgresql+asyncpg://", "postgresql://")

    @property
    def is_supabase(self) -> bool:
        """True when any configured DB URL points at Supabase (pooler or direct)."""
        u = (self.DATABASE_URL or "").lower()
        d = (self.DATABASE_URL_DIRECT or "").lower()
        return "supabase.co" in u or "supabase.com" in u or "supabase.co" in d or "supabase.com" in d


@lru_cache
def get_settings() -> Settings:
    return Settings()
