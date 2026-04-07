import { useState, useEffect, createContext, useContext } from "react";

export interface TrainerInfo {
  id: number;
  name: string;
  email: string;
}

interface AuthState {
  trainer: TrainerInfo | null;
  loading: boolean;
}

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(path, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  return res;
}

export async function authMe(): Promise<TrainerInfo | null> {
  try {
    const res = await apiFetch("/api/auth/me");
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function authLogin(email: string, password: string): Promise<{ ok: true; trainer: TrainerInfo } | { ok: false; error: string }> {
  try {
    const res = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const data = await res.json();
      return { ok: false, error: data.error ?? "Login failed" };
    }
    return { ok: true, trainer: await res.json() };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function authRegister(name: string, email: string, password: string): Promise<{ ok: true; trainer: TrainerInfo } | { ok: false; error: string }> {
  try {
    const res = await apiFetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
    if (!res.ok) {
      const data = await res.json();
      return { ok: false, error: data.error ?? "Registration failed" };
    }
    return { ok: true, trainer: await res.json() };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function authLogout(): Promise<void> {
  await apiFetch("/api/auth/logout", { method: "POST" });
}
