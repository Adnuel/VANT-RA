/**
 * VANTÉRA Cloudflare Pages Serverless Function
 * Route: GET, POST /api/customer/addresses
 */

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
  let addresses = [];

  if (kv) {
    const stored = await kv.get(`addresses:${payload.userId}`);
    if (stored) {
      addresses = JSON.parse(stored);
    }
  }

  return new Response(
    JSON.stringify({ addresses }),
    { status: 200, headers: corsHeaders }
  );
}

export async function onRequestPost(context) {
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
    const body = await request.json();
    const address = {
      ...body,
      id: 'addr_' + Date.now().toString(36),
      createdAt: new Date().toISOString(),
    };

    const kv = env.VANTERA_KV || env.KV;
    if (kv) {
      const stored = await kv.get(`addresses:${payload.userId}`);
      const addresses = stored ? JSON.parse(stored) : [];
      addresses.push(address);
      await kv.put(`addresses:${payload.userId}`, JSON.stringify(addresses));
    }

    return new Response(
      JSON.stringify({ address }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || 'Failed to save address' }),
      { status: 500, headers: corsHeaders }
    );
  }
}
