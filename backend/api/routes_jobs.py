import os
from flask import Blueprint, jsonify, send_file, request, current_app
from backend.models.job import Job, RuleViolation
from backend.config import Config
from backend.core.report_builder import ReportBuilder

jobs_bp = Blueprint('jobs', __name__)

def get_db_session():
    # Retrieve the thread-local database session initialized in app.py
    return current_app.db_session_factory()

@jobs_bp.route('/api/jobs', methods=['GET'])
def list_jobs():
    session = get_db_session()
    try:
        method = request.args.get('method')
        status = request.args.get('status')
        
        query = session.query(Job)
        if method:
            query = query.filter(Job.method == method)
        if status:
            query = query.filter(Job.status == status)
            
        # Order by started_at descending
        jobs = query.order_by(Job.started_at.desc()).all()
        return jsonify([j.to_dict() for j in jobs])
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()

@jobs_bp.route('/api/jobs/<job_id>/status', methods=['GET'])
def get_job_status(job_id):
    session = get_db_session()
    try:
        job = session.query(Job).filter(Job.id == job_id).first()
        if not job:
            return jsonify({"error": "Job not found"}), 404
            
        return jsonify({
            "job_id": job.id,
            "status": job.status,
            "progress": job.progress,
            "current_step": job.current_step,
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "completed_at": job.completed_at.isoformat() if job.completed_at else None
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()

@jobs_bp.route('/api/jobs/<job_id>/result', methods=['GET'])
def get_job_result(job_id):
    session = get_db_session()
    try:
        job = session.query(Job).filter(Job.id == job_id).first()
        if not job:
            return jsonify({"error": "Job not found"}), 404
            
        violations = session.query(RuleViolation).filter(RuleViolation.job_id == job_id).all()
        
        # Build standard output using ReportBuilder
        violations_data = [v.to_dict() for v in violations]
        report_json = ReportBuilder.build_json(job, violations_data, layout_str=job.layout_str)
        
        return jsonify(report_json)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()

@jobs_bp.route('/api/jobs/<job_id>/report.pdf', methods=['GET'])
def download_pdf(job_id):
    session = get_db_session()
    try:
        job = session.query(Job).filter(Job.id == job_id).first()
        if not job or not job.report_pdf_path or not os.path.exists(job.report_pdf_path):
            return jsonify({"error": "PDF report not found. Verify if the job finished successfully."}), 404
            
        return send_file(
            job.report_pdf_path,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f"pbi_qa_report_{job_id}.pdf"
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()

@jobs_bp.route('/api/reports/screenshots/<filename>', methods=['GET'])
def get_screenshot(filename):
    screenshot_path = os.path.join(Config.REPORT_FOLDER, "screenshots", filename)
    if not os.path.exists(screenshot_path):
        return jsonify({"error": "Screenshot not found"}), 404
        
    return send_file(screenshot_path, mimetype='image/png')
