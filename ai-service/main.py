"""
spykke AI Service — Servidor FastAPI para comparação visual de pets.

Pipeline v3: YOLOv8n recorta o animal → CLIP diz se é cachorro ou gato → DINOv2 gera o embedding.
(CLIP não gera o embedding — não distingue bem indivíduos da mesma raça; só classifica a espécie.)

Endpoints:
  POST /embeddings/generate          — Gera embedding de uma foto (upload) e salva
  POST /embeddings/generate-from-url — Gera embedding a partir de URL e salva
  POST /match                        — Compara foto com posts ativos (+ filtro geográfico)
  POST /embeddings/batch             — Gera embeddings das fotos que ainda não têm
  GET  /health                       — Healthcheck
"""

import json
from io import BytesIO
from urllib.parse import urlparse

import httpx
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from PIL import Image, UnidentifiedImageError

from config import (
    HOST,
    PORT,
    DEFAULT_MATCH_THRESHOLD,
    DEFAULT_MATCH_COUNT,
    DEFAULT_MATCH_RADIUS_KM,
    DINO_MODEL_NAME,
)
from pipeline import analyze_image, process_image
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


class AnalyzeResponse(BaseModel):
    has_animal: bool
    species: Optional[str] = None
    confidence: Optional[float] = None


# Fotos só vêm do Vercel Blob; qualquer outra URL é recusada (evita SSRF)
BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com"
MAX_DOWNLOAD_BYTES = 10 * 1024 * 1024


def _is_allowed_photo_url(photo_url: str) -> bool:
    url = urlparse(photo_url)
    return url.scheme == "https" and (url.hostname or "").endswith(BLOB_HOST_SUFFIX)


def _client() -> httpx.AsyncClient:
    return httpx.AsyncClient(timeout=20)


async def _download(photo_url: str) -> bytes:
    if not _is_allowed_photo_url(photo_url):
        raise HTTPException(status_code=400, detail="URL de foto não permitida")
    try:
        async with _client() as client:
            async with client.stream("GET", photo_url) as response:
                if response.status_code != 200:
                    raise HTTPException(status_code=400, detail="Não foi possível baixar a imagem")
                data = bytearray()
                async for chunk in response.aiter_bytes():
                    data.extend(chunk)
                    if len(data) > MAX_DOWNLOAD_BYTES:
                        raise HTTPException(status_code=400, detail="Imagem grande demais")
    except httpx.HTTPError:
        raise HTTPException(status_code=400, detail="Não foi possível baixar a imagem")
    return bytes(data)


# =====================
# Endpoints
# =====================

@app.get("/health")
async def health():
    """Healthcheck — verifica se o serviço e os modelos estão OK."""
    from dino_model import dino_embedder
    return {
        "status": "ok",
        "pipeline": "yolov8n-crop + clip-species + dinov2",
        "model": DINO_MODEL_NAME,
        "device": dino_embedder.device,
    }


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze_photo(
    file: Optional[UploadFile] = File(None),
    photo_url: Optional[str] = Form(None),
):
    """Só detecta: tem cachorro/gato na foto? Usado no formulário antes de salvar."""
    if file is None and not photo_url:
        raise HTTPException(status_code=400, detail="Envie 'file' ou 'photo_url'")
    image_bytes = await file.read() if file is not None else await _download(photo_url)
    try:
        image = Image.open(BytesIO(image_bytes))
        image.load()
    except (UnidentifiedImageError, OSError):
        raise HTTPException(status_code=400, detail="Arquivo não é uma imagem válida")
    a = analyze_image(image)
    return AnalyzeResponse(has_animal=a["has_animal"], species=a["species"], confidence=a["confidence"])


def _process_and_save(image_bytes: bytes, post_id: str, photo_url: str) -> EmbeddingResponse:
    """Recorta o animal, gera o embedding e salva no banco."""
    result = process_image(image_bytes)
    saved = save_embedding(post_id, photo_url, result["embedding"], result["species"])
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
    """Gera embedding de uma foto (upload direto) e salva no banco."""
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
    """Gera embedding a partir de uma URL de foto (Vercel Blob)."""
    try:
        image_bytes = await _download(photo_url)
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
            query_species=result["species"],
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
            # O banco devolve o vetor como string "[0.1,0.2,...]"
            if isinstance(emb, str):
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
                query_species=emb_row.get("species"),
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

        for post in posts:
            post_id = post["id"]
            for photo_url in post.get("photos", []):
                try:
                    try:
                        image_bytes = await _download(photo_url)
                    except HTTPException as e:
                        errors.append(f"Erro ao baixar {photo_url}: {e.detail}")
                        continue
                    result = process_image(image_bytes)
                    save_embedding(post_id, photo_url, result["embedding"], result["species"])
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
