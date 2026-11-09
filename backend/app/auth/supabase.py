import os

from supabase import create_client, Client
# Initialize Supabase Client
SUPABASE_URL = "https://srbmrjvxgjjzwzpqylen.supabase.co"
#os.getenv("SUPABASE_URL","")
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyYm1yanZ4Z2pqend6cHF5bGVuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzU3MjE1MywiZXhwIjoyMTAzMTQ4MTUzfQ.1VdxaX49A-bq-nHmQ9cO2s-F-kbnUX2aWbrFo8ZkdZ0"
#os.getenv("SUPABASE_KEY","")
SUPABASE_REDIRECT_URL = os.getenv("SUPABASE_REDIRECT_URL", "http://localhost:8000/auth/callback")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing Supabase environment variables.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)