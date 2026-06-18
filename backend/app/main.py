import os
import shutil
import uuid
from datetime import date, datetime
from typing import List, Optional

from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, update

from app.database import get_db
from app.models import Criminal, CriminalBiometric, CriminalRecord, AuditLog
from app.schemas import (
    EnrollmentResponseSchema, MatchResponseSchema, CriminalProfileSchema,
    CriminalRecordSchema
)
from app.face_utils import extract_face_embedding

app = FastAPI(
    title="Criminal Face Recognition & Record Management System (CFRMS) API",
    version="1.0.0",
    docs_url="/api/docs"
)

# Enable CORS for the React Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure folders exist
STATIC_DIR = "static"
MUGSHOTS_DIR = os.path.join(STATIC_DIR, "mugshots")
os.makedirs(MUGSHOTS_DIR, exist_ok=True)

# Mount static files to serve enrolled mugshots
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


# Helper to log audit actions
async def log_audit(
    db: AsyncSession,
    user_id: str,
    action: str,
    ip_address: Optional[str],
    reason: Optional[str] = None,
    details: Optional[str] = None
):
    audit_entry = AuditLog(
        user_id=user_id,
        action=action,
        ip_address=ip_address or "0.0.0.0",
        reason=reason,
        details=details
    )
    db.add(audit_entry)
    await db.commit()


# Route 1: Criminal Enrollment
@app.post("/api/v1/criminals/enroll", response_model=EnrollmentResponseSchema)
async def enroll_criminal(
    request: Request,
    first_name: str = Form(...),
    last_name: str = Form(...),
    dob: str = Form(...),  # YYYY-MM-DD
    gender: Optional[str] = Form(None),
    nationality: Optional[str] = Form(None),
    distinguishing_marks: Optional[str] = Form(None),
    charge_category: str = Form(...),
    charge_details: str = Form(...),
    modus_operandi: Optional[str] = Form(None),
    case_status: Optional[str] = Form("Arrested"),
    user_id: str = Form("booking_officer_1"),  # Passed from frontend based on role
    reason: str = Form("Enrollment of a new arrest booking"),
    image: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    try:
        # Parse Date of Birth
        try:
            parsed_dob = date.fromisoformat(dob)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date of birth format. Use YYYY-MM-DD.")

        # Read image bytes
        contents = await image.read()
        
        # Extract 512-D face embedding vector (padded)
        try:
            face_vector = extract_face_embedding(contents)
        except ValueError as ve:
            raise HTTPException(status_code=400, detail=str(ve))

        # Save image file locally
        file_ext = os.path.splitext(image.filename)[1] or ".jpg"
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        filepath = os.path.join(MUGSHOTS_DIR, unique_filename)
        
        with open(filepath, "wb") as buffer:
            buffer.write(contents)
            
        image_url = f"/static/mugshots/{unique_filename}"

        # Create Criminal Master Record
        criminal = Criminal(
            true_first_name=first_name,
            true_last_name=last_name,
            date_of_birth=parsed_dob,
            gender=gender,
            nationality=nationality,
            distinguishing_marks=distinguishing_marks
        )
        db.add(criminal)
        await db.flush()  # Flushes to DB to get criminal.id

        # Create Biometric Mugshot Entry
        biometric = CriminalBiometric(
            criminal_id=criminal.id,
            image_storage_url=image_url,
            face_embedding=face_vector,
            is_primary_face=True
        )
        db.add(biometric)

        # Create Incident Case Record
        record = CriminalRecord(
            criminal_id=criminal.id,
            booking_officer_id=1,  # Default booking officer ID
            arrest_date=date.today(),
            charge_category=charge_category,
            charge_details=charge_details,
            modus_operandi=modus_operandi,
            case_status=case_status
        )
        db.add(record)
        
        # Commit transactional records
        await db.commit()

        # Log action to immutable audit database
        client_ip = request.client.host if request.client else "0.0.0.0"
        details_str = f"Enrolled criminal {first_name} {last_name} (ID: {criminal.id}) with primary charges: {charge_category}"
        await log_audit(db, user_id, "ENROLL_CRIMINAL", client_ip, reason, details_str)

        return {
            "success": True,
            "message": "Criminal profile and biometric mugshot enrolled successfully.",
            "system_uid": criminal.system_uid,
            "criminal_id": criminal.id
        }

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Database enrollment failure: {str(e)}")


# Route 2: Facial Identification / Search (1:N Matching)
@app.post("/api/v1/criminals/identify", response_model=MatchResponseSchema)
async def identify_suspect(
    request: Request,
    tolerance: float = Form(0.6),  # Cosine distance threshold (default 0.6)
    user_id: str = Form("booking_officer_1"),
    reason: str = Form("Suspect identification scan"),
    image: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    try:
        # Read uploaded image bytes
        contents = await image.read()

        # Extract 512-D face embedding vector
        try:
            query_vector = extract_face_embedding(contents)
        except ValueError as ve:
            # Audit log a failed lookup due to face detection error
            client_ip = request.client.host if request.client else "0.0.0.0"
            await log_audit(db, user_id, "IDENTIFY_FAILED", client_ip, reason, f"Lookup failed: {str(ve)}")
            raise HTTPException(status_code=400, detail=str(ve))

        # Query database using pgvector cosine distance `<=>` operator
        # Select target biometric, distance, and related criminal details
        distance_expr = CriminalBiometric.face_embedding.cosine_distance(query_vector)
        stmt = (
            select(CriminalBiometric, distance_expr.label("distance"))
            .order_by(distance_expr)
            .limit(1)
        )
        result = await db.execute(stmt)
        row = result.first()

        client_ip = request.client.host if request.client else "0.0.0.0"

        if row is None or row.distance > tolerance:
            # No match below tolerance threshold
            await log_audit(
                db, 
                user_id, 
                "IDENTIFY_SUSPECT", 
                client_ip, 
                reason, 
                f"Face scan executed. Result: No Match Found (Best match distance: {row.distance if row else 'N/A'})"
            )
            return {
                "match_found": False,
                "confidence_score": 0.0,
                "criminal_profile": None,
                "historical_records": []
            }

        # Match found! Fetch details
        biometric = row.CriminalBiometric
        distance = row.distance

        # Retrieve Criminal Profile
        criminal_stmt = select(Criminal).where(Criminal.id == biometric.criminal_id)
        criminal_res = await db.execute(criminal_stmt)
        criminal = criminal_res.scalar_one()

        # Retrieve Chronological Incident History
        records_stmt = (
            select(CriminalRecord)
            .where(CriminalRecord.criminal_id == criminal.id)
            .order_by(CriminalRecord.arrest_date.desc())
        )
        records_res = await db.execute(records_stmt)
        records = records_res.scalars().all()

        # Normalize confidence score: Cosine distance is [0, 2]. Typically similar images have distance < 0.2.
        # We can map distance [0.0, 0.6] linearly to [1.0, 0.4] confidence or similar.
        # confidence = 1.0 - distance
        confidence = float(max(0.0, min(1.0, 1.0 - distance)))

        # Parse aliases from distinguishing_marks field
        aliases = []
        if criminal.distinguishing_marks:
            for line in criminal.distinguishing_marks.split("\n"):
                if line.lower().startswith("alias") or line.lower().startswith("known alias"):
                    part = line.split(":")
                    if len(part) > 1:
                        aliases.append(part[1].strip())
        if not aliases:
            aliases = ["Unknown Alias"]

        # Format Profile Schema (image_url now included in schema directly)
        profile_data = CriminalProfileSchema(
            system_uid=criminal.system_uid,
            true_name=f"{criminal.true_first_name} {criminal.true_last_name}",
            aliases=aliases,
            dob=criminal.date_of_birth,
            gender=criminal.gender,
            nationality=criminal.nationality,
            distinguishing_marks=criminal.distinguishing_marks or "None",
            image_url=biometric.image_storage_url  # For dossier split-pane comparison
        )

        # Map incident records
        history_list = [
            CriminalRecordSchema(
                arrest_date=r.arrest_date,
                charge_category=r.charge_category,
                charge_details=r.charge_details,
                modus_operandi=r.modus_operandi,
                case_status=r.case_status,
                notes=r.notes
            )
            for r in records
        ]

        # Audit log successful lookup and retrieval
        details_str = f"Face scan matched profile: {profile_data.true_name} (ID: {criminal.id}) with {confidence*100:.2f}% match confidence."
        await log_audit(db, user_id, "IDENTIFY_SUCCESS", client_ip, reason, details_str)

        return {
            "match_found": True,
            "confidence_score": confidence,
            "criminal_profile": profile_data,
            "historical_records": history_list
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Identification service error: {str(e)}")


# Route 3: List All Criminal Profiles (For Stats/Dashboard Console)
@app.get("/api/v1/criminals")
async def list_criminals(
    user_id: str = "booking_officer_1",
    db: AsyncSession = Depends(get_db)
):
    # Select profiles & primary mugshots
    stmt = select(Criminal)
    result = await db.execute(stmt)
    criminals = result.scalars().all()

    output = []
    for c in criminals:
        # Get primary mugshot
        bio_stmt = select(CriminalBiometric).where(CriminalBiometric.criminal_id == c.id)
        bio_res = await db.execute(bio_stmt)
        bio = bio_res.scalar_one_or_none()
        
        # Get cases count
        case_stmt = select(CriminalRecord).where(CriminalRecord.criminal_id == c.id)
        case_res = await db.execute(case_stmt)
        cases = case_res.scalars().all()
        
        output.append({
            "id": c.id,
            "system_uid": c.system_uid,
            "first_name": c.true_first_name,
            "last_name": c.true_last_name,
            "dob": c.date_of_birth,
            "gender": c.gender,
            "nationality": c.nationality,
            "distinguishing_marks": c.distinguishing_marks,
            "image_url": bio.image_storage_url if bio else None,
            "case_count": len(cases),
            "recent_charge": cases[0].charge_category if cases else "No charges"
        })
    return output


# Route 4: Get Compliance Audit Logs (Investigator/Admin only)
@app.get("/api/v1/audit-logs")
async def get_audit_logs(
    user_role: str = "booking_officer",  # Passed from UI based on switcher
    db: AsyncSession = Depends(get_db)
):
    if user_role != "admin":
        raise HTTPException(status_code=403, detail="Access denied. Only Investigators and Administrators can view audit logs.")
        
    stmt = select(AuditLog).order_by(AuditLog.timestamp.desc())
    result = await db.execute(stmt)
    logs = result.scalars().all()
    return logs


# Route 5: Update Criminal Profile (Investigator/Admin only)
@app.put("/api/v1/criminals/{criminal_id}")
async def update_criminal(
    request: Request,
    criminal_id: int,
    first_name: Optional[str] = Form(None),
    last_name: Optional[str] = Form(None),
    gender: Optional[str] = Form(None),
    nationality: Optional[str] = Form(None),
    distinguishing_marks: Optional[str] = Form(None),
    user_role: str = Form("booking_officer"),
    user_id: str = Form("booking_officer_1"),
    reason: str = Form("Administrative modification of profile information"),
    db: AsyncSession = Depends(get_db)
):
    if user_role != "admin":
        raise HTTPException(status_code=403, detail="Access denied. Only Investigators and Administrators can modify profiles.")

    # Retrieve current record
    stmt = select(Criminal).where(Criminal.id == criminal_id)
    res = await db.execute(stmt)
    criminal = res.scalar_one_or_none()
    if not criminal:
        raise HTTPException(status_code=404, detail="Criminal profile not found")

    # Update columns
    if first_name:
        criminal.true_first_name = first_name
    if last_name:
        criminal.true_last_name = last_name
    if gender:
        criminal.gender = gender
    if nationality:
        criminal.nationality = nationality
    if distinguishing_marks:
        criminal.distinguishing_marks = distinguishing_marks

    await db.commit()

    # Log audit entry
    client_ip = request.client.host if request.client else "0.0.0.0"
    await log_audit(db, user_id, "MODIFY_RECORD", client_ip, reason, f"Updated criminal profile details for ID: {criminal_id}")

    return {"success": True, "message": "Criminal record updated successfully"}


# Route 6: Expunge/Delete Criminal Profile (Investigator/Admin only)
@app.delete("/api/v1/criminals/{criminal_id}")
async def expunge_criminal(
    request: Request,
    criminal_id: int,
    user_role: str = Form("booking_officer"),
    user_id: str = Form("booking_officer_1"),
    reason: str = Form("Administrative record expungement"),
    db: AsyncSession = Depends(get_db)
):
    if user_role != "admin":
        raise HTTPException(status_code=403, detail="Access denied. Only Investigators and Administrators can expunge records.")

    # Retrieve current record
    stmt = select(Criminal).where(Criminal.id == criminal_id)
    res = await db.execute(stmt)
    criminal = res.scalar_one_or_none()
    if not criminal:
        raise HTTPException(status_code=404, detail="Criminal profile not found")

    # Delete record (Cascade will delete biometrics and incident records)
    await db.execute(delete(Criminal).where(Criminal.id == criminal_id))
    await db.commit()

    # Log audit entry
    client_ip = request.client.host if request.client else "0.0.0.0"
    await log_audit(db, user_id, "EXPUNGE_RECORD", client_ip, reason, f"Expunged criminal profile (ID: {criminal_id}, Name: {criminal.true_first_name} {criminal.true_last_name})")

    return {"success": True, "message": "Criminal record and biometrics expunged from systems"}
