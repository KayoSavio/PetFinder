"""
spykke AI Service — Servidor FastAPI para comparação visual de pets.

Pipeline v2: YOLOv8n recorta o animal → DINOv2 gera o embedding.
(CLIP foi substituído — não distinguia bem indivíduos da mesma raça.)

Endpoints:
  POST /embeddings/generate          — Gera embedding de uma foto (upload) e salva
  POST /embeddings/generate-from-url — Gera embedding a partir de URL e salva
  POST /match                        — Compara foto com posts ativos (+ filtro geográfico)
  POST /embeddings/batch             — Gera embeddings para posts sem embedding
  GET  /health                       — Healthcheck
"""

import httpx
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

from config import (
    HOST,
    PORT,
    DEFAULT_MATCH_THRESHOLD,
    DEFAULT_MATCH_COUNT,
    DEFAULT_MATCH_RADIUS_KM,
    DINO_MODEL_NAME,
)
from pipeline import process_image
from database import (
    save_embedding,
    find_similar_photos,
    get_post_details,
    delete_embeddings,
    get_posts_without_embeddings,
    get_embeddings_for_post,
)


# =====================
# Lifespan
# =====================
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: modelos (YOLO + DINOv2) já são carregados como singletons no import
    print("🚀 spykke AI Service iniciado!")
    print(f"📍 Rodando em http://{HOST}:{PORT}")
    yield
    print("🛑 spykke AI Service encerrado.")


app = FastAPI(
    title="spykke AI Service",
    description="Serviço de IA para comparação visual de animais perdidos",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS — permite o app Next.js se comunicar
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =====================
# Modelos de request/response
# =====================
class MatchResult(BaseModel):
    post_id: str
    photo_url: str
    similarity: float
    distance_km: Optional[float] = None
    post: Optional[dict] = None


class EmbeddingResponse(BaseModel):
    post_id: str
    photo_url: str
    embedding_id: str
    dimensions: int
    species_detected: Optional[str] = None
    cropped: bool = False


# =====================
# Endpoints
# =====================

@app.get("/health")
async def health():
    """Healthcheck — verifica se o serviço e os modelos estão OK."""
    from dino_model import dino_embedder
    return {
        "status": "ok",
        "pipeline": "yolov8n-crop + dinov2",
        "model": DINO_MODEL_NAME,
        "device": dino_embedder.device,
    }


def _process_and_save(image_bytes: bytes, post_id: str, photo_url: str) -> EmbeddingResponse:
    """Recorta o animal, gera o embedding e salva no banco."""
    result = process_image(image_bytes)
    saved = save_embedding(post_id, photo_url, result["embedding"])
    return EmbeddingResponse(
        post_id=post_id,
        photo_url=photo_url,
        embedding_id=saved.get("id", ""),
        dimensions=len(result["embedding"]),
        species_detected=result["species"],
        cropped=result["cropped"],
    )


@app.post("/embeddings/generate", response_model=EmbeddingResponse)
async def generate_embedding(
    file: UploadFile = File(...),
    post_id: str = Form(...),
    photo_url: str = Form(...),
):
    """Gera embedding de uma foto (upload direto) e salva no Supabase."""
    try:
        image_bytes = await file.read()
        return _process_and_save(image_bytes, post_id, photo_url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao gerar embedding: {str(e)}")


@app.post("/embeddings/generate-from-url", response_model=EmbeddingResponse)
async def generate_embedding_from_url(
    post_id: str = Form(...),
    photo_url: str = Form(...),
):
    """Gera embedding a partir de uma URL de foto (Supabase Storage)."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(photo_url)
            if response.status_code != 200:
                raise HTTPException(
                    status_code=400,
                    detail=f"Não foi possível baixar a imagem: HTTP {response.status_code}",
                )
            image_bytes = response.content
        return _process_and_save(image_bytes, post_id, photo_url)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao gerar embedding: {str(e)}")


@app.post("/match", response_model=list[MatchResult])
async def match_photo(
    file: UploadFile = File(...),
    threshold: float = Form(DEFAULT_MATCH_THRESHOLD),
    max_results: int = Form(DEFAULT_MATCH_COUNT),
    lat: Optional[float] = Form(None),
    lng: Optional[float] = Form(None),
    radius_km: float = Form(DEFAULT_MATCH_RADIUS_KM),
    search_types: Optional[str] = Form(None),  # ex: "lost,help_request" ou "found"
):
    """
    Compara uma foto com posts ativos e retorna os matches mais similares.

    - Se lat/lng forem enviados, filtra por raio geográfico e retorna a
      distância de cada match (um match perto vale muito mais!).
    - search_types controla a direção da busca:
        "lost,help_request" → achei um cachorro na rua, de quem é?
        "found"             → perdi meu cachorro, alguém viu?
    """
    try:
        image_bytes = await file.read()
        result = process_image(image_bytes)
        query_embedding = result["embedding"]

        types = None
        if search_types:
            types = [t.strip() for t in search_types.split(",") if t.strip()]

        matches = find_similar_photos(
            query_embedding=query_embedding,
            match_threshold=threshold,
            match_count=max_results,
            lat=lat,
            lng=lng,
            radius_km=radius_km if (lat is not None and lng is not None) else None,
            search_types=types,
        )

        if not matches:
            return []

        post_ids = list({m["post_id"] for m in matches})
        posts = get_post_details(post_ids)
        posts_map = {p["id"]: p for p in posts}

        return [
            MatchResult(
                post_id=m["post_id"],
                photo_url=m["photo_url"],
                similarity=round(m["similarity"], 4),
                distance_km=round(m["distance_km"], 2) if m.get("distance_km") is not None else None,
                post=posts_map.get(m["post_id"]),
            )
            for m in matches
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao buscar matches: {str(e)}")


@app.get("/match/by-post/{post_id}", response_model=list[MatchResult])
async def match_by_post(
    post_id: str,
    threshold: float = DEFAULT_MATCH_THRESHOLD,
    max_results: int = DEFAULT_MATCH_COUNT,
    radius_km: float = DEFAULT_MATCH_RADIUS_KM,
):
    """
    Busca matches para um post existente usando os embeddings JÁ SALVOS.

    Direção automática:
      post 'lost'/'help_request' → busca posts 'found' (alguém achou?)
      post 'found'               → busca 'lost'/'help_request' (de quem é?)

    Usa a localização do próprio post como centro da busca geográfica.
    """
    try:
        posts = get_post_details([post_id])
        if not posts:
            raise HTTPException(status_code=404, detail="Post não encontrado")
        post = posts[0]

        embeddings = get_embeddings_for_post(post_id)
        if not embeddings:
            raise HTTPException(
                status_code=404,
                detail="Post não possui embeddings. Rode /embeddings/batch primeiro.",
            )

        # Direção da busca (oposta ao tipo do post)
        if post["type"] == "found":
            types = ["lost", "help_request"]
        else:
            types = ["found"]

        lat = post.get("pin_lat")
        lng = post.get("pin_lng")

        # Busca com cada embedding do post e junta (mantém o melhor score por foto)
        best: dict[str, dict] = {}
        for emb_row in embeddings:
            emb = emb_row["embedding"]
            # O Supabase pode retornar o vetor como string "[0.1,0.2,...]"
            if isinstance(emb, str):
                import json
                emb = json.loads(emb)

            matches = find_similar_photos(
                query_embedding=emb,
                match_threshold=threshold,
                match_count=max_results,
                lat=lat,
                lng=lng,
                radius_km=radius_km if (lat is not None and lng is not None) else None,
                search_types=types,
                exclude_post_id=post_id,
            )
            for m in matches:
                key = m["photo_url"]
                if key not in best or m["similarity"] > best[key]["similarity"]:
                    best[key] = m

        if not best:
            return []

        results = sorted(best.values(), key=lambda m: m["similarity"], reverse=True)[:max_results]

        post_ids = list({m["post_id"] for m in results})
        matched_posts = get_post_details(post_ids)
        posts_map = {p["id"]: p for p in matched_posts}

        return [
            MatchResult(
                post_id=m["post_id"],
                photo_url=m["photo_url"],
                similarity=round(m["similarity"], 4),
                distance_km=round(m["distance_km"], 2) if m.get("distance_km") is not None else None,
                post=posts_map.get(m["post_id"]),
            )
            for m in results
        ]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao buscar matches: {str(e)}")


@app.post("/embeddings/batch")
async def batch_generate_embeddings():
    """Gera embeddings para todos os posts que ainda não têm (reprocessamento)."""
    try:
        posts = get_posts_without_embeddings()

        if not posts:
            return {"message": "Todos os posts já possuem embeddings!", "processed": 0}

        processed = 0
        errors = []

        async with httpx.AsyncClient() as client:
            for post in posts:
                post_id = post["id"]
                for photo_url in post.get("photos", []):
                    try:
                        response = await client.get(photo_url)
                        if response.status_code != 200:
                            errors.append(f"Erro ao baixar {photo_url}: HTTP {response.status_code}")
                            continue
                        result = process_image(response.content)
                        save_embedding(post_id, photo_url, result["embedding"])
                        processed += 1
                    except Exception as e:
                        errors.append(f"Erro ao processar {photo_url}: {str(e)}")

        return {
            "message": "Processamento concluído!",
            "processed": processed,
            "errors": errors if errors else None,
            "total_posts": len(posts),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro no processamento em lote: {str(e)}")


@app.delete("/embeddings/{post_id}")
async def remove_embeddings(post_id: str):
    """Remove todos os embeddings de um post."""
    try:
        delete_embeddings(post_id)
        return {"message": f"Embeddings do post {post_id} removidos com sucesso."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao remover embeddings: {str(e)}")


# =====================
# Run
# =====================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=HOST, port=PORT, reload=True)
