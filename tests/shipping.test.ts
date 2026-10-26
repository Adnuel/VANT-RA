import test from 'node:test';
import assert from 'node:assert/strict';
import { formatNGN, formatUSD, convertUsdCentsToNgn } from '../src/lib/commerceLogic.ts';

test('Dual Currency conversion: Computes accurate Naira and USD values', () => {
  // $10.00 (1000 cents) at 1 USD = 1,500 NGN -> ₦15,000
  const naira = convertUsdCentsToNgn(1000, 1500);
  assert.equal(naira, 15000);
  assert.match(formatNGN(naira), /₦\s?15,000/);

  // $24.99 (2499 cents)
  assert.equal(formatUSD(2499), '$24.99');
});

test('Shipping rate logic: Applies destination-dependent rates and free shipping rules', () => {
  interface ShippingRule {
    country: string;
    currency: 'USD' | 'NGN';
    rate: number;
    freeOver: number;
  }

  const rules: Record<string, ShippingRule> = {
    NG: { country: 'Nigeria', currency: 'NGN', rate: 3500, freeOver: 75000 },
    US: { country: 'United States', currency: 'USD', rate: 500, freeOver: 5000 },
    GB: { country: 'United Kingdom', currency: 'USD', rate: 2500, freeOver: 15000 },
  };

  const calculateShipping = (countryCode: string, subtotal: number) => {
    const rule = rules[countryCode] || rules.US;
    if (subtotal >= rule.freeOver) return 0;
    return rule.rate;
  };

  // Nigeria: ₦40,000 -> ₦3,500 shipping
  assert.equal(calculateShipping('NG', 40000), 3500);
  // Nigeria: ₦80,000 -> ₦0 (Free shipping over ₦75,000)
  assert.equal(calculateShipping('NG', 80000), 0);

  // US: $30.00 (3000 cents) -> $5.00 (500 cents)
  assert.equal(calculateShipping('US', 3000), 500);
  // US: $65.00 (6500 cents) -> $0 (Free shipping over $50)
  assert.equal(calculateShipping('US', 6500), 0);
});

test('Carrier tracking link: Formats URL for DHL, FedEx, and GIG Logistics', () => {
  const getTrackingUrl = (carrier: string, trackingNumber: string) => {
    const c = carrier.toLowerCase();
    if (c.includes('dhl')) return `https://www.dhl.com/en/express/tracking.html?AWB=${encodeURIComponent(trackingNumber)}`;
    if (c.includes('fedex')) return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(trackingNumber)}`;
    if (c.includes('gig')) return `https://giglogistics.com/track?tracking=${encodeURIComponent(trackingNumber)}`;
    return `https://www.google.com/search?q=${encodeURIComponent(`${carrier} ${trackingNumber}`)}`;
  };

  assert.match(getTrackingUrl('DHL Express', '9841029384'), /AWB=9841029384/);
  assert.match(getTrackingUrl('FedEx Priority', '7841029384'), /trknbr=7841029384/);
  assert.match(getTrackingUrl('GIG Logistics', 'GIG-9912'), /tracking=GIG-9912/);
});
