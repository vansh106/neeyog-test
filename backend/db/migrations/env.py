from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from core.config import get_settings
from core.database import Base
from db.models import (  # noqa: F401
    AuditLog,
    ClientBranch,
    ClientCompany,
    ClientEmployee,
    ClientPricingConfig,
    EmailSyncState,
    Enquiry,
    ProcessedEmail,
    Quotation,
    RefreshToken,
    Supplier,
    SupplierProductPrice,
    User,
    UserPermission,
)
from db.sheet_models import (  # noqa: F401
    CatalogBallValveRow,
    CatalogBracketsCouplerRow,
    CatalogButterflyValveRow,
    CatalogLimitSwitchRow,
    CatalogOperatorRow,
    CatalogPositionerRow,
    CatalogSovRow,
)
import db.final_product_models  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

settings = get_settings()

# IMPORTANT FOR SUPABASE:
# Alembic must use DATABASE_URL_DIRECT (port 5432 — the direct connection),
# NOT the transaction pooler (port 6543 / PgBouncer). PgBouncer in
# transaction mode does not support the DDL / advisory-lock patterns
# Alembic relies on. ``settings.migration_url`` resolves to DIRECT when
# set, otherwise falls back to DATABASE_URL_SYNC (suitable for local dev).
config.set_main_option("sqlalchemy.url", settings.migration_url)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
