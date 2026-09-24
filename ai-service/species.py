"""
Classificador de espécie (cachorro × gato) com CLIP zero-shot.

Por que não usar a classe do YOLO? O YOLOv8-nano confunde raças
peludas com gato (ex.: samoieda → "cat" com 0.48–0.54). O CLIP, olhando
o recorte do animal, separa cachorro de gato com >0.99 nesses casos.
O YOLO continua decidindo SE há animal e ONDE ele está.
"""

from typing import Optional

import torch
from PIL import Image
from transformers import CLIPModel, CLIPProcessor

from config import CLIP_MODEL_NAME, SPECIES_MIN_PROB

LABELS = {"dog": "a photo of a dog", "cat": "a photo of a cat"}


class SpeciesClassifier:
    """Singleton que carrega o CLIP e classifica o recorte como dog/cat."""

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        print(f"🔄 Carregando classificador de espécie: {CLIP_MODEL_NAME}...")
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model = CLIPModel.from_pretrained(CLIP_MODEL_NAME).to(self.device).eval()
        self.processor = CLIPProcessor.from_pretrained(CLIP_MODEL_NAME)
        with torch.no_grad():
            text = self.processor(text=list(LABELS.values()), return_tensors="pt", padding=True).to(self.device)
            feats = self.model.get_text_features(**text)
            if not isinstance(feats, torch.Tensor):
                feats = feats.pooler_output
            self.text_features = feats / feats.norm(dim=-1, keepdim=True)
        self._initialized = True
        print("✅ Classificador de espécie carregado!")

    def classify(self, image: Image.Image) -> tuple[Optional[str], float]:
        """
        Returns:
            (espécie, probabilidade). espécie = None quando a probabilidade
            fica abaixo de SPECIES_MIN_PROB (melhor não filtrar do que errar).
        """
        if image.mode != "RGB":
            image = image.convert("RGB")
        with torch.no_grad():
            inputs = self.processor(images=image, return_tensors="pt").to(self.device)
            feats = self.model.get_image_features(**inputs)
            if not isinstance(feats, torch.Tensor):
                feats = feats.pooler_output
            feats = feats / feats.norm(dim=-1, keepdim=True)
            logits = self.model.logit_scale.exp() * feats @ self.text_features.T
            probs = logits.softmax(dim=-1)[0].tolist()
        best = max(range(len(probs)), key=probs.__getitem__)
        species = list(LABELS)[best]
        prob = probs[best]
        return (species if prob >= SPECIES_MIN_PROB else None), prob


# Instância global
species_classifier = SpeciesClassifier()
