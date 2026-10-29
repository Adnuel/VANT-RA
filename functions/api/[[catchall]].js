/**
 * VANTÉRA Cloudflare Pages Catchall API Handler
 * Guarantees that any undefined /api/* route on Cloudflare Pages returns valid JSON
 * instead of falling back to SPA index.html or empty 404 response.
 */

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  return new Response(
    JSON.stringify({
      error: `API route not found: ${url.pathname}`,
      status: 404,
    }),
    {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}
