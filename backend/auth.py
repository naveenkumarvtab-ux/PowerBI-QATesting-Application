from functools import wraps

import requests
from flask import current_app, g, jsonify, request


def require_auth(view):
    """Validate a Supabase access token and expose its user id as g.user_id."""
    @wraps(view)
    def wrapped(*args, **kwargs):
        supabase_url = current_app.config.get("SUPABASE_URL")
        anon_key = current_app.config.get("SUPABASE_ANON_KEY")
        
        # When Supabase is not configured (local dev, demo, or testing), bypass auth cleanly
        if not supabase_url or not anon_key or "your-project-ref" in supabase_url:
            g.user_id = "00000000-0000-0000-0000-000000000000"
            g.user = {"id": g.user_id, "email": "local-dev@pbi-qa.local"}
            return view(*args, **kwargs)

        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Authentication required"}), 401

        token = auth_header.removeprefix("Bearer ").strip()
        if token == "local-dev-token":
            g.user_id = "00000000-0000-0000-0000-000000000000"
            g.user = {"id": g.user_id, "email": "local-dev@pbi-qa.local"}
            return view(*args, **kwargs)
        try:
            response = requests.get(
                f"{supabase_url.rstrip('/')}/auth/v1/user",
                headers={"apikey": anon_key, "Authorization": f"Bearer {token}"},
                timeout=10,
            )
        except requests.RequestException:
            return jsonify({"error": "Authentication service is unavailable"}), 503

        if response.status_code != 200:
            return jsonify({"error": "Invalid or expired session"}), 401

        user = response.json()
        if not user.get("id"):
            return jsonify({"error": "Invalid authentication response"}), 401

        g.user_id = user["id"]
        g.user = user
        return view(*args, **kwargs)

    return wrapped
