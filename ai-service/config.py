import os
from dotenv import load_dotenv

load_dotenv()

# Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

# Modelo de embedding — DINOv2 (melhor que CLIP para distinguir indivíduos)
DINO_MODEL_NAME = "facebook/dinov2-small"
EMBEDDING_DIM = 384

# Modelo antigo (mantido apenas para testes comparativos)
CLIP_MODEL_NAME = "openai/clip-vit-base-patch32"

# Detector de animais (recorte antes do embedding)
YOLO_MODEL_NAME = "yolov8n.pt"      # nano: 6MB, rápido em CPU
YOLO_CONF_THRESHOLD = 0.35          # confiança mínima da detecção
CROP_PADDING = 0.08                 # 8% de margem ao redor do animal

# Matching
DEFAULT_MATCH_THRESHOLD = 0.60      # Similaridade mínima (0-1)
DEFAULT_MATCH_COUNT = 10            # Número máximo de matches retornados
DEFAULT_MATCH_RADIUS_KM = 15       # Raio geográfico padrão da busca

# Servidor
HOST = os.getenv("AI_SERVICE_HOST", "0.0.0.0")
PORT = int(os.getenv("AI_SERVICE_PORT", "8000"))
