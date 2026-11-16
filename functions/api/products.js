/**
 * VANTÉRA Cloudflare Pages Serverless Function
 * Route: GET /api/products
 */

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

const VANTERA_PRODUCTS = [];

export async function onRequestGet() {
  return new Response(
    JSON.stringify({ products: VANTERA_PRODUCTS }),
    { status: 200, headers: corsHeaders }
  );
}
