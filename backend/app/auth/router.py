import os
from fastapi import APIRouter, HTTPException, Query, status,Depends
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr
from app.config import settings
from .supabase import supabase
from .dependency import get_current_user


router = APIRouter(prefix="/auth", tags=["Authentication"])



# --- Pydantic Schemas ---
class MagicLinkRequest(BaseModel):
    email: EmailStr

# --- Routes ---

@router.post("/magic-link", summary="Send a Magic Link to user email")
async def send_magic_link(payload: MagicLinkRequest):
    """Triggers Supabase to email a passwordless magic link to the user."""
    try:
        response = supabase.auth.sign_in_with_otp({
            "email": payload.email,
            "options": {
                "email_redirect_to": settings.frontend_redirect}
        })
        return {
            "success": True,
            "message": f"Magic link sent successfully to {payload.email}."
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/google", summary="Initiate Google OAuth login")
async def login_with_google():
    """Generates the Supabase Google OAuth sign-in URL and redirects the client."""
    try:
        response = supabase.auth.sign_in_with_oauth({
            "provider": "google",
            "options": {
                "redirect_to": "http://localhost:3000/auth/redirect"
            }
        })
        # response contains the URL to redirect the user to Google login
        if response.url:
            return RedirectResponse(url=response.url)
        
        raise HTTPException(status_code=400, detail="Failed to generate Google OAuth URL.")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/callback", summary="OAuth and Magic Link Callback Handler")
async def auth_callback(
    code: str = Query(None, description="Auth code returned by Google or Magic Link redirection"),
):
    """
    Handles the redirect callback from Supabase/Google, 
    exchanges the authorization code for a session token, and returns user data.
    """
    if not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Authorization code missing from callback."
        )

    try:
        # Exchange the auth code for a user session
        session_response = supabase.auth.exchange_code_for_session({"auth_code": code})
        
        if not session_response:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Failed to authenticate and exchange code for session."
            )

        # Extract user and tokens
        user = session_response.user
        session = session_response.session

        # You can return the tokens to the frontend or handle cookies/JWT creation here
        return {
            "success": True,
            "message": "Successfully authenticated.",
            "access_token": session.access_token,
            "refresh_token": session.refresh_token,
            "user": {
                "id": user.id,
                "email": user.email,
                "metadata": user.user_metadata
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Authentication callback failed: {str(e)}"
        )


@router.get("/me")
async def get_user(user=Depends(get_current_user)):
    return{"id": user.id ,"email": user.email }