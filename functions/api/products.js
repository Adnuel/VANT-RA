/**
 * VANTÉRA Cloudflare Pages Serverless Function
 * Route: GET /api/products
 */

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

const VANTERA_PRODUCTS = [
  {
    id: 'festive-3in1-foldable-magsafe-charger',
    title: '3-in-1 Foldable MagSafe Station',
    category: 'charging',
    retailPriceCents: 3800,
    referencePriceCents: 6500,
    stockQuantity: 42,
    isAvailable: true,
    availability: 'In Stock · Ready to Ship',
    image: '/products/charging-phone-stand.jpg',
    description: 'Aircraft-grade alloy folding wireless dock. Simultaneous 15W high-speed induction for smartphone, watch, and spatial earbuds.',
    trending: true,
  },
  {
    id: 'clear-protective-phone-case',
    title: 'Titanium Edge MagSafe Shield',
    category: 'phone-cases',
    retailPriceCents: 2400,
    referencePriceCents: 4200,
    stockQuantity: 60,
    isAvailable: true,
    availability: 'In Stock · Ready to Ship',
    image: '/products/transparent-magsafe-compatible-case.jpg',
    description: 'Zirconium ceramic impact armor with integrated neodymium magnetic array and anti-yellowing diamond coat.',
    trending: true,
  },
  {
    id: 'magnetic-phone-mount',
    title: 'Precision Orbit Phone Mount',
    category: 'room-desk',
    retailPriceCents: 2800,
    referencePriceCents: 4800,
    stockQuantity: 35,
    isAvailable: true,
    availability: 'In Stock · Ready to Ship',
    image: '/products/magnetic-phone-mount.jpg',
    description: 'CNC-machined weighted aluminum desk mount with dual-axis 360° fluid articulation.',
    trending: false,
  },
  {
    id: 'foldable-laptop-stand',
    title: 'Sculptural Laptop Riser',
    category: 'room-desk',
    retailPriceCents: 3400,
    referencePriceCents: 5800,
    stockQuantity: 28,
    isAvailable: true,
    availability: 'In Stock · Ready to Ship',
    image: '/products/foldable-laptop-stand.jpg',
    description: 'Minimalist heat-dissipating ergonomic riser crafted from anodized brushed space gray alloy.',
    trending: false,
  },
];

export async function onRequestGet() {
  return new Response(
    JSON.stringify({ products: VANTERA_PRODUCTS }),
    { status: 200, headers: corsHeaders }
  );
}
