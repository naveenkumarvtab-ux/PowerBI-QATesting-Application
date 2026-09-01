from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import declarative_base, relationship
import datetime

Base = declarative_base()

class Job(Base):
    __tablename__ = 'jobs'
    
    id = Column(String(36), primary_key=True)
    method = Column(String(50))  # 'pbix' or 'service'
    source = Column(String(500))
    status = Column(String(50), default='queued')  # 'queued', 'running', 'complete', 'failed'
    progress = Column(Integer, default=0)
    current_step = Column(String(255), default='')
    started_at = Column(DateTime, default=datetime.datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    
    # summary counts
    summary_total = Column(Integer, default=0)
    summary_passed = Column(Integer, default=0)
    summary_failed = Column(Integer, default=0)
    summary_warnings = Column(Integer, default=0)
    
    # report file paths
    report_pdf_path = Column(String(500), nullable=True)
    report_html_path = Column(String(500), nullable=True)
    layout_str = Column(Text, nullable=True)
    excluded_counts_str = Column(Text, nullable=True)
    
    violations = relationship("RuleViolation", back_populates="job", cascade="all, delete-orphan")

    def to_dict(self):
        import json
        return {
            "job_id": self.id,
            "method": self.method,
            "source": self.source,
            "status": self.status,
            "progress": self.progress,
            "current_step": self.current_step,
            "started_at": self.started_at.strftime('%Y-%m-%dT%H:%M:%SZ') if self.started_at else None,
            "completed_at": self.completed_at.strftime('%Y-%m-%dT%H:%M:%SZ') if self.completed_at else None,
            "summary": {
                "total_checks": self.summary_total,
                "passed": self.summary_passed,
                "failed": self.summary_failed,
                "warnings": self.summary_warnings
            },
            "layout_str": self.layout_str,
            "excluded_counts": json.loads(self.excluded_counts_str) if self.excluded_counts_str else {}
        }

class RuleViolation(Base):
    __tablename__ = 'rule_violations'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    job_id = Column(String(36), ForeignKey('jobs.id'))
    category = Column(String(100))  # e.g., 'power_query_naming', 'dax_naming', 'functional', etc.
    target = Column(String(255))
    status = Column(String(50))  # 'pass', 'fail', 'warning'
    message = Column(Text)
    suggested_fix = Column(Text)
    screenshot_url = Column(String(500), nullable=True)
    page_name = Column(String(255), nullable=True)
    visual_id = Column(String(255), nullable=True)
    visual_title = Column(String(255), nullable=True)
    
    job = relationship("Job", back_populates="violations")

    def to_dict(self):
        return {
            "target": self.target,
            "category": self.category,
            "status": self.status,
            "message": self.message,
            "suggested_fix": self.suggested_fix,
            "screenshot_url": self.screenshot_url,
            "page_name": self.page_name,
            "visual_id": self.visual_id,
            "visual_title": self.visual_title
        }
