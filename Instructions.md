

```markdown
# System Requirements Specification (SRS)
## Project: Criminal Face Recognition & Record Management System (CFRMS)

---

## 1. Introduction & Project Overview
The **Criminal Face Recognition & Record Management System (CFRMS)** is a biometrics-driven intelligence platform designed for law enforcement agencies. The system solves a critical challenge in modern policing: identifying recidivist criminals who attempt to evade justice by changing their names, forging identification documents, or altering their physical appearance (e.g., growing facial hair, changing hairstyles, wearing glasses, or aging).

When a criminal is arrested, their biometrics (facial profile) and comprehensive criminal records are cataloged. If the individual is apprehended in the future under an alias or with an altered appearance, a simple facial scan will cross-reference the system's vector database, identify their true identity, and instantly pull their entire criminal history.

---

## 2. Business Requirements (BRD)

### 2.1 User Roles & Permissions
The system must support strict Role-Based Access Control (RBAC) due to the highly sensitive nature of criminal data:
* **Booking Officer (Field/Station User):** * Enroll new criminal profiles (Photos + Metadata).
    * Upload suspect photos to perform real-time facial searches.
    * View linked criminal histories.
* **Investigator / Admin:**
    * All privileges of a Booking Officer.
    * Modify or delete incorrect/expunged records.
    * View comprehensive system audit logs.
    * Manage user accounts and system configuration thresholds (e.g., confidence score limits).

### 2.2 Functional Requirements

#### FR-1: Criminal Profiling & Record Management
* The system must allow officers to create a unique **Criminal Profile ID**.
    * **Personal Metadata:** True Name, Known Aliases, Date of Birth, Gender, Nationality, Scars/Marks/Tattoos.
    * **Case Details:** Arrest Date, Offense Category (e.g., Felony, Misdemeanor), Specific Criminal Activity (e.g., Burglary, Assault), Modus Operandi (MO), Investigating Officer, and Case Status.
* The system must support multi-record linkage—one physical individual can have multiple arrest instances/cases tied to their unique biometric profile.

#### FR-2: Biometric Mugshot Enrollment
* The system must accept high-resolution facial images (Mugshots) during booking.
    * Supports frontal views, with options for profile (side) views if available.
    * Automated verification during upload to ensure a face is detected and meets basic quality thresholds (lighting, lack of severe occlusion).

#### FR-3: Advanced Face Search & Identification (1:N Matching)
* The system must allow users to upload an unverified suspect's photo captured from a crime scene, CCTV freeze-frame, or a new booking photograph.
* The system must execute a **1:N (One-to-Many)** search across the entire national/regional database of enrolled criminal embeddings.
* The matching algorithm must handle variation factors:
    * **Appearance Changes:** Facial hair variation, weight fluctuations, aging, eyewear, and minor cosmetics.
    * **Environmental Factors:** Variations in lighting conditions, angles (up to 30 degrees off-center), and camera resolutions.

#### FR-4: Match Verification & Record Retrieval
* The system must return candidates exceeding a customizable **Confidence Threshold** (e.g., >85% match probability).
* If a match is confirmed, the system must immediately fetch and display the aggregated chronological dossier of the criminal, detailing every past offense, case history, and previous mugshots for visual verification side-by-side.

#### FR-5: Immutable Audit Logging
* Every query, view, data modification, and facial lookup must log the User ID, Timestamp, IP Address, Action Taken, and Reason for Search to satisfy regulatory compliance.

### 2.3 Non-Functional Requirements (NFR)
* **Accuracy:** False Acceptance Rate (FAR) must be $< 0.001\%$, and False Rejection Rate (FRR) must be $< 1\%$ under controlled lighting.
* **Performance (Latency):** Face embedding generation must take $< 200\text{ms}$. A 1:N vector lookup across 100,000 records must resolve in $< 500\text{ms}$.
* **Scalability:** The architecture must handle horizontal scaling of vector storage up to millions of records.
* **Security:** Multi-factor authentication (MFA) for personnel, data-at-rest encryption (AES-256), and data-in-transit encryption (TLS 1.3).

---

## 3. System Architecture & Technical Workflow


```

[Suspect Photo Upload] ──> [React Frontend] ──> [FastAPI Backend]
│
┌───────────┴───────────┐
▼                       ▼
[DeepFace Pipeline]       [PostgreSQL DB]
• Face Detection/Alignment   • Metadata SQL Storage
• Vector Embedding (512-D)   • Vector Index (pgvector)

```

### 3.1 Step-by-Step Backend Core Processing Workflow:
1. **Image Ingestion:** Frontend sends a multipart form-data payload containing the image file and optional metadata to the Python REST API.
2. **Preprocessing & Alignment:** The backend applies face detection (e.g., RetinaFace or MTCNN) to crop, isolate, and structurally align the face (correcting tilt based on eye coordinates).
3. **Embedding Extraction:** The aligned face image is fed into a deep convolutional neural network (e.g., ArcFace, FaceNet512, or VGG-Face via DeepFace) to generate a standardized mathematical vector representation (e.g., a 512-dimensional array of floats).
4. **Vector Comparison (Similarity Search):**
    * *For Enrollment:* The 512-D vector is saved into a vector-enabled database row mapped to that criminal instance.
    * *For Identification:* The vector is queried against the database using Cosine Similarity or Euclidean Distance metrics.
5. **Dossier Assembly:** If the similarity metric exceeds the set threshold, the relational database extracts all linked operational criminal data tables and returns a unified JSON response to the React frontend.

---

## 4. Technical Stack Requirements

### 4.1 Backend (Python Environment)
* **Core Language:** Python 3.10+ (for modern performance enhancements and typing support).
* **Web Framework:** **FastAPI**
    * *Reasoning:* Native asynchronous support handles blocking I/O bound ML processes efficiently; built-in OpenAPI/Swagger docs accelerate development.
* **Computer Vision & Face Recognition Pipeline:**
    * **DeepFace Framework:** High-level wrapper supporting multiple backends.
    * **ArcFace or FaceNet512:** Chosen target models for generating rich, robust feature representations capable of ignoring superficial appearance changes.
    * **OpenCV (opencv-python-headless):** For basic programmatic image parsing, resizing, and matrix transformations.
* **Database Layers:**
    * **Relational Engine:** PostgreSQL 15+.
    * **Vector Database Plugin:** **pgvector** extension. This allows seamless storage of both highly relational structured criminal records and deep learning vectors within the exact same transactional database workspace, minimizing infrastructural footprint.
* **ORMs & Drivers:** SQLAlchemy or SQLModel for clean async Python data-mapping.

### 4.2 Frontend (React & Modern Web Stack)
* **Build Toolchain:** **React + Vite** (Fast, highly responsive HMR, modular architecture).
* **Language Ecosystem:** ES6+ JavaScript / JSX.
* **Styling Engine:** **Tailwind CSS** (via PostCSS/Vite configurations).
* **Animation System:** **GSAP (GreenSock Animation Platform)** via CDN or npm package for elegant, high-end micro-interactions, page transitions, and processing loaders.
* **State Management & Networking:** Axios for API communications; native React Context API for managing officer authentication sessions.

---

## 5. Database Schema Blueprint

```sql
-- Enable the pgvector extension to handle facial biometric arrays
CREATE EXTENSION IF NOT EXISTS vector;

-- Table 1: Criminal Masters (The Core Biometric Profile)
CREATE TABLE criminals (
    id SERIAL PRIMARY KEY,
    system_uid UUID DEFAULT gen_random_uuid() UNIQUE,
    true_first_name VARCHAR(100) NOT NULL,
    true_last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender VARCHAR(20),
    nationality VARCHAR(50),
    distinguishing_marks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table 2: Biometric Mugshots & Facial Embeddings
CREATE TABLE criminal_biometrics (
    id SERIAL PRIMARY KEY,
    criminal_id INT REFERENCES criminals(id) ON DELETE CASCADE,
    image_storage_url TEXT NOT NULL,  -- Cloud/Local Storage Secure Path
    face_embedding vector(512) NOT NULL, -- 512-Dimensional ArcFace/FaceNet Vector
    is_primary_face BOOLEAN DEFAULT TRUE,
    captured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table 3: Criminal Record Incidents (Supports History Mapping)
CREATE TABLE criminal_records (
    id SERIAL PRIMARY KEY,
    criminal_id INT REFERENCES criminals(id) ON DELETE CASCADE,
    booking_officer_id INT NOT NULL,
    arrest_date DATE NOT NULL,
    charge_category VARCHAR(100) NOT NULL, -- e.g., Theft, Narcotics, Cybercrime
    charge_details TEXT NOT NULL,
    modus_operandi TEXT,
    case_status VARCHAR(50) DEFAULT 'Arrested',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

```

---

## 6. Backend API Specifications

### 6.1 Criminal Enrollment Endpoint

* **Route:** `POST /api/v1/criminals/enroll`
* **Content-Type:** `multipart/form-data`
* **Payload parameters:**
* `first_name`: String
* `last_name`: String
* `dob`: String (YYYY-MM-DD)
* `gender`: String
* `charge_category`: String
* `charge_details`: String
* `modus_operandi`: String
* `image`: Binary File (Mugshot Image)


* **Logic:** Inserts profile info into `criminals`, parses the image to extract the 512-D vector array, stores both the image vector and structural metrics into `criminal_biometrics` and `criminal_records`.

### 6.2 Facial Identification/Search Endpoint

* **Route:** `POST /api/v1/criminals/identify`
* **Content-Type:** `multipart/form-data`
* **Payload parameters:**
* `image`: Binary File (Unidentified Suspect Photo)
* `tolerance`: Float (Optional: defaults to 0.6 Cosine distance threshold)


* **Logic:** Generates vector from uploaded photo. Performs a localized vector lookup using operators (`<->` for Euclidean or `<=>` for Cosine Distance). Returns a structured match payload.
* **Response Blueprint (Success - Match Found):**

```json
{
  "match_found": true,
  "confidence_score": 0.942,
  "criminal_profile": {
    "system_uid": "e2a1b9c4-8c7d-4b3a-9e1f-123456789abc",
    "true_name": "Johnathan Doe",
    "aliases": ["Johnny The Fox", "John Vance"],
    "dob": "1988-05-14",
    "gender": "Male",
    "distinguishing_marks": "Linear scar across left eyebrow"
  },
  "historical_records": [
    {
      "arrest_date": "2021-11-02",
      "charge_category": "Grand Larceny",
      "charge_details": "Stealing high-end motor vehicles from commercial garages.",
      "modus_operandi": "Uses signal-jamming devices to bypass keyless entries.",
      "case_status": "Convicted"
    },
    {
      "arrest_date": "2026-06-12",
      "charge_category": "Burglary",
      "charge_details": "Breaking and entering into high-end retail jewelry shop.",
      "modus_operandi": "Smashes back entryways between 2:00 AM and 4:00 AM.",
      "case_status": "Arrested"
    }
  ]
}

```

---

## 7. Frontend Design & UX Requirements

To maximize user efficiency in critical operational law enforcement conditions, the frontend interface must match high-fidelity, premium interactive web applications.

### 7.1 Visual Layout Principles

* **Aesthetic Theme:** Light mode by default, crisp typographic hierarchy, hyper-clean neutral professional gray palettes (`#f8fafc`, `#f1f5f9`), slate text tones (`#0f172a`), with safe corporate-military slate-blue accents (`#1e3a8a`).
* **Whitespace:** Wide structural paddings ($24\text{px}-32\text{px}$) between UI cards to reduce cognitive load during fast analysis. Avoid heavy, boxed-in borders; favor soft drop shadows (`box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05)`).

### 7.2 Core User Interfaces (Views)

1. **Dashboard Hub:** Split viewport showing a streamlined feed of recent system lookups, historical enrollment stats via subtle static SVG charts, and a prominent global action console.
2. **The Enrollment Module:** Clean structural multi-step web form utilizing Tailwind elements. Built-in dropzone for photos.
3. **The Identity Search Console:**
* Features a centralized scan panel where a user drops an unknown photograph.
* **GSAP Powered Micro-interactions:** Upon image upload, trigger a smooth scanning visual indicator (e.g., a glowing, semi-transparent horizontal laser bar sweeping down across the face using structural loop animations).


4. **Dossier View (Results Page):**
* If a positive match returns, present a split-pane comparison matrix: Left pane shows the newly captured search image; Right pane shows the original system master image.
* Beneath the biometrics, render an interactive, chronological vertical timeline tracing each prior criminal record entry.



---

## 8. Implementation Steps for Developers

To execute this architecture effectively, developers should tackle the development lifecycle across these clear operational phases:

1. **Phase 1 (Database & Vector Configurations):** Spin up a local PostgreSQL Docker container containing `pgvector`. Create tables and apply index parameters (`CREATE INDEX ON criminal_biometrics USING hnsw (face_embedding vector_cosine_ops);`) to optimize vector calculation pipelines.
2. **Phase 2 (Python Engine Setup):** Instantiate an asynchronous FastAPI backend. Write a utility module encapsulating OpenCV/DeepFace logic to ingest image byte-streams and return localized NumPy arrays or 512-float vector blocks.
3. **Phase 3 (Core API Routes):** Establish the primary enrollment and identification POST controllers. Hook them up to the database using SQLAlchemy async sessions.
4. **Phase 4 (React + Vite Client Construction):** Standardize a Vite environment with Tailwind CSS. Implement structural application components (Upload zones, Result panels, History charts). Combine GSAP code blocks to add smooth motion to file ingestion states, slide-ins for comparative side-by-side matrices, and progress trackers.
5. **Phase 5 (End-to-End System Integration & Threshold Tuning):** Execute real-world image checks with variable lighting conditions and physical alterations to calibrate the distance parameter to the optimum accuracy sweet spot.
