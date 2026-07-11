from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool, text

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
    PurchaseOrder,
    Quotation,
    RefreshToken,
    Supplier,
    SupplierProductPrice,
    User,
    UserPermission,
)
from db.sheet_models import (  # noqa: F401
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

# Session pooler (5432) supports DDL; transaction pooler (6543) does not.
config.set_main_option("sqlalchemy.url", settings.migration_url.replace("%", "%%"))

target_metadata = Base.metadata
schema = (settings.DB_SCHEMA or "public").strip()
use_schema = schema if schema and schema != "public" else None


def _configure_context(connection) -> None:
    if use_schema:
        connection.execute(text(f'SET search_path TO "{use_schema}", public'))
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        include_schemas=bool(use_schema),
        version_table_schema=use_schema,
    )


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
        _configure_context(connection)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
