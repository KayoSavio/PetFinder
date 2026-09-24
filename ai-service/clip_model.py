"""
Módulo do modelo CLIP para geração de embeddings visuais.
Usa o modelo openai/clip-vit-base-patch32 via HuggingFace Transformers.
"""

import torch
import numpy as np
from PIL import Image
from transformers import CLIPProcessor, CLIPModel
from io import BytesIO
from typing import Union

from config import CLIP_MODEL_NAME
CLIP_EMBEDDING_DIM = 512


class CLIPEmbedder:
    """Singleton que carrega o modelo CLIP e gera embeddings de imagens."""

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        
        print(f"🔄 Carregando modelo CLIP: {CLIP_MODEL_NAME}...")
        
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"📱 Usando dispositivo: {self.device}")
        
        self.model = CLIPModel.from_pretrained(CLIP_MODEL_NAME).to(self.device)
        self.processor = CLIPProcessor.from_pretrained(CLIP_MODEL_NAME)
        
        # Coloca o modelo em modo de avaliação (desativa dropout, etc.)
        self.model.eval()
        
        self._initialized = True
        print(f"✅ Modelo CLIP carregado com sucesso! (dim={CLIP_EMBEDDING_DIM})")

    def generate_embedding(self, image: Union[Image.Image, bytes]) -> list[float]:
        """
        Gera um embedding vetorial normalizado de uma imagem.
        
        Args:
            image: PIL Image ou bytes da imagem
            
        Returns:
            Lista de floats com o embedding (512 dimensões)
        """
        if isinstance(image, bytes):
            image = Image.open(BytesIO(image))
        
        # Converte para RGB se necessário (CLIP precisa de 3 canais)
        if image.mode != "RGB":
            image = image.convert("RGB")
        
        # Processa a imagem para o formato esperado pelo CLIP
        inputs = self.processor(images=image, return_tensors="pt").to(self.device)
        
        # Gera o embedding sem calcular gradientes (mais rápido)
        with torch.no_grad():
            outputs = self.model.get_image_features(**inputs)
            # Em versões recentes, get_image_features pode retornar um objeto se return_dict=True
            if isinstance(outputs, torch.Tensor):
                image_features = outputs
            elif hasattr(outputs, "image_embeds"):
                image_features = outputs.image_embeds
            elif hasattr(outputs, "pooler_output"):
                image_features = outputs.pooler_output
            else:
                # Fallback: pega o primeiro elemento se for uma tupla/lista
                image_features = outputs[0] if isinstance(outputs, (list, tuple)) else outputs
        
        # Normaliza o vetor (importante para similaridade coseno)
        # Se image_features ainda não for um tensor com .norm, tentamos converter
        if not hasattr(image_features, "norm"):
            image_features = torch.tensor(image_features)

        image_features = image_features / image_features.norm(p=2, dim=-1, keepdim=True)
        
        # Converte para lista Python
        embedding = image_features.cpu().numpy().flatten().tolist()
        
        return embedding

    def compute_similarity(self, embedding1: list[float], embedding2: list[float]) -> float:
        """
        Calcula a similaridade coseno entre dois embeddings.
        
        Args:
            embedding1: Primeiro embedding
            embedding2: Segundo embedding
            
        Returns:
            Similaridade coseno (0-1, onde 1 = idêntico)
        """
        vec1 = np.array(embedding1)
        vec2 = np.array(embedding2)
        
        similarity = np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2))
        
        return float(similarity)


# Instância global do embedder
embedder = CLIPEmbedder()
