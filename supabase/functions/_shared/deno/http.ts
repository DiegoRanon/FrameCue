import type { ApiErrorCode } from '../contract.ts';

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function fail(status: number, code: ApiErrorCode): Response {
  return json({ error: { code } }, status);
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
}

/**
 * Logs where and what failed, never the request. A request body can hold an
 * invitation token, and logs must not (NFR-10, spec section 9.2).
 */
export function logFailure(where: string, error: unknown): void {
  const details =
    typeof error === 'object' && error !== null
      ? {
          name: 'name' in error ? String(error.name) : undefined,
          code: 'code' in error ? String(error.code) : undefined,
          message: 'message' in error ? String(error.message) : undefined,
        }
      : { message: String(error) };
  console.error(`[${where}]`, JSON.stringify(details));
}
