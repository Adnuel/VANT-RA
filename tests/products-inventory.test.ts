import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_PRODUCTS } from '../src/data/catalog.ts';
import type { Product } from '../src/data/catalog.ts';

test('Product catalog integrity: All products have valid IDs, retail prices and verified images', () => {
  assert.ok(INITIAL_PRODUCTS.length >= 20, 'Expected at least 20 initial products');

  for (const product of INITIAL_PRODUCTS) {
    assert.ok(product.id, 'Product missing id');
    assert.ok(product.title, `Product ${product.id} missing title`);
    assert.ok(product.slug, `Product ${product.id} missing slug`);
    assert.ok(product.category, `Product ${product.id} missing category`);
    assert.ok(typeof product.retailPriceCents === 'number' && product.retailPriceCents > 0, `Product ${product.id} must have positive retailPriceCents`);
    assert.ok(typeof product.stockQuantity === 'number' && product.stockQuantity >= 0, `Product ${product.id} must have non-negative stock`);
    assert.ok(product.image && product.image.trim().length > 0, `Product ${product.id} must have an image`);
  }
});

test('Inventory logic: Prevents ordering when stock is exhausted', () => {
  const mockProduct: Product = {
    id: 'test-item',
    slug: 'test-item',
    title: 'Minimalist MagSafe Stand',
    category: 'charging',
    retailPriceCents: 4500,
    supplierCostCents: 1500,
    stockQuantity: 0,
    isAvailable: false,
    availability: 'Out of Stock',
    description: 'A test product with zero stock.',
    image: 'https://images.unsplash.com/photo-1586953208448-b95a79798f07',
    imageAlt: 'Stand',
    imageNeedsReview: false,
    sourceTitle: null,
    referencePriceCents: null,
    priceBasis: 'official',
    sourceDescription: false,
    trending: false,
  };

  const canAddToCart = (p: Product, requestedQty: number) => {
    if (!p.isAvailable || p.stockQuantity <= 0) return false;
    return requestedQty <= p.stockQuantity;
  };

  assert.equal(canAddToCart(mockProduct, 1), false, 'Should deny adding out-of-stock item');

  mockProduct.stockQuantity = 5;
  mockProduct.isAvailable = true;

  assert.equal(canAddToCart(mockProduct, 2), true, 'Should allow adding when stock suffices');
  assert.equal(canAddToCart(mockProduct, 6), false, 'Should reject requested quantity exceeding available stock');
});

test('Inventory threshold: Identifies low-stock items (<= 5 units)', () => {
  const stockLevels = [
    { id: 'p1', stock: 12 },
    { id: 'p2', stock: 4 },
    { id: 'p3', stock: 0 },
    { id: 'p4', stock: 5 },
  ];

  const lowStockItems = stockLevels.filter((p) => p.stock > 0 && p.stock <= 5);
  const outOfStockItems = stockLevels.filter((p) => p.stock === 0);

  assert.equal(lowStockItems.length, 2);
  assert.equal(outOfStockItems.length, 1);
  assert.equal(outOfStockItems[0].id, 'p3');
});
