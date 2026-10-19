import { apiFetch } from "./client";
import type { MushafEdition } from "../mushaf/types";

export interface Preferences {
  mushaf: MushafEdition;
  theme: "light" | "dark";
  font_scale: number;
}

export const DEFAULT_PREFERENCES: Preferences = {
  mushaf: "v4",
  theme: "light",
  font_scale: 1,
};

export interface User {
  id: string;
  email: string;
  display_name: string | null;
  email_verified: boolean;
  has_google: boolean;
  preferences: Preferences;
}

export async function bootstrapCsrf(): Promise<void> {
  await apiFetch<{ ok: boolean }>("/api/auth/csrf");
}

export async function getMe(): Promise<User> {
  return apiFetch<User>("/api/auth/me");
}

export async function updatePreferences(
  partial: Partial<Preferences>,
): Promise<User> {
  return apiFetch<User>("/api/preferences", {
    method: "PUT",
    body: JSON.stringify(partial),
  });
}

export async function login(email: string, password: string): Promise<User> {
  const res = await apiFetch<{ user: User }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return res.user;
}

export async function signup(
  email: string,
  password: string,
  displayName?: string,
): Promise<User> {
  const res = await apiFetch<{ user: User }>("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password, display_name: displayName || null }),
  });
  return res.user;
}

export async function logout(): Promise<void> {
  await apiFetch<{ message: string }>("/api/auth/logout", { method: "POST" });
}
