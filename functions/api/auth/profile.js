/**
 * VANTÉRA Cloudflare Pages Serverless Function
 * Route: PUT /api/auth/profile
 */

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'PUT, OPTIONS',
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
      return JSON.parse(atob(parts[1]));
    }
  } catch {}
  return null;
}

export async function onRequestPut(context) {
  const { request, env } = context;

  const authHeader = request.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Authentication required' }),
      { status: 401, headers: corsHeaders }
    );
  }

  const payload = parseToken(authHeader.slice(7));
  if (!payload || !payload.userId) {
    return new Response(
      JSON.stringify({ error: 'Invalid token' }),
      { status: 401, headers: corsHeaders }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { name, phone } = body;

    const kv = env.VANTERA_KV || env.KV;
    let user = {
      id: payload.userId,
      name: name || payload.name || 'Client',
      email: payload.email,
      phone: phone || payload.phone || '',
      role: payload.role || 'customer',
    };

    if (kv) {
      const stored = await kv.get(`user_id:${payload.userId}`);
      if (stored) {
        user = { ...JSON.parse(stored), name: name || user.name, phone: phone !== undefined ? phone : user.phone };
      }
      await kv.put(`user_id:${user.id}`, JSON.stringify(user));
      await kv.put(`user:${user.email.toLowerCase()}`, JSON.stringify({ user }));
    }

    return new Response(
      JSON.stringify({ user }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || 'Profile update failed' }),
      { status: 500, headers: corsHeaders }
    );
  }
}
