from pathlib import Path

import pytest
from PIL import Image

IMAGES = Path(__file__).resolve().parent.parent / "test_images"


def test_blank_image_has_no_animal():
    from detector import detector
    assert detector.detect(Image.new("RGB", (640, 480), (120, 160, 90))) is None


def test_dog_photo_is_detected_as_dog():
    from detector import detector
    det = detector.detect(Image.open(IMAGES / "labrador_1.jpg"))
    assert det is not None
    assert det.species == "dog"
    assert 0 < det.confidence <= 1


@pytest.mark.skipif(not (IMAGES / "cat_1.jpg").exists(), reason="adicione test_images/cat_1.jpg")
def test_cat_photo_is_detected_as_cat():
    from detector import detector
    det = detector.detect(Image.open(IMAGES / "cat_1.jpg"))
    assert det is not None and det.species == "cat"


def test_process_image_reports_species_and_crop():
    from pipeline import process_image
    res = process_image((IMAGES / "labrador_1.jpg").read_bytes())
    assert res["species"] == "dog" and res["cropped"] is True
    assert len(res["embedding"]) == 384
    blank = process_image(Image.new("RGB", (320, 240), (0, 0, 0)))
    assert blank["species"] is None and blank["cropped"] is False and blank["confidence"] is None


def test_samoyed_is_classified_as_dog():
    """YOLO-nano confunde samoieda com gato; a espécie final deve vir do classificador."""
    from pipeline import process_image
    for name in ("samoyed_1.jpg", "samoyed_2.jpg"):
        res = process_image((IMAGES / name).read_bytes())
        assert res["species"] == "dog", name
        assert res["confidence"] >= 0.85
