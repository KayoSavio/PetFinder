"""
Operações de banco de dados para embeddings de fotos.
Usa o cliente Supabase para comunicar com o PostgreSQL + pgvector.
"""

from supabase import create_client, Client

from config import SUPABASE_URL, SUPABASE_KEY


def get_client() -> Client:
    """Cria e retorna um cliente Supabase."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError(
            "❌ SUPABASE_URL e SUPABASE_SERVICE_KEY devem estar configurados no .env"
        )
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def save_embedding(post_id: str, photo_url: str, embedding: list[float]) -> dict:
    """
    Salva um embedding de foto no banco de dados.
    
    Args:
        post_id: ID do post (UUID)
        photo_url: URL da foto no storage
        embedding: Vetor de embedding (512 dimensões)
        
    Returns:
        Registro criado
    """
    client = get_client()
    
    result = client.table("photo_embeddings").insert({
        "post_id": post_id,
        "photo_url": photo_url,
        "embedding": embedding,
    }).execute()
    
    return result.data[0] if result.data else {}


def find_similar_photos(
    query_embedding: list[float],
    match_threshold: float = 0.60,
    match_count: int = 10,
    lat: float | None = None,
    lng: float | None = None,
    radius_km: float | None = None,
    search_types: list[str] | None = None,
    exclude_post_id: str | None = None,
) -> list[dict]:
    """
    Busca fotos similares usando a função match_photos do Supabase (pgvector).

    Args:
        query_embedding: Embedding da foto de consulta (384 dims)
        match_threshold: Similaridade mínima (0-1)
        match_count: Número máximo de resultados
        lat/lng/radius_km: Filtro geográfico opcional (retorna distance_km)
        search_types: Tipos de post a buscar, ex: ["lost", "help_request"]

    Returns:
        Lista de matches com post_id, photo_url, similarity e distance_km
    """
    client = get_client()

    params = {
        "query_embedding": query_embedding,
        "match_threshold": match_threshold,
        "match_count": match_count,
        "query_lat": lat,
        "query_lng": lng,
        "max_distance_km": radius_km,
        "search_types": search_types or ["lost", "help_request"],
        "exclude_post_id": exclude_post_id,
    }

    result = client.rpc("match_photos", params).execute()

    return result.data or []


def get_embeddings_for_post(post_id: str) -> list[dict]:
    """Busca os embeddings já salvos de um post (evita reprocessar a foto)."""
    client = get_client()
    result = (
        client.table("photo_embeddings")
        .select("id, photo_url, embedding")
        .eq("post_id", post_id)
        .execute()
    )
    return result.data or []


def get_post_details(post_ids: list[str]) -> list[dict]:
    """
    Busca detalhes dos posts pelo ID.
    
    Args:
        post_ids: Lista de UUIDs dos posts
        
    Returns:
        Lista de posts com seus detalhes
    """
    if not post_ids:
        return []
    
    client = get_client()
    
    result = (
        client.table("posts")
        .select("*")
        .in_("id", post_ids)
        .execute()
    )
    
    return result.data or []


def delete_embeddings(post_id: str) -> None:
    """
    Remove todos os embeddings de um post (quando deletado ou atualizado).
    
    Args:
        post_id: ID do post
    """
    client = get_client()
    
    client.table("photo_embeddings").delete().eq("post_id", post_id).execute()


def get_posts_without_embeddings() -> list[dict]:
    """
    Busca posts ativos que possuem fotos mas não têm embeddings.
    Útil para migração em lote.
    
    Returns:
        Lista de posts sem embeddings
    """
    client = get_client()
    
    # Busca posts ativos com fotos
    all_posts = (
        client.table("posts")
        .select("id, photos")
        .eq("status", "active")
        .neq("photos", "{}")
        .execute()
    )
    
    if not all_posts.data:
        return []
    
    # Busca post_ids que já têm embeddings
    existing = (
        client.table("photo_embeddings")
        .select("post_id")
        .execute()
    )
    
    existing_ids = {row["post_id"] for row in (existing.data or [])}
    
    # Filtra os que não têm
    return [p for p in all_posts.data if p["id"] not in existing_ids]
