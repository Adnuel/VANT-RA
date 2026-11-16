import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  parseUsdPriceRangeCents,
  parseUsdPriceToCents,
  calculateSellingPriceCents,
  calculateProductDependentPricingCents,
  calculateProfitBreakdown,
  stripHtmlDescription,
  suggestVanteraCategory,
  parseVariantAttributes,
} from '../src/lib/cjPricing.ts';
import {
  CjDropshippingService,
  CJ_GET_ACCESS_TOKEN_URL,
  CJ_PRODUCT_LIST_V2_URL,
  CJ_PRODUCT_QUERY_URL,
  CJ_VARIANT_QUERY_URL,
  CJ_STOCK_BY_PID_URL,
  CJ_STOCK_BY_VID_URL,
  CJ_FREIGHT_CALCULATE_URL,
  CjApiRequestError,
} from '../server/cj.ts';
import { db } from '../server/db.ts';

function makeTempTokenPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vantera-cj-catalog-'));
  return path.join(dir, 'cj_tokens.json');
}

function cleanupTempFile(filePath: string): void {
  try {
    fs.rmSync(path.dirname(filePath), { recursive: true, force: true });
  } catch {
    // ignore
  }
}

function jsonResponse(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('cjPricing: parses CJ single prices and range strings accurately', () => {
  assert.deepEqual(parseUsdPriceRangeCents('8.50 -- 14.20'), { minCents: 850, maxCents: 1420 });
  assert.deepEqual(parseUsdPriceRangeCents('$19.99'), { minCents: 1999, maxCents: 1999 });
  assert.deepEqual(parseUsdPriceRangeCents(12.5), { minCents: 1250, maxCents: 1250 });
  assert.deepEqual(parseUsdPriceRangeCents(null), { minCents: null, maxCents: null });
  assert.equal(parseUsdPriceToCents('4.75'), 475);
});

test('cjPricing: computes selling price and keeps supplier cost & profit strictly separate in USD & NGN', () => {
  // 80% markup over $10.00 (1000 cents) -> $18.00 (1800 cents)
  assert.equal(calculateSellingPriceCents(1000, 'markup_percent', 80), 1800);

  // 50% gross margin over $10.00 -> $20.00 (2000 cents)
  assert.equal(calculateSellingPriceCents(1000, 'margin_percent', 50), 2000);

  // Fixed retail price $25.00
  assert.equal(calculateSellingPriceCents(1000, 'fixed_cents', 2500), 2500);

  // Profit breakdown at 1 USD = 1,550 NGN
  const breakdown = calculateProfitBreakdown(2000, 1000, 1550);
  assert.equal(breakdown.supplierCostCents, 1000);
  assert.equal(breakdown.retailPriceCents, 2000);
  assert.equal(breakdown.profitCents, 1000);
  assert.equal(breakdown.marginPercent, 50);
  assert.equal(breakdown.markupPercent, 100);
  assert.equal(breakdown.supplierCostNgn, 15500);
  assert.equal(breakdown.retailNgn, 31000);
  assert.equal(breakdown.profitNgn, 15500);
});

test('cjPricing: cleans HTML descriptions, maps VANTÉRA categories, and parses variant attributes', () => {
  const clean = stripHtmlDescription('<p>Aluminum <strong>MagSafe</strong> Stand<br/>Fast Qi2</p><script>alert(1)</script>');
  assert.equal(clean, 'Aluminum MagSafe Stand\nFast Qi2');

  assert.equal(suggestVanteraCategory('Mobile Phone Accessories > Chargers', 'MagSafe 15W Wireless Charger'), 'charging');
  assert.equal(suggestVanteraCategory('Consumer Electronics', 'ANC Wireless Earbuds'), 'audio');
  assert.equal(suggestVanteraCategory('Phone Cases', 'Aramid Case'), 'phone-cases');

  assert.deepEqual(parseVariantAttributes('Obsidian Black-USB-C'), {
    label: 'Obsidian Black · USB · C',
    color: 'Obsidian Black',
    size: 'USB / C',
  });
  assert.deepEqual(parseVariantAttributes('Champagne Gold'), {
    label: 'Champagne Gold',
    color: 'Champagne Gold',
  });
});

test('CJ Service: searchProducts queries /product/listV2 and parses real CJ structure', async () => {
  const tokenPath = makeTempTokenPath();
  const nowMs = Date.parse('2026-11-14T12:00:00.000Z');
  const expiry = new Date(nowMs + 180 * 24 * 60 * 60 * 1000).toISOString();
  const seenUrls: string[] = [];

  const service = new CjDropshippingService({
    tokenFilePath: tokenPath,
    getApiKey: () => 'CJ123@api@testkey123',
    now: () => nowMs,
    minRequestSpacingMs: 0,
    fetchImpl: async (input) => {
      const url = String(input);
      seenUrls.push(url);
      if (url === CJ_GET_ACCESS_TOKEN_URL) {
        return jsonResponse({
          code: 200,
          result: true,
          data: {
            openId: 101,
            accessToken: 'tok_abc',
            accessTokenExpiryDate: expiry,
            refreshToken: 'ref_abc',
            refreshTokenExpiryDate: expiry,
          },
        });
      }
      if (url.startsWith(CJ_PRODUCT_LIST_V2_URL)) {
        return jsonResponse({
          code: 200,
          result: true,
          data: {
            pageNumber: 1,
            pageSize: 12,
            totalRecords: 1,
            content: [
              {
                productList: [
                  {
                    id: 'PID_9001',
                    nameEn: 'Magnetic Wireless Stand 15W',
                    sku: 'CJCD-9001',
                    spu: 'SPU-9001',
                    categoryId: 'cat_1',
                    threeCategoryName: 'Wireless Chargers',
                    bigImage: 'https://cf.cjdropshipping.com/stand.jpg',
                    nowPrice: '9.50 -- 12.00',
                    warehouseInventoryNum: 42,
                    listedNum: 120,
                  },
                ],
              },
            ],
          },
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
  });

  try {
    const res = await service.searchProducts({ keyword: 'magsafe', page: 1, size: 12, countryCode: 'CN' });
    assert.equal(res.total, 1);
    assert.equal(res.products.length, 1);
    assert.equal(res.products[0].pid, 'PID_9001');
    assert.equal(res.products[0].supplierPriceCents, 950);
    assert.equal(res.products[0].supplierPriceMaxCents, 1200);
    assert.equal(res.products[0].warehouseInventoryNum, 42);
    assert.ok(seenUrls.some((u) => u.includes('keyWord=magsafe') && u.includes('countryCode=CN')));
  } finally {
    cleanupTempFile(tokenPath);
  }
});

test('CJ Service: getProductDetail retrieves specs, variants via fallback, and real stock', async () => {
  const tokenPath = makeTempTokenPath();
  const nowMs = Date.parse('2026-11-14T12:00:00.000Z');
  const expiry = new Date(nowMs + 180 * 24 * 60 * 60 * 1000).toISOString();

  const service = new CjDropshippingService({
    tokenFilePath: tokenPath,
    getApiKey: () => 'CJ123@api@detailkey',
    now: () => nowMs,
    minRequestSpacingMs: 0,
    fetchImpl: async (input) => {
      const url = String(input);
      if (url === CJ_GET_ACCESS_TOKEN_URL) {
        return jsonResponse({
          code: 200,
          result: true,
          data: {
            openId: 102,
            accessToken: 'tok_det',
            accessTokenExpiryDate: expiry,
            refreshToken: 'ref_det',
            refreshTokenExpiryDate: expiry,
          },
        });
      }
      if (url.startsWith(CJ_PRODUCT_QUERY_URL)) {
        return jsonResponse({
          code: 200,
          result: true,
          data: {
            pid: 'PID_777',
            productNameEn: 'Aluminum MagSafe Dock',
            productSku: 'CJDOCK777',
            categoryName: 'Chargers',
            description: '<p>CNC Machined Aluminum</p>',
            productImage: 'https://cf.cjdropshipping.com/dock-main.jpg',
            productImageSet: ['https://cf.cjdropshipping.com/dock-side.jpg'],
            sellPrice: '11.20',
            productWeight: 185,
            materialNameEn: 'Aluminum Alloy',
            variants: [],
          },
        });
      }
      if (url.startsWith(CJ_VARIANT_QUERY_URL)) {
        return jsonResponse({
          code: 200,
          result: true,
          data: [
            {
              vid: 'VID_BLK',
              variantSku: 'CJDOCK777-BLK',
              variantKey: 'Obsidian Black',
              variantSellPrice: '11.20',
              variantImage: 'https://cf.cjdropshipping.com/dock-blk.jpg',
            },
            {
              vid: 'VID_SLV',
              variantSku: 'CJDOCK777-SLV',
              variantKey: 'Silver',
              variantSellPrice: '12.50',
              variantImage: 'https://cf.cjdropshipping.com/dock-slv.jpg',
            },
          ],
        });
      }
      if (url.startsWith(CJ_STOCK_BY_PID_URL)) {
        return jsonResponse({
          code: 200,
          result: true,
          data: {
            inventories: [
              { countryCode: 'CN', areaEn: 'Yiwu Warehouse', totalInventoryNum: 25, cjInventoryNum: 25, factoryInventoryNum: 0 },
            ],
            variantInventories: [
              { vid: 'VID_BLK', inventories: [{ countryCode: 'CN', areaEn: 'Yiwu Warehouse', totalInventoryNum: 25 }] },
              { vid: 'VID_SLV', inventories: [{ countryCode: 'CN', areaEn: 'Yiwu Warehouse', totalInventoryNum: 0 }] },
            ],
          },
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
  });

  try {
    const detail = await service.getProductDetail('PID_777');
    assert.equal(detail.pid, 'PID_777');
    assert.equal(detail.description, 'CNC Machined Aluminum');
    assert.equal(detail.totalInventory, 25);
    assert.equal(detail.variants.length, 2);
    assert.equal(detail.variants[0].vid, 'VID_BLK');
    assert.equal(detail.variants[0].supplierPriceCents, 1120);
    assert.equal(detail.variants[0].stockQuantity, 25);
    assert.equal(detail.variants[1].stockQuantity, 0);
    assert.ok(detail.specs.some((s) => s.label === 'Material' && s.value === 'Aluminum Alloy'));
  } finally {
    cleanupTempFile(tokenPath);
  }
});

test('CJ Service: calculateFreight returns sorted real logistics quotes and validates destination', async () => {
  const tokenPath = makeTempTokenPath();
  const nowMs = Date.parse('2026-11-14T12:00:00.000Z');
  const expiry = new Date(nowMs + 180 * 24 * 60 * 60 * 1000).toISOString();

  const service = new CjDropshippingService({
    tokenFilePath: tokenPath,
    getApiKey: () => 'CJ123@api@freightkey',
    now: () => nowMs,
    minRequestSpacingMs: 0,
    fetchImpl: async (input) => {
      const url = String(input);
      if (url === CJ_GET_ACCESS_TOKEN_URL) {
        return jsonResponse({
          code: 200,
          result: true,
          data: {
            openId: 103,
            accessToken: 'tok_fr',
            accessTokenExpiryDate: expiry,
            refreshToken: 'ref_fr',
            refreshTokenExpiryDate: expiry,
          },
        });
      }
      if (url === CJ_FREIGHT_CALCULATE_URL) {
        return jsonResponse({
          code: 200,
          result: true,
          data: [
            { logisticName: 'DHL Express', logisticAging: '3-7', logisticPrice: '28.50', taxesFee: '0', clearanceOperationFee: '0', totalPostageFee: '28.50' },
            { logisticName: 'CJPacket Ordinary', logisticAging: '10-18', logisticPrice: '6.40', taxesFee: '0.50', clearanceOperationFee: '0', totalPostageFee: '6.90' },
          ],
        });
      }
      if (url.startsWith(CJ_STOCK_BY_VID_URL)) {
        return jsonResponse({
          code: 200,
          result: true,
          data: [{ countryCode: 'CN', areaEn: 'Shenzhen', totalInventoryNum: 14 }],
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
  });

  try {
    await assert.rejects(
      () => service.calculateFreight({ endCountryCode: 'INVALID', products: [{ vid: 'VID_1', quantity: 1 }] }),
      CjApiRequestError
    );

    const freight = await service.calculateFreight({
      startCountryCode: 'CN',
      endCountryCode: 'NG',
      products: [{ vid: 'VID_1', quantity: 1 }],
    });
    assert.equal(freight.options.length, 2);
    assert.equal(freight.options[0].logisticName, 'CJPacket Ordinary');
    assert.equal(freight.options[0].totalPostageFeeCents, 690);
    assert.equal(freight.options[1].totalPostageFeeCents, 2850);

    const vidStock = await service.getVariantInventoryByVid('VID_1');
    assert.equal(vidStock.totalInventory, 14);
  } finally {
    cleanupTempFile(tokenPath);
  }
});

test('DB Integration: upsertCjProduct, syncCjProductStock, and variant-aware order stock lifecycle', () => {
  const dbPath = path.resolve(process.cwd(), 'data/vantera_db.json');
  const backup = fs.existsSync(dbPath) ? fs.readFileSync(dbPath, 'utf8') : null;

  try {
    const imported = db.upsertCjProduct(
      {
        cjPid: 'TEST_CJ_PID_888',
        cjProductSku: 'TEST-SKU-888',
        title: 'Test CJ Titanium Stand',
        category: 'room-desk',
        description: 'Precision stand',
        image: 'https://cf.cjdropshipping.com/test.jpg',
        retailPriceCents: 2400,
        supplierCostCents: 1000,
        stockQuantity: 3,
        isAvailable: true,
        variants: [
          {
            id: 'cjv_V1',
            cjVid: 'V1',
            sku: 'TEST-SKU-V1',
            name: 'Obsidian',
            supplierCostCents: 1000,
            retailPriceCents: 2400,
            stockQuantity: 3,
            isAvailable: true,
          },
          {
            id: 'cjv_V2',
            cjVid: 'V2',
            sku: 'TEST-SKU-V2',
            name: 'Gold',
            supplierCostCents: 1200,
            retailPriceCents: 2800,
            stockQuantity: 0,
            isAvailable: false,
          },
        ],
      },
      'Test Runner'
    );

    assert.equal(imported.created, true);
    assert.equal(imported.product.stockQuantity, 3);
    assert.equal(imported.product.isAvailable, true);

    // Reject ordering out-of-stock variant
    assert.throws(() => {
      db.createOrder({
        customerId: null,
        customerEmail: 'buyer@example.com',
        customerName: 'Test Buyer',
        customerPhone: '+2348000000000',
        shippingAddress: {
          fullName: 'Test Buyer',
          phone: '+2348000000000',
          streetAddress: '1 Test Way',
          city: 'Ikeja',
          state: 'Lagos',
          postalCode: '100001',
          country: 'Nigeria',
        },
        cartItems: [{ productId: imported.product.id, variantId: 'cjv_V2', quantity: 1 }],
      });
    }, /out of stock/i);

    // Order 2 units of in-stock variant V1 -> stock decrements to 1
    const order = db.createOrder({
      customerId: null,
      customerEmail: 'buyer@example.com',
      customerName: 'Test Buyer',
      customerPhone: '+2348000000000',
      shippingAddress: {
        fullName: 'Test Buyer',
        phone: '+2348000000000',
        streetAddress: '1 Test Way',
        city: 'Ikeja',
        state: 'Lagos',
        postalCode: '100001',
        country: 'Nigeria',
      },
      cartItems: [{ productId: imported.product.id, variantId: 'cjv_V1', quantity: 2 }],
    });

    assert.equal(order.subtotalCents, 4800);
    assert.equal(order.items[0].variantId, 'cjv_V1');
    const afterOrder = db.getProductBySlug(imported.product.slug)!;
    assert.equal(afterOrder.stockQuantity, 1);
    assert.equal(afterOrder.variants![0].stockQuantity, 1);

    // Failing payment restores variant stock back to 3
    db.failOrderPayment(order.orderReference, 'Cancelled in test');
    const afterFail = db.getProductBySlug(imported.product.slug)!;
    assert.equal(afterFail.stockQuantity, 3);
    assert.equal(afterFail.variants![0].stockQuantity, 3);

    // Syncing CJ stock to 0 marks product & variants unavailable
    const syncedZero = db.syncCjProductStock(
      imported.product.id,
      {
        totalInventory: 0,
        variantStocks: new Map([
          ['V1', 0],
          ['V2', 0],
        ]),
      },
      'Test Runner'
    );
    assert.equal(syncedZero.stockQuantity, 0);
    assert.equal(syncedZero.isAvailable, false);
    assert.equal(syncedZero.variants![0].isAvailable, false);

    // Add a legacy non-CJ product and confirm removeNonCjProducts removes only non-CJ items
    db.addProduct(
      {
        title: 'Legacy Non-CJ Item',
        slug: 'legacy-non-cj-item',
        category: 'room-desk',
        retailPriceCents: 1900,
        supplierCostCents: 900,
        stockQuantity: 10,
        isAvailable: true,
        availability: 'In Stock · Ready to Ship',
        description: 'Legacy item',
        image: 'https://example.com/legacy.jpg',
        imageAlt: 'Legacy Non-CJ Item',
        imageNeedsReview: false,
        sourceTitle: null,
        referencePriceCents: null,
        priceBasis: 'official',
        sourceDescription: false,
        trending: false,
      },
      'Test Runner'
    );
    const pruneResult = db.removeNonCjProducts('Test Runner');
    assert.ok(pruneResult.removedCount >= 1);
    const remaining = db.getProducts();
    assert.ok(remaining.every((p) => p.supplierSource === 'cjdropshipping' || Boolean(p.cjPid)));
  } finally {
    if (backup !== null) {
      fs.writeFileSync(dbPath, backup, 'utf8');
    }
  }
});

test('cjPricing: calculateProductDependentPricingCents scales profit by product cost and never exceeds 60% max', () => {
  // Low-cost accessory (<= $3.00): hits up to 60% max cap
  const micro = calculateProductDependentPricingCents(250, { category: 'phone-cases', maxProfitPercent: 60 });
  assert.equal(micro.markupPercent, 60);
  assert.equal(micro.retailPriceCents, 400);
  assert.equal(micro.profitCents, 150);

  // Odd cent low-cost item must never round above 60% cap
  for (const oddCost of [1, 3, 7, 11, 99, 151, 299]) {
    const res = calculateProductDependentPricingCents(oddCost, { maxProfitPercent: 60 });
    assert.ok(res.profitCents / oddCost <= 0.6 + 1e-9, `Profit exceeded 60% for cost ${oddCost}: ${res.profitCents}`);
    assert.ok(res.markupPercent <= 60, `Markup exceeded 60% for cost ${oddCost}: ${res.markupPercent}`);
  }

  // Mid-low ($3.01 - $10.00): 50%
  const midLow = calculateProductDependentPricingCents(1000, { category: 'charging' });
  assert.equal(midLow.markupPercent, 50);
  assert.equal(midLow.retailPriceCents, 1500);

  // Mid ($10.01 - $25.00): 40%
  const mid = calculateProductDependentPricingCents(2000, { category: 'audio' });
  assert.equal(mid.markupPercent, 40);
  assert.equal(mid.retailPriceCents, 2800);

  // Higher-ticket ($25.01 - $60.00): 30%, moderated -5% for computer/phones
  const computer = calculateProductDependentPricingCents(4000, { category: 'computer' });
  assert.equal(computer.markupPercent, 25);
  assert.equal(computer.retailPriceCents, 5000);

  // Requests > 60% are strictly clamped to 60% max
  const clamped = calculateProductDependentPricingCents(200, { maxProfitPercent: 120 });
  assert.ok(clamped.markupPercent <= 60);
  assert.equal(clamped.retailPriceCents, 320);
});
