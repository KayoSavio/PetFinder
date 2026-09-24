"""
Módulo do modelo DINOv2 para geração de embeddings visuais.

Por que DINOv2 em vez de CLIP?
- CLIP aprende semântica ("é um cachorro dourado") → cães parecidos da
  mesma raça ficam quase idênticos (seu teste: 0.8566 vs 0.8525!).
- DINOv2 aprende características visuais finas (textura, padrões de
  pelagem, formato) → separa muito melhor INDIVÍDUOS.
- dinov2-small roda bem em CPU (~22M params, embedding de 384 dims).
"""

import torch
import numpy as np
from PIL import Image
from transformers import AutoImageProcessor, AutoModel
from io import BytesIO
from typing import Union

from config import DINO_MODEL_NAME, EMBEDDING_DIM


class DinoEmbedder:
    """Singleton que carrega o DINOv2 e gera embeddings de imagens."""

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        print(f"🔄 Carregando modelo DINOv2: {DINO_MODEL_NAME}...")
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"📱 Usando dispositivo: {self.device}")

        self.processor = AutoImageProcessor.from_pretrained(DINO_MODEL_NAME)
        self.model = AutoModel.from_pretrained(DINO_MODEL_NAME).to(self.device)
        self.model.eval()

        self._initialized = True
        print(f"✅ DINOv2 carregado! (dim={EMBEDDING_DIM})")

    def generate_embedding(self, image: Union[Image.Image, bytes]) -> list[float]:
        """
        Gera um embedding vetorial normalizado de uma imagem.

        Returns:
            Lista de floats (EMBEDDING_DIM dimensões, normalizado L2)
        """
        if isinstance(image, bytes):
            image = Image.open(BytesIO(image))
        if image.mode != "RGB":
            image = image.convert("RGB")

        inputs = self.processor(images=image, return_tensors="pt").to(self.device)

        with torch.no_grad():
            outputs = self.model(**inputs)
            # CLS token (pooler_output) representa a imagem inteira
            if outputs.pooler_output is not None:
                features = outputs.pooler_output
            else:
                features = outputs.last_hidden_state[:, 0]

        # Normaliza (essencial para similaridade coseno no pgvector)
        features = features / features.norm(p=2, dim=-1, keepdim=True)
        return features.cpu().numpy().flatten().tolist()

    @staticmethod
    def compute_similarity(emb1: list[float], emb2: list[float]) -> float:
        """Similaridade coseno entre dois embeddings (0-1)."""
        v1, v2 = np.array(emb1), np.array(emb2)
        return float(np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2)))


# Instância global
dino_embedder = DinoEmbedder()
