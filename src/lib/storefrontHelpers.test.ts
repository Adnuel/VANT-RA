import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getSearchSuggestions,
  shouldShowMobileBottomNav,
  getMobileActiveTab,
  wrapGalleryIndex,
} from './storefrontHelpers.ts';
import type { Product } from '../data/catalog.ts';

const makeProduct = (overrides: Partial<Product> & Pick<Product, 'id' | 'slug' | 'title' | 'description' | 'category' | 'retailPriceCents'>): Product => ({
  supplierCostCents: null,
  stockQuantity: 10,
  isAvailable: true,
  availability: 'in_stock',
  image: '/products/stand.jpg',
  imageAlt: overrides.title,
  imageNeedsReview: false,
  sourceTitle: null,
  referencePriceCents: null,
  priceBasis: 'manual',
  sourceDescription: false,
  trending: false,
  ...overrides,
});

const MOCK_PRODUCTS: Product[] = [
  makeProduct({
    id: 'p1',
    slug: 'magsafe-desk-stand',
    title: '360 Rotate Aluminum Desk Stand',
    description: 'Weighted CNC alloy stand for desk setups.',
    category: 'laptop-workspace',
    retailPriceCents: 4500,
    image: '/products/stand.jpg',
    isAvailable: true,
    stockQuantity: 12,
    trending: true,
  }),
  makeProduct({
    id: 'p2',
    slug: 'smart-bedside-lamp',
    title: 'Architectural Ambient Lamp',
    description: 'Warm dimmable LED smart light.',
    category: 'smart-home-technology',
    retailPriceCents: 6200,
    image: '/products/lamp.jpg',
    isAvailable: true,
    stockQuantity: 4,
    trending: false,
  }),
  makeProduct({
    id: 'p3',
    slug: 'aramid-case-pro',
    title: 'Woven Aramid Magnetic Case',
    description: 'Ultra-thin impact protection.',
    category: 'premium-tech-accessories',
    retailPriceCents: 3800,
    image: '/products/case.jpg',
    isAvailable: false,
    availability: 'out_of_stock',
    stockQuantity: 0,
  }),
];

describe('getSearchSuggestions', () => {
  it('returns curated categories and available-first picks when query is empty', () => {
    const res = getSearchSuggestions('', MOCK_PRODUCTS, 4);
    assert.equal(res.products.length, 3);
    assert.equal(res.products[0].id, 'p1');
    assert.equal(res.categories.length, 5);
  });

  it('filters products and categories case-insensitively by title or keyword', () => {
    const res = getSearchSuggestions('lamp', MOCK_PRODUCTS, 4);
    assert.equal(res.products.length, 1);
    assert.equal(res.products[0].id, 'p2');
  });
});

describe('shouldShowMobileBottomNav', () => {
  it('shows bottom nav on storefront routes when cart is closed or on cart step', () => {
    assert.equal(shouldShowMobileBottomNav('/', false, 'cart'), true);
    assert.equal(shouldShowMobileBottomNav('/shop', false, 'cart'), true);
    assert.equal(shouldShowMobileBottomNav('/product', true, 'cart'), true);
  });

  it('hides bottom nav on checkout, confirming payment, confirmed, and /order-confirmed', () => {
    assert.equal(shouldShowMobileBottomNav('/', true, 'shipping'), false);
    assert.equal(shouldShowMobileBottomNav('/', true, 'confirming_payment'), false);
    assert.equal(shouldShowMobileBottomNav('/', true, 'confirmed'), false);
    assert.equal(shouldShowMobileBottomNav('/', true, 'payment_failed'), false);
    assert.equal(shouldShowMobileBottomNav('/', true, 'auth_required'), false);
    assert.equal(shouldShowMobileBottomNav('/order-confirmed', false, 'cart'), false);
    assert.equal(shouldShowMobileBottomNav('/checkout', false, 'cart'), false);
  });
});

describe('getMobileActiveTab', () => {
  it('prioritizes cart and search overlays over underlying routes', () => {
    assert.equal(getMobileActiveTab('/', false, true), 'cart');
    assert.equal(getMobileActiveTab('/shop', true, false), 'search');
    assert.equal(getMobileActiveTab('/', false, false), 'home');
    assert.equal(getMobileActiveTab('/shop', false, false), 'products');
    assert.equal(getMobileActiveTab('/product', false, false), 'products');
    assert.equal(getMobileActiveTab('/account', false, false), 'profile');
  });
});

describe('wrapGalleryIndex', () => {
  it('wraps forward and backward seamlessly', () => {
    assert.equal(wrapGalleryIndex(0, -1, 5), 4);
    assert.equal(wrapGalleryIndex(4, 1, 5), 0);
    assert.equal(wrapGalleryIndex(2, 1, 5), 3);
    assert.equal(wrapGalleryIndex(0, 1, 0), 0);
  });
});
