"""
Pipeline completo de processamento de fotos:
  1. Detecta e recorta o animal (YOLOv8n)
  2. Gera o embedding do recorte (DINOv2)

Este é o módulo que o main.py usa. Se quiser trocar o modelo de
embedding no futuro (ex: MegaDescriptor com GPU), basta mudar aqui.
"""

from io import BytesIO
from typing import Union

from PIL import Image

from detector import detector
from dino_model import dino_embedder


def process_image(image: Union[Image.Image, bytes]) -> dict:
    """
    Processa uma foto: recorta o animal e gera o embedding.

    Returns:
        {
          "embedding": list[float],   # 384 dims, normalizado
          "species": "dog"|"cat"|None, # espécie detectada
          "cropped": bool,             # se o recorte foi aplicado
        }
    """
    if isinstance(image, bytes):
        image = Image.open(BytesIO(image))

    cropped_image, species = detector.detect_and_crop(image)
    embedding = dino_embedder.generate_embedding(cropped_image)

    return {
        "embedding": embedding,
        "species": species,
        "cropped": species is not None,
    }


def compute_similarity(emb1: list[float], emb2: list[float]) -> float:
    """Similaridade coseno entre dois embeddings."""
    return dino_embedder.compute_similarity(emb1, emb2)
