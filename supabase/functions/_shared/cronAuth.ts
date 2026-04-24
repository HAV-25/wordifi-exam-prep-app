/**
 * cronAuth.ts
 *
 * Validates that an incoming request carries a Supabase service-role credential.
 * Accepts two forms so that both the new-format secret key (sb_secret_*) and the
 * legacy 219-character JWT work seamlessly:
 *
 *   1. Exact match against SUPABASE_SERVICE_ROLE_KEY env var  (new-format key)
 *   2. Legacy JWT with role === "service_role" in the payload  (legacy key)
 *      — safe because verify_jwt=true at the platform level already validated
 *        the JWT signature before the request reaches this function.
 */

const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

export function isAuthorised(req: Request): boolean {
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return false;

  const token = auth.slice(7).trim();
  if (!token) return false;

  // 1. Exact match (new-format sb_secret_* key)
  if (SERVICE_ROLE_KEY && token === SERVICE_ROLE_KEY) return true;

  // 2. Legacy JWT: decode payload and check role claim.
  //    Platform-level verify_jwt=true has already verified the signature, so
  //    reading the payload without re-verifying is safe here.
  try {
    const payloadB64 = token.split('.')[1];
    if (!payloadB64) return false;
    // base64url → standard base64
    const json = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json) as Record<string, unknown>;
    return payload['role'] === 'service_role';
  } catch {
    return false;
  }
}
