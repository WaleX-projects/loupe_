import uuid
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import json
from app.db.models import Project
from app.schemas.projects import ProjectCreate, ProjectUpdate, ProjectResponse, RespondBody
from app.db.database import get_db 
from app.worker.runner import TaskRunner  # Import your task runner
from app.services.redis_client import redis_client
from app.auth.dependency import get_current_user

router = APIRouter(
    prefix="/projects",
    tags=["Projects C.R.U.D endpoints"]
)

# CREATE (Optionally kicks off background agent task if initial_prompt is provided)
@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: ProjectCreate, 
    db: AsyncSession = Depends(get_db),
    owner = Depends(get_current_user)

):

    project = Project(
        name=payload.name,
        description=payload.description,
        owner_id=uuid.UUID(owner.id),
        prompt=payload.initial_prompt,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)

    return project


# LIST (READ ALL)
@router.get("/", response_model=list[ProjectResponse])
async def list_projects(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).offset(skip).limit(limit))
    return result.scalars().all()


# RETRIEVE (READ ONE)
@router.get("/{id}", response_model=ProjectResponse)
async def retrieve_project(id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


# EDIT / PATCH (UPDATE)
@router.patch("/{id}", response_model=ProjectResponse)
async def edit_project(id: uuid.UUID, payload: ProjectUpdate, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(project, key, value)
        
    await db.commit()
    await db.refresh(project)
    return project


# DELETE
@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    await db.delete(project)
    await db.commit()
    return None


# RUN AGENT JOB (Dedicated endpoint to trigger a swarm run for an existing project)

@router.post("/{id}/run", status_code=status.HTTP_202_ACCEPTED)
async def run_project_job(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    project = await db.get(Project, id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Push job payload into a Redis queue named "loupe_job_queue"
    job_data = {"project_id": str(project.id), "prompt": project.prompt}
    await redis_client.rpush("loupe_job_queue", json.dumps(job_data))

    return {
        "status": "queued",
        "message": f"Job queued for project {str(project.id)}. Connect to WebSocket for live logs."
    }





@router.post("/{id}/response", status_code=status.HTTP_202_ACCEPTED)
async def respond_to_job(
    id: uuid.UUID,
    body: RespondBody,  # JSON body, so answers with spaces/newlines/quotes are safe
    db: AsyncSession = Depends(get_db),
):
    project = await db.get(Project, id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
 
    # Only queue a resume if the graph is actually waiting for an answer
    if not await redis_client.get(f"project:interrupt_id:{id}"):
        raise HTTPException(status_code=409, detail="No pending question for this project")
 
    await redis_client.rpush(
        "loupe_job_queue",
        json.dumps(
            {"project_id": str(project.id), "user_input": body.response, "action": "resume"}
        ),
    )
    return {"status": "queued", "message": f"Resume response queued for project {id}."}
 

