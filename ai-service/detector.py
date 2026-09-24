"""
Módulo de detecção de animais (cachorro/gato) para recorte da foto.
Usa YOLOv8-nano (COCO): classe 15 = gato, classe 16 = cachorro.

Por que recortar? O fundo (rua, grama, calçada) domina a similaridade
visual. Recortando só o animal, o embedding representa o PET, não a cena.
"""

from io import BytesIO
from typing import Optional, Union

from PIL import Image
from ultralytics import YOLO

from config import YOLO_MODEL_NAME, YOLO_CONF_THRESHOLD, CROP_PADDING

# Classes COCO de interesse
COCO_CAT = 15
COCO_DOG = 16
ANIMAL_CLASSES = {COCO_CAT, COCO_DOG}


class AnimalDetector:
    """Singleton que carrega o YOLOv8 e recorta o animal da imagem."""

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        print(f"🔄 Carregando detector: {YOLO_MODEL_NAME}...")
        self.model = YOLO(YOLO_MODEL_NAME)
        self._initialized = True
        print("✅ Detector YOLO carregado!")

    def detect_and_crop(
        self, image: Union[Image.Image, bytes]
    ) -> tuple[Image.Image, Optional[str]]:
        """
        Detecta o animal na imagem e retorna o recorte.

        Args:
            image: PIL Image ou bytes da imagem

        Returns:
            (imagem recortada, espécie detectada 'dog'/'cat'/None)
            Se nenhum animal for detectado, retorna a imagem original.
        """
        if isinstance(image, bytes):
            image = Image.open(BytesIO(image))
        if image.mode != "RGB":
            image = image.convert("RGB")

        results = self.model.predict(
            image, conf=YOLO_CONF_THRESHOLD, verbose=False
        )

        best_box = None
        best_score = 0.0
        best_cls = None

        for result in results:
            for box in result.boxes:
                cls = int(box.cls[0])
                if cls not in ANIMAL_CLASSES:
                    continue
                conf = float(box.conf[0])
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                area = (x2 - x1) * (y2 - y1)
                # Score = confiança * área relativa (prioriza o animal principal)
                score = conf * (area / (image.width * image.height))
                if score > best_score:
                    best_score = score
                    best_box = (x1, y1, x2, y2)
                    best_cls = "cat" if cls == COCO_CAT else "dog"

        if best_box is None:
            # Nenhum animal detectado — usa a imagem inteira (fallback seguro)
            return image, None

        # Adiciona padding ao redor do box (contexto ajuda um pouco)
        x1, y1, x2, y2 = best_box
        pad_x = (x2 - x1) * CROP_PADDING
        pad_y = (y2 - y1) * CROP_PADDING
        x1 = max(0, x1 - pad_x)
        y1 = max(0, y1 - pad_y)
        x2 = min(image.width, x2 + pad_x)
        y2 = min(image.height, y2 + pad_y)

        cropped = image.crop((int(x1), int(y1), int(x2), int(y2)))
        return cropped, best_cls


# Instância global (lazy — só carrega quando importado)
detector = AnimalDetector()
