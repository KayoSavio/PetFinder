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
