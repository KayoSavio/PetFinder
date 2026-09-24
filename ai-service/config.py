import os
from dotenv import load_dotenv

load_dotenv()

# Banco (Neon Postgres)
DATABASE_URL = os.getenv("DATABASE_URL", "")

# Modelo de embedding — DINOv2 (melhor que CLIP para distinguir indivíduos)
DINO_MODEL_NAME = "facebook/dinov2-small"
EMBEDDING_DIM = 384

# CLIP: classificador de espécie (cachorro × gato) sobre o recorte do YOLO
CLIP_MODEL_NAME = "openai/clip-vit-base-patch32"
SPECIES_MIN_PROB = 0.85             # abaixo disso a espécie fica desconhecida (não filtra)

# Detector de animais (recorte antes do embedding)
YOLO_MODEL_NAME = "yolov8n.pt"      # nano: 6MB, rápido em CPU
YOLO_CONF_THRESHOLD = 0.35          # confiança mínima da detecção
CROP_PADDING = 0.08                 # 8% de margem ao redor do animal

# Matching
DEFAULT_MATCH_THRESHOLD = 0.60      # Similaridade mínima (0-1)
DEFAULT_MATCH_COUNT = 10            # Número máximo de matches retornados
DEFAULT_MATCH_RADIUS_KM = 15       # Raio geográfico padrão da busca

# Servidor
HOST = os.getenv("AI_SERVICE_HOST", "127.0.0.1")   # só local; o serviço não tem autenticação
PORT = int(os.getenv("AI_SERVICE_PORT", "8000"))
