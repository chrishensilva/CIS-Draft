from sqlalchemy import Column, Integer, String, Text, Date, Boolean, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from pgvector.sqlalchemy import Vector
from sqlalchemy.orm import relationship
import uuid
from .database import Base

class Criminal(Base):
    __tablename__ = 'criminals'

    id = Column(Integer, primary_key=True, index=True)
    system_uid = Column(UUID(as_uuid=True), default=uuid.uuid4, unique=True, nullable=False)
    true_first_name = Column(String(100), nullable=False)
    true_last_name = Column(String(100), nullable=False)
    date_of_birth = Column(Date, nullable=False)
    gender = Column(String(20))
    nationality = Column(String(50))
    distinguishing_marks = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    biometrics = relationship("CriminalBiometric", back_populates="criminal", cascade="all, delete-orphan")
    records = relationship("CriminalRecord", back_populates="criminal", cascade="all, delete-orphan")


class CriminalBiometric(Base):
    __tablename__ = 'criminal_biometrics'

    id = Column(Integer, primary_key=True, index=True)
    criminal_id = Column(Integer, ForeignKey('criminals.id', ondelete='CASCADE'), nullable=False)
    image_storage_url = Column(Text, nullable=False)
    face_embedding = Column(Vector(512), nullable=False)  # 512-Dimensional Vector
    is_primary_face = Column(Boolean, default=True)
    captured_at = Column(DateTime, server_default=func.now())

    criminal = relationship("Criminal", back_populates="biometrics")


class CriminalRecord(Base):
    __tablename__ = 'criminal_records'

    id = Column(Integer, primary_key=True, index=True)
    criminal_id = Column(Integer, ForeignKey('criminals.id', ondelete='CASCADE'), nullable=False)
    booking_officer_id = Column(Integer, nullable=False, default=1)
    arrest_date = Column(Date, nullable=False)
    charge_category = Column(String(100), nullable=False)  # e.g., Theft, Narcotics, Cybercrime
    charge_details = Column(Text, nullable=False)
    modus_operandi = Column(Text)
    case_status = Column(String(50), default='Arrested')
    notes = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

    criminal = relationship("Criminal", back_populates="records")


class AuditLog(Base):
    __tablename__ = 'audit_logs'

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(100), nullable=False)
    action = Column(String(100), nullable=False)
    ip_address = Column(String(50))
    reason = Column(Text)
    details = Column(Text)
    timestamp = Column(DateTime, server_default=func.now())
