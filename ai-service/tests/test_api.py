from io import BytesIO
from pathlib import Path

from fastapi.testclient import TestClient
from PIL import Image

IMAGES = Path(__file__).resolve().parent.parent / "test_images"


def client():
    from main import app
    return TestClient(app)


def test_analyze_dog_upload():
    with open(IMAGES / "labrador_1.jpg", "rb") as f:
        r = client().post("/analyze", files={"file": ("dog.jpg", f, "image/jpeg")})
    assert r.status_code == 200
    body = r.json()
    assert body["has_animal"] is True and body["species"] == "dog"


def test_analyze_photo_without_animal():
    buf = BytesIO()
    Image.new("RGB", (400, 300), (200, 200, 255)).save(buf, "JPEG")
    r = client().post("/analyze", files={"file": ("sky.jpg", buf.getvalue(), "image/jpeg")})
    assert r.status_code == 200
    assert r.json() == {"has_animal": False, "species": None, "confidence": None}


def test_analyze_requires_file_or_url():
    r = client().post("/analyze", data={})
    assert r.status_code == 400


def test_analyze_rejects_non_image():
    r = client().post("/analyze", files={"file": ("x.txt", b"nao sou imagem", "text/plain")})
    assert r.status_code == 400


def test_analyze_samoyed_is_dog():
    with open(IMAGES / "samoyed_1.jpg", "rb") as f:
        r = client().post("/analyze", files={"file": ("s.jpg", f, "image/jpeg")})
    assert r.json()["species"] == "dog"


def test_analyze_refuses_url_outside_blob():
    """Evita que o serviço baixe endereços internos/arbitrários (SSRF)."""
    for url in ("https://10.0.0.5/admin", "http://abc.public.blob.vercel-storage.com/a.jpg",
                "https://public.blob.vercel-storage.com.evil.com/a.jpg"):
        r = client().post("/analyze", data={"photo_url": url})
        assert r.status_code == 400, url
        assert r.json()["detail"] == "URL de foto não permitida"


def test_download_caps_size(monkeypatch):
    import asyncio

    import httpx
    import main

    big = b"x" * (main.MAX_DOWNLOAD_BYTES + 1)
    transport = httpx.MockTransport(lambda req: httpx.Response(200, content=big))
    monkeypatch.setattr(main, "_client", lambda: httpx.AsyncClient(transport=transport))
    try:
        asyncio.run(main._download("https://abc.public.blob.vercel-storage.com/a.jpg"))
        raise AssertionError("deveria recusar")
    except main.HTTPException as e:
        assert e.status_code == 400 and "grande" in e.detail
