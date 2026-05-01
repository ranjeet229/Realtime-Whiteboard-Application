const rawApi =
  process.env.NEXT_PUBLIC_API_URL?.trim() || "http://localhost:5000";
/** No trailing slash — avoids `https://host.com//api/...` when paths start with `/`. */
const API = rawApi.replace(/\/+$/, "");

/** Public JSON API (room create/join). Set auth + token if you add bearer APIs later. */
export async function apiFetch(
  path: string,
  options: RequestInit & {
    token?: string | null;
    /** When true, send Authorization: Bearer <token> */
    auth?: boolean;
  } = {}
): Promise<Response> {
  const { token, auth = false, headers, ...rest } = options;
  const h = new Headers(headers);
  if (auth && token)
    h.set("Authorization", `Bearer ${token}`);
  if (!h.has("Content-Type") && rest.body && typeof rest.body === "string")
    h.set("Content-Type", "application/json");
  return fetch(`${API}${path}`, { ...rest, headers: h });
}

export const apiBase = API;
