from types import SimpleNamespace

from flask import Flask, g, jsonify

from backend.auth import require_auth


def make_app():
    app = Flask(__name__)
    app.config.update(SUPABASE_URL="https://example.supabase.co", SUPABASE_ANON_KEY="anon-key")

    @app.get("/private")
    @require_auth
    def private():
        return jsonify({"user_id": g.user_id})

    return app


def test_auth_rejects_missing_token():
    response = make_app().test_client().get("/private")
    assert response.status_code == 401


def test_auth_accepts_valid_supabase_user(monkeypatch):
    fake_response = SimpleNamespace(status_code=200, json=lambda: {"id": "18b10b8a-cd0d-4ba8-a486-44d889399cab"})
    monkeypatch.setattr("backend.auth.requests.get", lambda *args, **kwargs: fake_response)
    response = make_app().test_client().get("/private", headers={"Authorization": "Bearer valid-token"})
    assert response.status_code == 200
    assert response.get_json()["user_id"] == "18b10b8a-cd0d-4ba8-a486-44d889399cab"
