import asyncio
import sys
import os

# Append the parent directory to sys.path so we can import app modules when running this script directly
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import engine, Base
from app.models import Criminal, CriminalBiometric, CriminalRecord
from sqlalchemy import text

async def init_models():
    print("Connecting to database and enabling vector extension...")
    async with engine.begin() as conn:
        # Enable the vector extension
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        
        # Create all tables defined in models.py
        print("Creating tables...")
        await conn.run_sync(Base.metadata.create_all)
        
        # Create HNSW cosine similarity index for vectors
        print("Configuring HNSW vector index...")
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS criminal_biometrics_hnsw_idx "
            "ON criminal_biometrics USING hnsw (face_embedding vector_cosine_ops);"
        ))
        
    print("Database tables initialized successfully!")

if __name__ == "__main__":
    asyncio.run(init_models())
