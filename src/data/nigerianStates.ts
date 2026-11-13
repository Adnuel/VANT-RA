/**
 * Nigerian States, Delivery Zones, and Validation Utilities
 * Slogan: Technology, Elevated.
 */

export interface NigerianStateDelivery {
  name: string;
  code: string;
  zone: 'lagos' | 'abuja' | 'south_west' | 'south_east' | 'south_south' | 'north_central' | 'north_west' | 'north_east';
  deliveryFeeNgn: number;
  deliveryFeeUsdCents: number;
  transitTime: string;
}

export const NIGERIAN_STATES: NigerianStateDelivery[] = [
  { name: 'Lagos', code: 'LA', zone: 'lagos', deliveryFeeNgn: 2500, deliveryFeeUsdCents: 170, transitTime: '1 – 2 Business Days' },
  { name: 'FCT - Abuja', code: 'FC', zone: 'abuja', deliveryFeeNgn: 3500, deliveryFeeUsdCents: 235, transitTime: '2 – 3 Business Days' },
  
  // South-West
  { name: 'Ogun', code: 'OG', zone: 'south_west', deliveryFeeNgn: 3500, deliveryFeeUsdCents: 235, transitTime: '2 – 3 Business Days' },
  { name: 'Oyo', code: 'OY', zone: 'south_west', deliveryFeeNgn: 3500, deliveryFeeUsdCents: 235, transitTime: '2 – 3 Business Days' },
  { name: 'Osun', code: 'OS', zone: 'south_west', deliveryFeeNgn: 3500, deliveryFeeUsdCents: 235, transitTime: '2 – 3 Business Days' },
  { name: 'Ondo', code: 'ON', zone: 'south_west', deliveryFeeNgn: 3500, deliveryFeeUsdCents: 235, transitTime: '2 – 3 Business Days' },
  { name: 'Ekiti', code: 'EK', zone: 'south_west', deliveryFeeNgn: 3500, deliveryFeeUsdCents: 235, transitTime: '2 – 3 Business Days' },

  // South-East
  { name: 'Anambra', code: 'AN', zone: 'south_east', deliveryFeeNgn: 4500, deliveryFeeUsdCents: 300, transitTime: '3 – 4 Business Days' },
  { name: 'Enugu', code: 'EN', zone: 'south_east', deliveryFeeNgn: 4500, deliveryFeeUsdCents: 300, transitTime: '3 – 4 Business Days' },
  { name: 'Imo', code: 'IM', zone: 'south_east', deliveryFeeNgn: 4500, deliveryFeeUsdCents: 300, transitTime: '3 – 4 Business Days' },
  { name: 'Abia', code: 'AB', zone: 'south_east', deliveryFeeNgn: 4500, deliveryFeeUsdCents: 300, transitTime: '3 – 4 Business Days' },
  { name: 'Ebonyi', code: 'EB', zone: 'south_east', deliveryFeeNgn: 4500, deliveryFeeUsdCents: 300, transitTime: '3 – 4 Business Days' },

  // South-South
  { name: 'Rivers', code: 'RI', zone: 'south_south', deliveryFeeNgn: 4500, deliveryFeeUsdCents: 300, transitTime: '3 – 4 Business Days' },
  { name: 'Delta', code: 'DE', zone: 'south_south', deliveryFeeNgn: 4500, deliveryFeeUsdCents: 300, transitTime: '3 – 4 Business Days' },
  { name: 'Edo', code: 'ED', zone: 'south_south', deliveryFeeNgn: 4500, deliveryFeeUsdCents: 300, transitTime: '3 – 4 Business Days' },
  { name: 'Akwa Ibom', code: 'AK', zone: 'south_south', deliveryFeeNgn: 4500, deliveryFeeUsdCents: 300, transitTime: '3 – 4 Business Days' },
  { name: 'Cross River', code: 'CR', zone: 'south_south', deliveryFeeNgn: 4500, deliveryFeeUsdCents: 300, transitTime: '3 – 4 Business Days' },
  { name: 'Bayelsa', code: 'BY', zone: 'south_south', deliveryFeeNgn: 4500, deliveryFeeUsdCents: 300, transitTime: '3 – 4 Business Days' },

  // North-Central
  { name: 'Kogi', code: 'KO', zone: 'north_central', deliveryFeeNgn: 5000, deliveryFeeUsdCents: 335, transitTime: '3 – 5 Business Days' },
  { name: 'Kwara', code: 'KW', zone: 'north_central', deliveryFeeNgn: 5000, deliveryFeeUsdCents: 335, transitTime: '3 – 5 Business Days' },
  { name: 'Niger', code: 'NI', zone: 'north_central', deliveryFeeNgn: 5000, deliveryFeeUsdCents: 335, transitTime: '3 – 5 Business Days' },
  { name: 'Plateau', code: 'PL', zone: 'north_central', deliveryFeeNgn: 5000, deliveryFeeUsdCents: 335, transitTime: '3 – 5 Business Days' },
  { name: 'Benue', code: 'BE', zone: 'north_central', deliveryFeeNgn: 5000, deliveryFeeUsdCents: 335, transitTime: '3 – 5 Business Days' },
  { name: 'Nasarawa', code: 'NA', zone: 'north_central', deliveryFeeNgn: 5000, deliveryFeeUsdCents: 335, transitTime: '3 – 5 Business Days' },

  // North-West
  { name: 'Kaduna', code: 'KD', zone: 'north_west', deliveryFeeNgn: 5000, deliveryFeeUsdCents: 335, transitTime: '3 – 5 Business Days' },
  { name: 'Kano', code: 'KN', zone: 'north_west', deliveryFeeNgn: 5000, deliveryFeeUsdCents: 335, transitTime: '3 – 5 Business Days' },
  { name: 'Katsina', code: 'KT', zone: 'north_west', deliveryFeeNgn: 5000, deliveryFeeUsdCents: 335, transitTime: '3 – 5 Business Days' },
  { name: 'Sokoto', code: 'SO', zone: 'north_west', deliveryFeeNgn: 5000, deliveryFeeUsdCents: 335, transitTime: '3 – 5 Business Days' },
  { name: 'Kebbi', code: 'KE', zone: 'north_west', deliveryFeeNgn: 5000, deliveryFeeUsdCents: 335, transitTime: '3 – 5 Business Days' },
  { name: 'Zamfara', code: 'ZA', zone: 'north_west', deliveryFeeNgn: 5000, deliveryFeeUsdCents: 335, transitTime: '3 – 5 Business Days' },
  { name: 'Jigawa', code: 'JI', zone: 'north_west', deliveryFeeNgn: 5000, deliveryFeeUsdCents: 335, transitTime: '3 – 5 Business Days' },

  // North-East
  { name: 'Bauchi', code: 'BA', zone: 'north_east', deliveryFeeNgn: 5000, deliveryFeeUsdCents: 335, transitTime: '3 – 5 Business Days' },
  { name: 'Gombe', code: 'GO', zone: 'north_east', deliveryFeeNgn: 5000, deliveryFeeUsdCents: 335, transitTime: '3 – 5 Business Days' },
  { name: 'Borno', code: 'BO', zone: 'north_east', deliveryFeeNgn: 5000, deliveryFeeUsdCents: 335, transitTime: '3 – 5 Business Days' },
  { name: 'Yobe', code: 'YO', zone: 'north_east', deliveryFeeNgn: 5000, deliveryFeeUsdCents: 335, transitTime: '3 – 5 Business Days' },
  { name: 'Taraba', code: 'TA', zone: 'north_east', deliveryFeeNgn: 5000, deliveryFeeUsdCents: 335, transitTime: '3 – 5 Business Days' },
  { name: 'Adamawa', code: 'AD', zone: 'north_east', deliveryFeeNgn: 5000, deliveryFeeUsdCents: 335, transitTime: '3 – 5 Business Days' },
];

export const FREE_SHIPPING_THRESHOLD_NGN = 75000;
export const FREE_SHIPPING_THRESHOLD_USD_CENTS = 5000;

/**
 * Calculates delivery fee based on state, country, and subtotal
 */
export function calculateDeliveryFee(
  stateName: string,
  country: string = 'Nigeria',
  subtotalCents: number = 0,
  subtotalNgn: number = 0
): { feeNgn: number; feeCents: number; transitTime: string; isFree: boolean } {
  // Check free shipping threshold
  if (subtotalCents >= FREE_SHIPPING_THRESHOLD_USD_CENTS || subtotalNgn >= FREE_SHIPPING_THRESHOLD_NGN) {
    return {
      feeNgn: 0,
      feeCents: 0,
      transitTime: '1 – 3 Business Days (Express)',
      isFree: true,
    };
  }

  const cleanCountry = (country || 'Nigeria').trim().toLowerCase();
  if (cleanCountry !== 'nigeria' && cleanCountry !== 'ng') {
    // International standard courier
    return {
      feeNgn: 38000,
      feeCents: 2500, // $25.00
      transitTime: '5 – 7 Business Days (DHL/FedEx)',
      isFree: false,
    };
  }

  const found = NIGERIAN_STATES.find(
    (s) => s.name.toLowerCase() === (stateName || '').toLowerCase() || (stateName || '').toLowerCase().includes(s.name.toLowerCase())
  );

  if (found) {
    return {
      feeNgn: found.deliveryFeeNgn,
      feeCents: found.deliveryFeeUsdCents,
      transitTime: found.transitTime,
      isFree: false,
    };
  }

  // Default Nigerian courier
  return {
    feeNgn: 3500,
    feeCents: 235,
    transitTime: '2 – 4 Business Days',
    isFree: false,
  };
}

/**
 * Validates Nigerian phone number formats
 * Accepted: +234XXXXXXXXXX, 234XXXXXXXXXX, 080XXXXXXXX, 081XXXXXXXX, 090XXXXXXXX, 070XXXXXXXX, 091XXXXXXXX
 */
export function validateNigerianPhone(phone: string): { valid: boolean; formatted: string; error?: string } {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, formatted: '', error: 'Phone number is required' };
  }

  const cleaned = phone.replace(/[\s\-\(\)]/g, '');

  // +234 or 234 followed by 10 digits starting with 7, 8, or 9
  if (/^(\+?234)[789][01]\d{8}$/.test(cleaned)) {
    const formatted = cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
    return { valid: true, formatted };
  }

  // 0 followed by 10 digits: 080, 081, 090, 070, 091
  if (/^0[789][01]\d{8}$/.test(cleaned)) {
    const formatted = `+234${cleaned.slice(1)}`;
    return { valid: true, formatted };
  }

  // International standard fallback if not NG
  if (/^\+?[1-9]\d{7,14}$/.test(cleaned)) {
    const formatted = cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
    return { valid: true, formatted };
  }

  return {
    valid: false,
    formatted: phone,
    error: 'Please enter a valid Nigerian mobile phone number (e.g. +234 812 345 6789 or 08123456789)',
  };
}
