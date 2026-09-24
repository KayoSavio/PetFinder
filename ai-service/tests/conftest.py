import os

import pytest
from dotenv import load_dotenv

load_dotenv()

TEST_URL = os.getenv("TEST_DATABASE_URL")


@pytest.fixture
def db(monkeypatch):
    """Aponta database.py para o branch de teste e limpa as tabelas."""
    if not TEST_URL:
        pytest.skip("TEST_DATABASE_URL não configurada")
    import database

    monkeypatch.setattr(database, "DATABASE_URL", TEST_URL)
    database.close_pool()
    with database.get_pool().connection() as conn:
        conn.execute("TRUNCATE posts CASCADE")
    yield database
    database.close_pool()


@pytest.fixture
def make_post(db):
    """Cria um post direto no banco e devolve o id."""
    def _make(type_="found", lat=-23.55, lng=-46.63, status="active"):
        with db.get_pool().connection() as conn:
            row = conn.execute(
                """INSERT INTO posts (type, status, title, location)
                   VALUES (%s, %s, 'teste', ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography)
                   RETURNING id::text AS id""",
                (type_, status, lng, lat),
            ).fetchone()
        return row["id"]
    return _make
