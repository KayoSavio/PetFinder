"""
Calibra o limiar de similaridade com fotos reais.

Coloque em test_images/ fotos nomeadas <individuo>_<n>.jpg
(mesmo prefixo = mesmo animal) e rode:  python calibrate.py
"""

from itertools import combinations
from pathlib import Path

from pipeline import compute_similarity, process_image

IMAGES = Path(__file__).parent / "test_images"


def main() -> None:
    files = sorted(p for p in IMAGES.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"})
    data = {}
    for f in files:
        res = process_image(f.read_bytes())
        data[f.name] = (f.stem.rsplit("_", 1)[0], res)
        print(f"{f.name:28} espécie={res['species']} recorte={res['cropped']}")

    same, diff = [], []
    for (a, (ia, ra)), (b, (ib, rb)) in combinations(data.items(), 2):
        s = compute_similarity(ra["embedding"], rb["embedding"])
        (same if ia == ib else diff).append(s)
        print(f"{'MESMO' if ia == ib else 'outro':5}  {s:.4f}  {a} × {b}")

    if not same or not diff:
        print("\n⚠️ Precisa de pelo menos um par do mesmo animal e um par de animais diferentes.")
        return
    lo_same, hi_diff = min(same), max(diff)
    print(f"\nMesmo animal:  min {lo_same:.4f}  média {sum(same)/len(same):.4f}")
    print(f"Animais difer.: máx {hi_diff:.4f}  média {sum(diff)/len(diff):.4f}")
    if lo_same > hi_diff:
        print(f"✅ Separação limpa. Limiar sugerido: {(lo_same + hi_diff) / 2:.2f}")
    else:
        print(f"⚠️ Sobreposição. Limiar que não perde nenhum match verdadeiro: {lo_same - 0.01:.2f}")


if __name__ == "__main__":
    main()
