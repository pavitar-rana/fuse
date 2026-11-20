"use server";

import axios from "axios";
import { auth } from "@/auth";

// The dashboard talks to the backend server-to-server: the session is checked
// here, then the call is made with the shared internal secret + user id.
// The browser never sees the secret and can't pick a different user.
const API_URL = process.env.FUSE_API_URL ?? "http://127.0.0.1:4000";

type Result = { ok: true } | { ok: false; message: string };

const callBackend = async (path: string, body: unknown): Promise<Result> => {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, message: "Not signed in" };

  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return { ok: false, message: "INTERNAL_API_SECRET is not configured" };

  try {
    await axios.post(`${API_URL}${path}`, body, {
      headers: { "X-Fuse-Internal-Secret": secret, "X-Fuse-User-Id": userId },
    });
    return { ok: true };
  } catch (err) {
    const message = axios.isAxiosError(err)
      ? (err.response?.data?.message ?? err.message)
      : "Request failed";
    return { ok: false, message };
  }
};

// Omitted fields fall back to the defaults in the Config table.
export const createVm = async (config: { memSize?: number; vcpuCount?: number } = {}) =>
  callBackend("/firecracker/create", { config });

export const deleteVm = async (id: string) => callBackend("/firecracker/delete", { id });

export const pauseVm = async (id: string) => callBackend("/firecracker/pause", { id });

export const resumeVm = async (id: string) => callBackend("/firecracker/resume", { id });
