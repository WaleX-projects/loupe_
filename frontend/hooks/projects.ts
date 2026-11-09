import { useState } from "react";
import { api } from "../lib/api";
import axios from "axios";

export interface ProjectResponse {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  status: string;
  prompt: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectCreateRequest {
  name: string;
  initial_prompt: string;
  description?: string | null;
}

// 1. Hook dedicated solely to creation
export const useCreateProject = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const createProject = async (dataform: ProjectCreateRequest): Promise<ProjectResponse | null> => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post<ProjectResponse, ProjectCreateRequest>("/v1/projects", dataform);
      return response;
    } catch (err: unknown) {
      let errorMessage = "Failed to create project";
      if (axios.isAxiosError(err)) {
        errorMessage = err.response?.data?.detail || errorMessage;
      }
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { createProject, loading, error };
};

// 2. Hook dedicated solely to running/starting a project
export const useStartProject = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const startProject = async (projectId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await api.post(`/v1/projects/${projectId}/run`);
      return true;
    } catch (err: unknown) {
      let errorMessage = "Failed to start project";
      if (axios.isAxiosError(err)) {
        errorMessage = err.response?.data?.detail || errorMessage;
      }
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { startProject, loading, error };
};