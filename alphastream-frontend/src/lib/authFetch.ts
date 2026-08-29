import { supabase } from "@/integrations/supabase/client";
import { API_BASE_URL } from "@/config/api";

async function getAuthHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

export async function authFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const auth = await getAuthHeaders();
  const headers = { ...auth, ...((init.headers as Record<string, string>) || {}) };
  return fetch(`${API_BASE_URL}${path}`, { ...init, headers });
}

export async function authJson<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await authFetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...((init.headers as Record<string, string>) || {}),
    },
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${await res.text()}`);
  }
  return res.json();
}
