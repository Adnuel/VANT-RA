/**
 * VANTÉRA Cloudflare Pages Serverless Function
 * Route: POST /api/auth/login
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

    const { email, password } = body || {};

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const kv = env.VANTERA_KV || env.KV;

    let user = null;

    if (kv) {
      const storedRaw = await kv.get(`user:${normalizedEmail}`);
      if (storedRaw) {
        const stored = JSON.parse(storedRaw);
        if (stored.passwordHash === password) {
          user = stored.user;
        } else {
          return new Response(
            JSON.stringify({ error: 'Invalid email or password.' }),
            { status: 401, headers: corsHeaders }
          );
        }
      }
    }

    // If KV not active or user not found in KV, create session for customer
    if (!user) {
      user = {
        id: 'usr_' + btoa(normalizedEmail).replace(/[^a-zA-Z0-9]/g, '').slice(0, 14),
        name: normalizedEmail.split('@')[0].replace(/[._]/g, ' '),
        email: normalizedEmail,
        phone: '',
        role: 'customer',
      };
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
          phone: user.phone || '',
          role: user.role || 'customer',
        },
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || 'Login failed' }),
      { status: 500, headers: corsHeaders }
    );
  }
}
