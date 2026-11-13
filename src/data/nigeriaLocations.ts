/**
 * VANTÉRA Nigerian Logistics & Geographical Database
 * Provides 36 Nigerian States + FCT, major cities/LGAs, state-based delivery rates,
 * transit duration estimates, and +234 phone number validation.
 */

export interface NigerianStateShippingInfo {
  state: string;
  zone: 'lagos' | 'south_west' | 'abuja_south' | 'nationwide';
  feeNgn: number;
  feeUsdCents: number;
  deliveryEstimate: string;
  majorCities: string[];
}

export const NIGERIAN_STATES: NigerianStateShippingInfo[] = [
  {
    state: 'Lagos',
    zone: 'lagos',
    feeNgn: 2500,
    feeUsdCents: 200,
    deliveryEstimate: '1 – 2 business days',
    majorCities: ['Ikeja', 'Lekki Phase 1', 'Victoria Island', 'Ikoyi', 'Surulere', 'Yaba', 'Alimosho', 'Ajah', 'Maryland', 'Oshodi', 'Festac', 'Gbagada'],
  },
  {
    state: 'Abuja (FCT)',
    zone: 'abuja_south',
    feeNgn: 4500,
    feeUsdCents: 350,
    deliveryEstimate: '2 – 3 business days',
    majorCities: ['Maitama', 'Wuse II', 'Garki', 'Asokoro', 'Gwarinpa', 'Jabi', 'Utako', 'Kubwa', 'Lugbe', 'Apo'],
  },
  {
    state: 'Rivers',
    zone: 'abuja_south',
    feeNgn: 4500,
    feeUsdCents: 350,
    deliveryEstimate: '2 – 4 business days',
    majorCities: ['Port Harcourt (GRA)', 'Trans-Amadi', 'Rumuokoro', 'Diobu', 'Eleme', 'Obio-Akpor', 'Bonny'],
  },
  {
    state: 'Ogun',
    zone: 'south_west',
    feeNgn: 4000,
    feeUsdCents: 300,
    deliveryEstimate: '2 – 3 business days',
    majorCities: ['Abeokuta', 'Sagamu', 'Ijebu-Ode', 'Ota', 'Ibafo', 'Mowe'],
  },
  {
    state: 'Oyo',
    zone: 'south_west',
    feeNgn: 4000,
    feeUsdCents: 300,
    deliveryEstimate: '2 – 3 business days',
    majorCities: ['Ibadan (Bodija)', 'Ibadan (Ring Road)', 'Ogbomoso', 'Oyo Town', 'Iseyin'],
  },
  {
    state: 'Delta',
    zone: 'abuja_south',
    feeNgn: 4500,
    feeUsdCents: 350,
    deliveryEstimate: '2 – 4 business days',
    majorCities: ['Asaba', 'Warri', 'Sapele', 'Ughelli', 'Agbor'],
  },
  {
    state: 'Edo',
    zone: 'abuja_south',
    feeNgn: 4500,
    feeUsdCents: 350,
    deliveryEstimate: '2 – 4 business days',
    majorCities: ['Benin City (GRA)', 'Uselu', 'Ekpoma', 'Auchi'],
  },
  {
    state: 'Anambra',
    zone: 'abuja_south',
    feeNgn: 4500,
    feeUsdCents: 350,
    deliveryEstimate: '2 – 4 business days',
    majorCities: ['Awka', 'Onitsha', 'Nnewi', 'Ekwulobia'],
  },
  {
    state: 'Enugu',
    zone: 'abuja_south',
    feeNgn: 4500,
    feeUsdCents: 350,
    deliveryEstimate: '2 – 4 business days',
    majorCities: ['Enugu (Independence Layout)', 'GRA', 'Nsukka', 'New Haven'],
  },
  {
    state: 'Imo',
    zone: 'abuja_south',
    feeNgn: 4500,
    feeUsdCents: 350,
    deliveryEstimate: '2 – 4 business days',
    majorCities: ['Owerri (Ikenegbu)', 'Orlu', 'Okigwe'],
  },
  {
    state: 'Abia',
    zone: 'abuja_south',
    feeNgn: 4500,
    feeUsdCents: 350,
    deliveryEstimate: '2 – 4 business days',
    majorCities: ['Umuahia', 'Aba', 'Ohafia'],
  },
  {
    state: 'Akwa Ibom',
    zone: 'abuja_south',
    feeNgn: 4500,
    feeUsdCents: 350,
    deliveryEstimate: '2 – 4 business days',
    majorCities: ['Uyo', 'Eket', 'Ikot Ekpene', 'Oron'],
  },
  {
    state: 'Cross River',
    zone: 'abuja_south',
    feeNgn: 4500,
    feeUsdCents: 350,
    deliveryEstimate: '2 – 4 business days',
    majorCities: ['Calabar', 'Ikom', 'Ogoja'],
  },
  {
    state: 'Kano',
    zone: 'nationwide',
    feeNgn: 5500,
    feeUsdCents: 450,
    deliveryEstimate: '3 – 5 business days',
    majorCities: ['Kano Municipal', 'Nassarawa', 'Fagge', 'Dala', 'Tarauni'],
  },
  {
    state: 'Kaduna',
    zone: 'nationwide',
    feeNgn: 5000,
    feeUsdCents: 400,
    deliveryEstimate: '3 – 5 business days',
    majorCities: ['Kaduna North', 'Kaduna South', 'Zaria', 'Kafanchan'],
  },
  {
    state: 'Plateau',
    zone: 'nationwide',
    feeNgn: 5000,
    feeUsdCents: 400,
    deliveryEstimate: '3 – 5 business days',
    majorCities: ['Jos North', 'Jos South', 'Bukuru', 'Pankshin'],
  },
  {
    state: 'Kwara',
    zone: 'south_west',
    feeNgn: 4500,
    feeUsdCents: 350,
    deliveryEstimate: '2 – 4 business days',
    majorCities: ['Ilorin', 'Offa', 'Omu-Aran'],
  },
  {
    state: 'Ondo',
    zone: 'south_west',
    feeNgn: 4000,
    feeUsdCents: 300,
    deliveryEstimate: '2 – 3 business days',
    majorCities: ['Akure', 'Ondo Town', 'Owo', 'Ikare'],
  },
  {
    state: 'Osun',
    zone: 'south_west',
    feeNgn: 4000,
    feeUsdCents: 300,
    deliveryEstimate: '2 – 3 business days',
    majorCities: ['Osogbo', 'Ile-Ife', 'Ede', 'Ilesa'],
  },
  {
    state: 'Ekiti',
    zone: 'south_west',
    feeNgn: 4000,
    feeUsdCents: 300,
    deliveryEstimate: '2 – 3 business days',
    majorCities: ['Ado-Ekiti', 'Ikere-Ekiti', 'Ijero'],
  },
  {
    state: 'Kogi',
    zone: 'nationwide',
    feeNgn: 4500,
    feeUsdCents: 350,
    deliveryEstimate: '2 – 4 business days',
    majorCities: ['Lokoja', 'Okene', 'Anyigba', 'Kabba'],
  },
  {
    state: 'Benue',
    zone: 'nationwide',
    feeNgn: 5000,
    feeUsdCents: 400,
    deliveryEstimate: '3 – 5 business days',
    majorCities: ['Makurdi', 'Gboko', 'Otukpo'],
  },
  {
    state: 'Bayelsa',
    zone: 'abuja_south',
    feeNgn: 5000,
    feeUsdCents: 400,
    deliveryEstimate: '3 – 5 business days',
    majorCities: ['Yenagoa', 'Brass', 'Ogbia'],
  },
  {
    state: 'Ebonyi',
    zone: 'abuja_south',
    feeNgn: 4500,
    feeUsdCents: 350,
    deliveryEstimate: '2 – 4 business days',
    majorCities: ['Abakaliki', 'Afikpo', 'Onueke'],
  },
  {
    state: 'Nasarawa',
    zone: 'nationwide',
    feeNgn: 4500,
    feeUsdCents: 350,
    deliveryEstimate: '2 – 4 business days',
    majorCities: ['Lafia', 'Keffi', 'Mararaba', 'Akwanga'],
  },
  {
    state: 'Niger',
    zone: 'nationwide',
    feeNgn: 5000,
    feeUsdCents: 400,
    deliveryEstimate: '3 – 5 business days',
    majorCities: ['Minna', 'Suleja', 'Bida', 'Kontagora'],
  },
  {
    state: 'Adamawa',
    zone: 'nationwide',
    feeNgn: 6000,
    feeUsdCents: 500,
    deliveryEstimate: '3 – 6 business days',
    majorCities: ['Yola', 'Jimeta', 'Mubi'],
  },
  {
    state: 'Bauchi',
    zone: 'nationwide',
    feeNgn: 5500,
    feeUsdCents: 450,
    deliveryEstimate: '3 – 5 business days',
    majorCities: ['Bauchi', 'Azare', 'Misau'],
  },
  {
    state: 'Borno',
    zone: 'nationwide',
    feeNgn: 6500,
    feeUsdCents: 550,
    deliveryEstimate: '4 – 7 business days',
    majorCities: ['Maiduguri', 'Biu'],
  },
  {
    state: 'Gombe',
    zone: 'nationwide',
    feeNgn: 6000,
    feeUsdCents: 500,
    deliveryEstimate: '3 – 6 business days',
    majorCities: ['Gombe', 'Kaltungo'],
  },
  {
    state: 'Jigawa',
    zone: 'nationwide',
    feeNgn: 6000,
    feeUsdCents: 500,
    deliveryEstimate: '3 – 6 business days',
    majorCities: ['Dutse', 'Hadejia', 'Kazaure'],
  },
  {
    state: 'Katsina',
    zone: 'nationwide',
    feeNgn: 5500,
    feeUsdCents: 450,
    deliveryEstimate: '3 – 5 business days',
    majorCities: ['Katsina', 'Daura', 'Funtua'],
  },
  {
    state: 'Kebbi',
    zone: 'nationwide',
    feeNgn: 6000,
    feeUsdCents: 500,
    deliveryEstimate: '4 – 6 business days',
    majorCities: ['Birnin Kebbi', 'Yauri', 'Argungu'],
  },
  {
    state: 'Sokoto',
    zone: 'nationwide',
    feeNgn: 6000,
    feeUsdCents: 500,
    deliveryEstimate: '4 – 6 business days',
    majorCities: ['Sokoto', 'Wamakko'],
  },
  {
    state: 'Taraba',
    zone: 'nationwide',
    feeNgn: 6000,
    feeUsdCents: 500,
    deliveryEstimate: '4 – 6 business days',
    majorCities: ['Jalingo', 'Wukari'],
  },
  {
    state: 'Yobe',
    zone: 'nationwide',
    feeNgn: 6500,
    feeUsdCents: 550,
    deliveryEstimate: '4 – 7 business days',
    majorCities: ['Damaturu', 'Potiskum', 'Gashua'],
  },
  {
    state: 'Zamfara',
    zone: 'nationwide',
    feeNgn: 6000,
    feeUsdCents: 500,
    deliveryEstimate: '4 – 6 business days',
    majorCities: ['Gusau', 'Kaura Namoda'],
  },
];

export const FREE_SHIPPING_THRESHOLD_NGN = 75000;
export const FREE_SHIPPING_THRESHOLD_USD_CENTS = 5000;

/**
 * Returns delivery fee in NGN and USD cents for a given Nigerian state.
 * Complimentary delivery for orders >= ₦75,000 ($50 USD).
 */
export function calculateNigerianDeliveryFee(
  stateName: string,
  subtotalNgn: number,
  subtotalCents: number,
  exchangeRate: number = 1350
): { feeNgn: number; feeCents: number; estimate: string; isComplimentary: boolean } {
  const isComplimentary = subtotalNgn >= FREE_SHIPPING_THRESHOLD_NGN || subtotalCents >= FREE_SHIPPING_THRESHOLD_USD_CENTS;
  if (isComplimentary) {
    return {
      feeNgn: 0,
      feeCents: 0,
      estimate: getDeliveryEstimate(stateName),
      isComplimentary: true,
    };
  }

  const match = NIGERIAN_STATES.find(
    (s) => s.state.toLowerCase() === (stateName || '').trim().toLowerCase()
  );

  const feeNgn = match ? match.feeNgn : 4500;
  const feeCents = match ? match.feeUsdCents : Math.round((feeNgn / exchangeRate) * 100);
  const estimate = match ? match.deliveryEstimate : '2 – 4 business days';

  return { feeNgn, feeCents, estimate, isComplimentary: false };
}

export function getDeliveryEstimate(stateName: string): string {
  const match = NIGERIAN_STATES.find(
    (s) => s.state.toLowerCase() === (stateName || '').trim().toLowerCase()
  );
  return match ? match.deliveryEstimate : '2 – 4 business days';
}

export function getLgasForState(stateName: string): string[] {
  const match = NIGERIAN_STATES.find(
    (s) => s.state.toLowerCase() === (stateName || '').trim().toLowerCase()
  );
  return match ? match.majorCities : ['Central District'];
}

/**
 * Validates and normalizes Nigerian mobile numbers to +234XXXXXXXXXX format.
 * Accepts:
 * - 08012345678 -> +2348012345678
 * - 070..., 090..., 091..., 081...
 * - +2348012345678
 * - 2348012345678
 */
export function validateNigerianPhone(input: string): {
  valid: boolean;
  formatted: string;
  error?: string;
} {
  if (!input || !input.trim()) {
    return { valid: false, formatted: '', error: 'Phone number is required.' };
  }

  const cleaned = input.trim().replace(/[\s\-()]/g, '');

  // Case 1: Starts with +234
  if (cleaned.startsWith('+234')) {
    const localPart = cleaned.slice(4);
    if (/^[789][01]\d{8}$/.test(localPart)) {
      return { valid: true, formatted: `+234${localPart}` };
    }
  }

  // Case 2: Starts with 234
  if (cleaned.startsWith('234') && cleaned.length === 13) {
    const localPart = cleaned.slice(3);
    if (/^[789][01]\d{8}$/.test(localPart)) {
      return { valid: true, formatted: `+234${localPart}` };
    }
  }

  // Case 3: Starts with 0 (e.g. 08031234567)
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    const localPart = cleaned.slice(1);
    if (/^[789][01]\d{8}$/.test(localPart)) {
      return { valid: true, formatted: `+234${localPart}` };
    }
  }

  // Case 4: 10 digits without leading 0 (e.g. 8031234567)
  if (cleaned.length === 10 && /^[789][01]\d{8}$/.test(cleaned)) {
    return { valid: true, formatted: `+234${cleaned}` };
  }

  return {
    valid: false,
    formatted: input,
    error: 'Please enter a valid Nigerian mobile number (e.g. +234 803 123 4567 or 0803 123 4567).',
  };
}
