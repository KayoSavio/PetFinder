import os
import sys
from PIL import Image

# Adiciona o diretório ai-service ao path
sys.path.append('d:/Projects/PetFinder/ai-service')

from clip_model import embedder

def test_similarity():
    # Caminhos das imagens geradas
    # NOTA: O agente deve substituir pelos caminhos reais das imagens geradas
    img_dog1_front = r"C:\Users\kayos\.gemini\antigravity\brain\04d46d3b-2ef7-49c5-8e40-a5d17eeb982c\dog_1_front_1773954071711.png"
    img_dog1_side = r"C:\Users\kayos\.gemini\antigravity\brain\04d46d3b-2ef7-49c5-8e40-a5d17eeb982c\dog_1_side_1773954085909.png"
    img_dog2 = r"C:\Users\kayos\.gemini\antigravity\brain\04d46d3b-2ef7-49c5-8e40-a5d17eeb982c\dog_2_1773954101744.png"

    print("📸 Carregando imagens e gerando embeddings...")
    
    # Gera embeddings (agora abrindo a imagem primeiro)
    emb_dog1_front = embedder.generate_embedding(Image.open(img_dog1_front))
    emb_dog1_side = embedder.generate_embedding(Image.open(img_dog1_side))
    emb_dog2 = embedder.generate_embedding(Image.open(img_dog2))

    # Compara similaridades
    sim_same_dog = embedder.compute_similarity(emb_dog1_front, emb_dog1_side)
    sim_diff_dog_1front_2 = embedder.compute_similarity(emb_dog1_front, emb_dog2)
    sim_diff_dog_1side_2 = embedder.compute_similarity(emb_dog1_side, emb_dog2)

    print("\n📊 Resultados da Similaridade Visual (0 a 1):")
    print(f"✅ Mesmo Cachorro (Frente vs Lado): {sim_same_dog:.4f}")
    print(f"❌ Cachorros Diferentes (Golden vs Pastor): {sim_diff_dog_1front_2:.4f}")
    print(f"❌ Cachorros Diferentes (Golden Lado vs Pastor): {sim_diff_dog_1side_2:.4f}")

    if sim_same_dog > sim_diff_dog_1front_2:
        print("\n🚀 TESTE PASSOU: O modelo reconheceu que o mesmo cachorro é mais similar entre si!")
    else:
        print("\n⚠️ TESTE FALHOU: A similaridade entre cães diferentes foi maior.")

if __name__ == "__main__":
    test_similarity()
