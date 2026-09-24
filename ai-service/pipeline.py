"""
Pipeline completo de processamento de fotos:
  1. Detecta e recorta o animal (YOLOv8n)
  1b. Classifica a espécie no recorte (CLIP zero-shot)
  2. Gera o embedding do recorte (DINOv2)

Este é o módulo que o main.py usa. Se quiser trocar o modelo de
embedding no futuro (ex: MegaDescriptor com GPU), basta mudar aqui.
"""

from io import BytesIO
from typing import Union

from PIL import Image

from detector import detector
from dino_model import dino_embedder
from species import species_classifier


def process_image(image: Union[Image.Image, bytes]) -> dict:
    """
    Processa uma foto: recorta o animal e gera o embedding.

    Returns:
        {
          "embedding": list[float],     # 384 dims, normalizado
          "species": "dog"|"cat"|None,  # espécie detectada
          "confidence": float|None,     # probabilidade da espécie (CLIP)
          "cropped": bool,              # se o recorte foi aplicado
        }
    """
    if isinstance(image, bytes):
        image = Image.open(BytesIO(image))

    analysis = analyze_image(image)
    embedding = dino_embedder.generate_embedding(analysis["crop"])

    return {
        "embedding": embedding,
        "species": analysis["species"],
        "confidence": analysis["confidence"],
        "cropped": analysis["has_animal"],
    }


def analyze_image(image: Union[Image.Image, bytes]) -> dict:
    """
    Detecta o animal (YOLO) e classifica a espécie no recorte (CLIP).

    Returns:
        {
          "has_animal": bool,
          "species": "dog"|"cat"|None,   # None se não há animal ou CLIP incerto
          "confidence": float|None,      # probabilidade do CLIP
          "crop": PIL.Image,             # recorte (ou a imagem inteira)
        }
    """
    if isinstance(image, bytes):
        image = Image.open(BytesIO(image))

    crop, det = detector.detect_and_crop(image)
    if det is None:
        return {"has_animal": False, "species": None, "confidence": None, "crop": crop}

    species, prob = species_classifier.classify(crop)
    return {"has_animal": True, "species": species, "confidence": round(prob, 4), "crop": crop}


def compute_similarity(emb1: list[float], emb2: list[float]) -> float:
    """Similaridade coseno entre dois embeddings."""
    return dino_embedder.compute_similarity(emb1, emb2)
