/**
 * VANTÉRA Cloudflare Pages Serverless Function
 * Route: POST /api/auth/register
 */

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

function generateToken(payload) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.signed_${Date.now()}`;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid or missing JSON payload' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const { name, email, password, phone } = body || {};

    if (!name || !email || !password) {
      return new Response(
        JSON.stringify({ error: 'Name, email, and password are required.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 6 characters long.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const kv = env.VANTERA_KV || env.KV;

    // Check if user already exists in KV if available
    if (kv) {
      const existing = await kv.get(`user:${normalizedEmail}`);
      if (existing) {
        return new Response(
          JSON.stringify({ error: 'An account with this email already exists. Please sign in.' }),
          { status: 400, headers: corsHeaders }
        );
      }
    }

    const user = {
      id: 'usr_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: name.trim(),
      email: normalizedEmail,
      phone: phone?.trim() || '',
      role: 'customer',
      createdAt: new Date().toISOString(),
    };

    // Store in KV if available
    if (kv) {
      await kv.put(`user:${normalizedEmail}`, JSON.stringify({ user, passwordHash: password }));
      await kv.put(`user_id:${user.id}`, JSON.stringify(user));
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      exp: Date.now() + 86400000 * 30,
    });

    return new Response(
      JSON.stringify({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
        },
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || 'Registration failed' }),
      { status: 500, headers: corsHeaders }
    );
  }
}
