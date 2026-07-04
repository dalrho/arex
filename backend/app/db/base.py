from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """
    SQLAlchemy 2.0 style Declarative Base.
    All system models will inherit from this class to hook into Alembic migrations.
    """
    pass

