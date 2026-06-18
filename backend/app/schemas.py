from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import date, datetime
from uuid import UUID

# Pydantic schemas for response models

class CriminalRecordSchema(BaseModel):
    arrest_date: date
    charge_category: str
    charge_details: str
    modus_operandi: Optional[str] = None
    case_status: str
    notes: Optional[str] = None

    class Config:
        from_attributes = True


class CriminalProfileSchema(BaseModel):
    system_uid: UUID
    true_name: str
    aliases: List[str]
    dob: date
    gender: Optional[str] = None
    nationality: Optional[str] = None
    distinguishing_marks: Optional[str] = None
    image_url: Optional[str] = None  # Enrolled mugshot URL for dossier side-by-side view

    class Config:
        from_attributes = True


class MatchResponseSchema(BaseModel):
    match_found: bool
    confidence_score: float
    criminal_profile: Optional[CriminalProfileSchema] = None
    historical_records: List[CriminalRecordSchema] = []


class EnrollmentResponseSchema(BaseModel):
    success: bool
    message: str
    system_uid: UUID
    criminal_id: int
