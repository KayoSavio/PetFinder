import math


def unit(i: int, dim: int = 384) -> list[float]:
    """Vetor unitário no eixo i."""
    v = [0.0] * dim
    v[i] = 1.0
    return v


def blend(a: list[float], b: list[float], t: float) -> list[float]:
    """Vetor normalizado entre a e b (t=0 → a)."""
    v = [(1 - t) * x + t * y for x, y in zip(a, b)]
    n = math.sqrt(sum(x * x for x in v))
    return [x / n for x in v]


def test_save_and_read_embedding(db, make_post):
    pid = make_post()
    saved = db.save_embedding(pid, "https://x/1.jpg", unit(0), "dog")
    assert saved["post_id"] == pid and saved["species"] == "dog"
    rows = db.get_embeddings_for_post(pid)
    assert len(rows) == 1 and rows[0]["species"] == "dog"
    assert isinstance(rows[0]["embedding"], str) and rows[0]["embedding"].startswith("[")


def test_match_respects_threshold_and_type(db, make_post):
    found = make_post("found")
    lost = make_post("lost")
    db.save_embedding(found, "https://x/f.jpg", blend(unit(0), unit(1), 0.1), "dog")
    db.save_embedding(lost, "https://x/l.jpg", unit(0), "dog")

    res = db.find_similar_photos(unit(0), match_threshold=0.9, search_types=["found"])
    assert [r["post_id"] for r in res] == [found]
    assert res[0]["similarity"] > 0.9

    none = db.find_similar_photos(unit(5), match_threshold=0.9, search_types=["found"])
    assert none == []


def test_match_never_crosses_species(db, make_post):
    cat_post = make_post("found")
    unknown_post = make_post("found")
    db.save_embedding(cat_post, "https://x/cat.jpg", unit(0), "cat")
    db.save_embedding(unknown_post, "https://x/unk.jpg", unit(0), None)

    res = db.find_similar_photos(unit(0), match_threshold=0.5, search_types=["found"], query_species="dog")
    assert [r["post_id"] for r in res] == [unknown_post]

    res_cat = db.find_similar_photos(unit(0), match_threshold=0.5, search_types=["found"], query_species="cat")
    assert {r["post_id"] for r in res_cat} == {cat_post, unknown_post}


def test_match_radius_and_distance(db, make_post):
    near = make_post("found", lat=-23.55, lng=-46.63)
    far = make_post("found", lat=-22.90, lng=-43.17)  # Rio de Janeiro
    db.save_embedding(near, "https://x/n.jpg", unit(0), "dog")
    db.save_embedding(far, "https://x/f.jpg", unit(0), "dog")

    res = db.find_similar_photos(unit(0), match_threshold=0.5, lat=-23.551, lng=-46.631,
                                 radius_km=15, search_types=["found"])
    assert [r["post_id"] for r in res] == [near]
    assert 0 <= res[0]["distance_km"] < 1


def test_resolved_posts_are_ignored(db, make_post):
    pid = make_post("found", status="resolved")
    db.save_embedding(pid, "https://x/r.jpg", unit(0), "dog")
    assert db.find_similar_photos(unit(0), match_threshold=0.5, search_types=["found"]) == []


def test_post_details_and_pending(db, make_post):
    pid = make_post("lost")
    details = db.get_post_details([pid])
    assert details[0]["id"] == pid
    assert isinstance(details[0]["pin_lat"], float)
    assert db.get_post_details([]) == []

    with db.get_pool().connection() as conn:
        conn.execute("UPDATE posts SET photos = ARRAY['https://x/p.jpg'] WHERE id = %s", (pid,))
    assert [p["id"] for p in db.get_posts_without_embeddings()] == [pid]
    db.save_embedding(pid, "https://x/p.jpg", unit(0))
    assert db.get_posts_without_embeddings() == []

    db.delete_embeddings(pid)
    assert db.get_embeddings_for_post(pid) == []


def test_pending_lists_only_photos_without_embedding(db, make_post):
    """Post com 2 fotos e só 1 processada volta para o batch, só com a foto que falta."""
    pid = make_post("lost")
    with db.get_pool().connection() as conn:
        conn.execute("UPDATE posts SET photos = ARRAY['https://x/1.jpg', 'https://x/2.jpg'] WHERE id = %s", (pid,))
    db.save_embedding(pid, "https://x/1.jpg", unit(0))
    assert db.get_posts_without_embeddings() == [{"id": pid, "photos": ["https://x/2.jpg"]}]
