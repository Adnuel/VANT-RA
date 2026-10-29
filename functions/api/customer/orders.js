/**
 * VANTÉRA Cloudflare Pages Serverless Function
 * Route: GET /api/customer/orders
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
      return JSON.parse(atob(parts[1]));
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

  const payload = parseToken(authHeader.slice(7));
  if (!payload || !payload.userId) {
    return new Response(
      JSON.stringify({ error: 'Invalid token' }),
      { status: 401, headers: corsHeaders }
    );
  }

  const kv = env.VANTERA_KV || env.KV;
  let orders = [];

  if (kv) {
    const stored = await kv.get(`orders:${payload.userId}`);
    if (stored) {
      orders = JSON.parse(stored);
    }
  }

  return new Response(
    JSON.stringify({ orders }),
    { status: 200, headers: corsHeaders }
  );
}
