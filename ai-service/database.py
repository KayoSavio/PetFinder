"""
Operações de banco de dados para embeddings de fotos.
Conecta direto no Neon (PostgreSQL + pgvector + PostGIS) via psycopg.
"""

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from config import DATABASE_URL

_pool: ConnectionPool | None = None

# Colunas do post devolvidas junto com os matches (sem a coluna geography crua)
POST_COLUMNS = """
    p.id::text AS id, p.user_id, p.type, p.status, p.urgency, p.title, p.description,
    p.species, p.size, p.color_tags, p.event_datetime, p.pin_lat, p.pin_lng,
    p.city, p.neighborhood, p.photos, p.contact_whatsapp, p.contact_phone,
    p.created_at, p.updated_at
"""


def get_pool() -> ConnectionPool:
    """Pool de conexões criado sob demanda (lê DATABASE_URL na primeira chamada)."""
    global _pool
    if _pool is None:
        if not DATABASE_URL:
            raise ValueError("❌ DATABASE_URL deve estar configurado no .env")
        _pool = ConnectionPool(
            DATABASE_URL, min_size=1, max_size=5,
            kwargs={"row_factory": dict_row}, open=True,
        )
    return _pool


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


def _vec(embedding: list[float]) -> str:
    """Literal pgvector: '[0.1,0.2,...]'."""
    return "[" + ",".join(f"{x:.7f}" for x in embedding) + "]"


def save_embedding(post_id: str, photo_url: str, embedding: list[float], species: str | None = None) -> dict:
    """Salva o embedding de uma foto. species: 'dog' | 'cat' | None."""
    with get_pool().connection() as conn:
        row = conn.execute(
            """INSERT INTO photo_embeddings (post_id, photo_url, embedding, species)
               VALUES (%s::uuid, %s, %s::vector, %s)
               RETURNING id::text AS id, post_id::text AS post_id, photo_url, species""",
            (post_id, photo_url, _vec(embedding), species),
        ).fetchone()
    return row or {}


def find_similar_photos(
    query_embedding: list[float],
    match_threshold: float = 0.60,
    match_count: int = 10,
    lat: float | None = None,
    lng: float | None = None,
    radius_km: float | None = None,
    search_types: list[str] | None = None,
    exclude_post_id: str | None = None,
    query_species: str | None = None,
) -> list[dict]:
    """Busca fotos parecidas (pgvector) com filtro de tipo, distância e espécie."""
    with get_pool().connection() as conn:
        rows = conn.execute(
            """SELECT id::text AS id, post_id::text AS post_id, photo_url, species, similarity, distance_km
               FROM match_photos(%s::vector, %s::float8, %s::int, %s::float8, %s::float8,
                                 %s::float8, %s::text[], %s::uuid, %s::text)""",
            (
                _vec(query_embedding), match_threshold, match_count, lat, lng, radius_km,
                search_types or ["lost", "help_request"], exclude_post_id, query_species,
            ),
        ).fetchall()
    return rows


def get_embeddings_for_post(post_id: str) -> list[dict]:
    """Embeddings já salvos de um post (evita reprocessar a foto)."""
    with get_pool().connection() as conn:
        return conn.execute(
            """SELECT id::text AS id, photo_url, embedding::text AS embedding, species
               FROM photo_embeddings WHERE post_id = %s::uuid""",
            (post_id,),
        ).fetchall()


def get_post_details(post_ids: list[str]) -> list[dict]:
    """Detalhes dos posts pelo ID."""
    if not post_ids:
        return []
    with get_pool().connection() as conn:
        return conn.execute(
            f"SELECT {POST_COLUMNS} FROM posts p WHERE p.id = ANY(%s::uuid[])",
            (post_ids,),
        ).fetchall()


def delete_embeddings(post_id: str) -> None:
    """Remove todos os embeddings de um post."""
    with get_pool().connection() as conn:
        conn.execute("DELETE FROM photo_embeddings WHERE post_id = %s::uuid", (post_id,))


def get_posts_without_embeddings() -> list[dict]:
    """Posts ativos com fotos e sem nenhum embedding (para /embeddings/batch)."""
    with get_pool().connection() as conn:
        return conn.execute(
            """SELECT p.id::text AS id, p.photos
               FROM posts p
               WHERE p.status = 'active'
                 AND cardinality(p.photos) > 0
                 AND NOT EXISTS (SELECT 1 FROM photo_embeddings pe WHERE pe.post_id = p.id)"""
        ).fetchall()
