import os
import sys

# Ensure UTF-8 output encoding on Windows to prevent 'charmap' codec crashes
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
if hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from flask import Flask, jsonify
from flask_cors import CORS
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, scoped_session
from backend.config import Config
from backend.models.job import Base

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    
    # Enable CORS globally for all origins (local dev and Render deployment)
    CORS(app, resources={r"/*": {"origins": "*"}})
    
    # Initialize SQLAlchemy database engine
    connect_args = {"check_same_thread": False} if "sqlite" in Config.DATABASE_URL else {}
    engine = create_engine(Config.DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
    
    # Scoped session factory for thread-safety across background jobs
    db_session_factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    app.db_session_factory = db_session_factory
    
    # Generate tables if they do not exist
    Base.metadata.create_all(bind=engine)
    
    # Import and register blueprints
    from backend.api.routes_pbix import pbix_bp
    from backend.api.routes_service import service_bp
    from backend.api.routes_jobs import jobs_bp
    
    app.register_blueprint(pbix_bp)
    app.register_blueprint(service_bp)
    app.register_blueprint(jobs_bp)
    
    @app.route('/api/health', methods=['GET'])
    def health_check():
        return jsonify({
            "status": "healthy",
            "app": "PBI QA Suite API",
            "mock_mode": Config.MOCK_SERVICE
        })

    # Close DB session on request teardown
    @app.teardown_appcontext
    def shutdown_session(exception=None):
        pass

    return app

app = create_app()

if __name__ == '__main__':
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
