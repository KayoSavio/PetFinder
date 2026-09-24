"""
Teste comparativo: CLIP (antigo) vs YOLO-crop + DINOv2 (novo).

Como usar:
  1. Crie a pasta ai-service/test_images/
  2. Coloque fotos nomeadas por pet: mesmo pet = mesmo prefixo antes do "_"
       rex_1.jpg, rex_2.jpg      → duas fotos do Rex
       luna_1.jpg, luna_2.jpg    → duas fotos da Luna
       bob_1.jpg                 → uma foto do Bob
  3. Rode: python test_compare_models.py

O teste compara TODOS os pares e mostra, para cada modelo:
  - similaridade média entre fotos do MESMO pet
  - similaridade média entre pets DIFERENTES
  - separação (quanto maior, melhor o modelo distingue indivíduos)
"""

import os
import sys
from itertools import combinations
from PIL import Image

TEST_DIR = os.path.join(os.path.dirname(__file__), "test_images")
VALID_EXT = {".jpg", ".jpeg", ".png", ".webp"}


def load_images() -> list[tuple[str, str, Image.Image]]:
    """Retorna [(pet_name, filename, image), ...]"""
    if not os.path.isdir(TEST_DIR):
        print(f"❌ Pasta não encontrada: {TEST_DIR}")
        print("   Crie a pasta e adicione fotos (ex: rex_1.jpg, rex_2.jpg, luna_1.jpg)")
        sys.exit(1)

    images = []
    for f in sorted(os.listdir(TEST_DIR)):
        name, ext = os.path.splitext(f)
        if ext.lower() not in VALID_EXT:
            continue
        pet = name.split("_")[0].lower()
        images.append((pet, f, Image.open(os.path.join(TEST_DIR, f)).convert("RGB")))

    if len(images) < 3:
        print("❌ Adicione pelo menos 3 fotos (2 do mesmo pet + 1 de outro).")
        sys.exit(1)

    pets = {p for p, _, _ in images}
    print(f"📸 {len(images)} fotos de {len(pets)} pets: {', '.join(sorted(pets))}\n")
    return images


def evaluate(name: str, embed_fn, images) -> dict:
    """Gera embeddings e calcula estatísticas de similaridade."""
    import numpy as np

    print(f"⚙️  Gerando embeddings com {name}...")
    embs = [(pet, fname, np.array(embed_fn(img))) for pet, fname, img in images]

    same, diff = [], []
    pairs = []
    for (p1, f1, e1), (p2, f2, e2) in combinations(embs, 2):
        sim = float(np.dot(e1, e2) / (np.linalg.norm(e1) * np.linalg.norm(e2)))
        pairs.append((f1, f2, sim, p1 == p2))
        (same if p1 == p2 else diff).append(sim)

    print(f"\n📊 {name}:")
    for f1, f2, sim, is_same in pairs:
        icon = "✅" if is_same else "❌"
        print(f"   {icon} {f1} × {f2}: {sim:.4f}")

    avg_same = sum(same) / len(same) if same else float("nan")
    avg_diff = sum(diff) / len(diff) if diff else float("nan")
    sep = avg_same - avg_diff

    print(f"   ── Média MESMO pet:      {avg_same:.4f}")
    print(f"   ── Média pets DIFERENTES: {avg_diff:.4f}")
    print(f"   ── SEPARAÇÃO:            {sep:+.4f}\n")
    return {"same": avg_same, "diff": avg_diff, "sep": sep}


def main():
    images = load_images()

    # ---- Modelo antigo: CLIP na imagem inteira ----
    from clip_model import embedder as clip_embedder
    clip_stats = evaluate("CLIP (imagem inteira)", clip_embedder.generate_embedding, images)

    # ---- Novo pipeline: YOLO crop + DINOv2 ----
    from detector import detector
    from dino_model import dino_embedder

    def new_pipeline(img):
        cropped, species = detector.detect_and_crop(img)
        return dino_embedder.generate_embedding(cropped)

    new_stats = evaluate("YOLO-crop + DINOv2", new_pipeline, images)

    # ---- Veredito ----
    print("=" * 50)
    print(f"Separação CLIP:          {clip_stats['sep']:+.4f}")
    print(f"Separação crop+DINOv2:   {new_stats['sep']:+.4f}")
    if new_stats["sep"] > clip_stats["sep"]:
        gain = new_stats["sep"] / clip_stats["sep"] if clip_stats["sep"] > 0 else float("inf")
        print(f"\n🚀 Novo pipeline distingue indivíduos {gain:.1f}x melhor!")
    else:
        print("\n⚠️ CLIP teve separação maior neste conjunto — adicione mais fotos de teste.")


if __name__ == "__main__":
    main()
