/**
 * VANTÉRA Cloudflare Pages Serverless Function
 * Route: GET /api/auth/me
 */

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

function parseToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length >= 2) {
      const payload = JSON.parse(atob(parts[1]));
      return payload;
    }
  } catch {}
  return null;
}

export async function onRequestGet(context) {
  const { request, env } = context;

  const authHeader = request.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Authentication required' }),
      { status: 401, headers: corsHeaders }
    );
  }

  const token = authHeader.slice(7);
  const payload = parseToken(token);

  if (!payload || !payload.userId) {
    return new Response(
      JSON.stringify({ error: 'Invalid or expired token' }),
      { status: 401, headers: corsHeaders }
    );
  }

  const kv = env.VANTERA_KV || env.KV;
  let user = null;

  if (kv) {
    const stored = await kv.get(`user_id:${payload.userId}`);
    if (stored) {
      user = JSON.parse(stored);
    }
  }

  if (!user) {
    user = {
      id: payload.userId,
      name: payload.name || payload.email?.split('@')[0] || 'Client',
      email: payload.email,
      phone: payload.phone || '',
      role: payload.role || 'customer',
    };
  }

  return new Response(
    JSON.stringify({ user }),
    { status: 200, headers: corsHeaders }
  );
}
