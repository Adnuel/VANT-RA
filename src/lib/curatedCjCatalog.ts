/**
 * Curated VANTÉRA Product Categories & Specific CJdropshipping Import Specifications
 * Derived directly from CEO Adnuel's 5-category hardware & lifestyle collection brief.
 */

export type CuratedCategoryId =
  | 'premium-tech-accessories'
  | 'smart-home-technology'
  | 'laptop-workspace'
  | 'trending-lifestyle-gadgets'
  | 'premium-everyday-accessories';

export interface CuratedProductTypeSpec {
  id: string;
  label: string;
  categoryId: CuratedCategoryId;
  searchKeywords: string[];
  /** Product title/category must match at least one pattern (case-insensitive) */
  matchPatterns: RegExp[];
  /** Product title must NOT match any exclude pattern */
  excludePatterns?: RegExp[];
}

export interface CuratedCategorySpec {
  id: CuratedCategoryId;
  label: string;
  shortLabel: string;
  description: string;
  items: CuratedProductTypeSpec[];
}

export const CURATED_CATEGORIES: CuratedCategorySpec[] = [
  {
    id: 'premium-tech-accessories',
    label: 'Premium Tech Accessories',
    shortLabel: 'Tech Gear',
    description:
      'Magnetic charging stands, USB-C hubs, wireless earbuds, portable audio, smartwatch gear, and high-speed cables.',
    items: [
      {
        id: 'tech-magnetic-wire',
        label: 'Magnetic Wire',
        categoryId: 'premium-tech-accessories',
        searchKeywords: ['magnetic charging cable', 'magnetic usb cable'],
        matchPatterns: [/magnetic.*(cable|wire|cord|charger)/i, /(cable|wire|cord).*magnetic/i],
        excludePatterns: [/phone\s*holder|car\s*mount|ring\s*holder/i],
      },
      {
        id: 'tech-3in1-charging-stand',
        label: '3-in-1 Wireless Charging Stand',
        categoryId: 'premium-tech-accessories',
        searchKeywords: ['3 in 1 wireless charger stand', '3 in 1 magsafe charger'],
        matchPatterns: [/3[\s-]*in[\s-]*1.*(wireless|charg|magsafe|dock|station)/i],
      },
      {
        id: 'tech-magsafe-stand',
        label: 'MagSafe Phone Stand',
        categoryId: 'premium-tech-accessories',
        searchKeywords: ['magsafe charging stand', 'magsafe desktop stand'],
        matchPatterns: [/magsafe.*(stand|dock|charger)/i, /magnetic.*wireless.*stand/i],
        excludePatterns: [/\bcase\b|\bcover\b|\bwallet\b/i],
      },
      {
        id: 'tech-usb-c-hub',
        label: 'USB-C Hub',
        categoryId: 'premium-tech-accessories',
        searchKeywords: ['usb c hub adapter', 'type c hub docking'],
        matchPatterns: [/usb[\s-]*c.*(hub|dock|adapter|splitter)/i, /type[\s-]*c.*(hub|dock|hdmi)/i],
      },
      {
        id: 'tech-wireless-earbuds',
        label: 'Premium Wireless Earbuds',
        categoryId: 'premium-tech-accessories',
        searchKeywords: ['wireless bluetooth earbuds anc', 'tws wireless earbuds'],
        matchPatterns: [/(earbud|earphone|tws|headphone)/i],
        excludePatterns: [/\bcase\s*only\b|\bsilicone\s*cover\b|\bear\s*tip/i],
      },
      {
        id: 'tech-smartwatch-accessories',
        label: 'Smartwatch Accessories',
        categoryId: 'premium-tech-accessories',
        searchKeywords: ['apple watch band strap', 'smartwatch charger band'],
        matchPatterns: [/(smart\s*watch|apple\s*watch|iwatch).*(band|strap|case|charger|dock|loop)/i, /watch\s*(band|strap)/i],
      },
      {
        id: 'tech-bluetooth-speaker',
        label: 'Portable Bluetooth Speaker',
        categoryId: 'premium-tech-accessories',
        searchKeywords: ['portable bluetooth speaker mini'],
        matchPatterns: [/bluetooth.*speaker|portable.*speaker|wireless.*speaker/i],
      },
      {
        id: 'tech-lavalier-mic',
        label: 'Wireless Lavalier Microphone',
        categoryId: 'premium-tech-accessories',
        searchKeywords: ['wireless lavalier microphone', 'clip on wireless mic'],
        matchPatterns: [/(lavalier|lapel|wireless.*microphone|clip.*mic)/i],
      },
      {
        id: 'tech-fast-usbc-cable',
        label: 'Fast Charging USB-C Cable',
        categoryId: 'premium-tech-accessories',
        searchKeywords: ['fast charging usb c cable 100w', 'pd usb c cable'],
        matchPatterns: [/(usb[\s-]*c|type[\s-]*c|pd|fast\s*charg).*(cable|cord)/i],
      },
    ],
  },
  {
    id: 'smart-home-technology',
    label: 'Smart Home Technology',
    shortLabel: 'Smart Home',
    description:
      'Smart LED lighting, motion-sensing night lights, RGB ambient lamps, controllers, digital clocks, and automated dispensers.',
    items: [
      {
        id: 'home-smart-led-light',
        label: 'Smart LED Light',
        categoryId: 'smart-home-technology',
        searchKeywords: ['smart led light wifi', 'smart wifi bulb lamp'],
        matchPatterns: [/smart.*(led|light|bulb|lamp)/i],
      },
      {
        id: 'home-motion-night-light',
        label: 'Motion Sensor Night Light',
        categoryId: 'smart-home-technology',
        searchKeywords: ['motion sensor night light', 'rechargeable sensor light'],
        matchPatterns: [/motion\s*sensor.*(light|lamp)/i, /night\s*light.*sensor/i],
      },
      {
        id: 'home-smart-desk-lamp',
        label: 'Smart LED Desk Lamp',
        categoryId: 'smart-home-technology',
        searchKeywords: ['led desk lamp rechargeable', 'modern table desk lamp'],
        matchPatterns: [/(led|smart|touch).*desk\s*lamp/i, /table\s*lamp/i],
      },
      {
        id: 'home-rgb-ambient-light',
        label: 'RGB Ambient Light',
        categoryId: 'smart-home-technology',
        searchKeywords: ['rgb ambient light bar', 'rgb atmosphere lamp'],
        matchPatterns: [/rgb.*(light|lamp|bar|ambient|atmosphere)/i, /ambient.*(rgb|light)/i],
      },
      {
        id: 'home-smart-controller',
        label: 'Smart Home Controller',
        categoryId: 'smart-home-technology',
        searchKeywords: ['smart home switch tuya', 'wifi smart switch remote'],
        matchPatterns: [/smart.*(controller|switch|hub|remote|panel|zigbee|tuya)/i],
      },
      {
        id: 'home-led-strip-lights',
        label: 'LED Strip Lights',
        categoryId: 'smart-home-technology',
        searchKeywords: ['led strip lights rgb', 'smart led light strip'],
        matchPatterns: [/led.*strip|strip\s*light/i],
      },
      {
        id: 'home-digital-alarm-clock',
        label: 'Digital Alarm Clock',
        categoryId: 'smart-home-technology',
        searchKeywords: ['digital led alarm clock', 'modern mirror alarm clock'],
        matchPatterns: [/digital.*(alarm|clock)|led.*alarm\s*clock/i],
      },
      {
        id: 'home-automatic-soap-dispenser',
        label: 'Automatic Soap Dispenser',
        categoryId: 'smart-home-technology',
        searchKeywords: ['automatic foam soap dispenser', 'touchless soap dispenser'],
        matchPatterns: [/(automatic|sensor|touchless).*soap\s*dispenser/i],
      },
    ],
  },
  {
    id: 'laptop-workspace',
    label: 'Laptop & Workspace Accessories',
    shortLabel: 'Workspace',
    description:
      'Aluminum & foldable laptop stands, monitor light bars, wireless keyboard & mouse sets, desk vacuums, and cable architecture.',
    items: [
      {
        id: 'work-aluminum-laptop-stand',
        label: 'Aluminum Laptop Stand',
        categoryId: 'laptop-workspace',
        searchKeywords: ['aluminum laptop stand', 'ergonomic laptop riser'],
        matchPatterns: [/(aluminum|alloy|metal).*laptop\s*(stand|riser|holder)/i, /laptop\s*stand/i],
      },
      {
        id: 'work-wireless-keyboard-mouse',
        label: 'Wireless Keyboard & Mouse',
        categoryId: 'laptop-workspace',
        searchKeywords: ['wireless keyboard and mouse', 'bluetooth keyboard mouse set'],
        matchPatterns: [/wireless.*keyboard/i, /bluetooth.*keyboard/i],
      },
      {
        id: 'work-desk-cable-organizer',
        label: 'Desk Cable Organizer',
        categoryId: 'laptop-workspace',
        searchKeywords: ['desk cable organizer clip', 'magnetic cable organizer'],
        matchPatterns: [/cable.*(organizer|holder|clip|management|box)/i],
      },
      {
        id: 'work-monitor-light-bar',
        label: 'Monitor Light Bar',
        categoryId: 'laptop-workspace',
        searchKeywords: ['monitor light bar screenbar', 'computer monitor lamp'],
        matchPatterns: [/monitor.*(light|lamp|bar)|screen\s*light/i],
      },
      {
        id: 'work-foldable-laptop-stand',
        label: 'Foldable Laptop Stand',
        categoryId: 'laptop-workspace',
        searchKeywords: ['foldable laptop stand portable', 'folding notebook stand'],
        matchPatterns: [/fold(able|ing).*laptop\s*(stand|holder)/i, /portable.*laptop\s*stand/i],
      },
      {
        id: 'work-desktop-phone-holder',
        label: 'Desktop Phone Holder',
        categoryId: 'laptop-workspace',
        searchKeywords: ['desktop phone stand holder', 'rotatable desk phone holder'],
        matchPatterns: [/(desk|desktop|table).*phone.*(holder|stand)/i, /phone.*tablet.*stand/i],
        excludePatterns: [/car\s*mount|dashboard|windshield|vent/i],
      },
      {
        id: 'work-mini-desk-vacuum',
        label: 'Mini Desktop Vacuum Cleaner',
        categoryId: 'laptop-workspace',
        searchKeywords: ['mini desk vacuum cleaner', 'portable keyboard vacuum'],
        matchPatterns: [/(mini|desk|desktop|keyboard).*vacuum/i],
      },
      {
        id: 'work-portable-monitor-acc',
        label: 'Portable Monitor Accessories',
        categoryId: 'laptop-workspace',
        searchKeywords: ['portable monitor stand sleeve', 'monitor mount bracket'],
        matchPatterns: [/portable\s*monitor|monitor\s*(stand|arm|mount|bracket|sleeve)/i],
      },
    ],
  },
  {
    id: 'trending-lifestyle-gadgets',
    label: 'Trending Lifestyle Gadgets',
    shortLabel: 'Lifestyle',
    description:
      'Mini portable printers, electric cleaning brushes, portable blenders, mini projectors, handheld fans, and smart daily tools.',
    items: [
      {
        id: 'life-mini-printer',
        label: 'Mini Portable Printer',
        categoryId: 'trending-lifestyle-gadgets',
        searchKeywords: ['mini portable thermal printer', 'pocket wireless printer'],
        matchPatterns: [/(mini|portable|pocket|thermal).*printer/i],
      },
      {
        id: 'life-electric-cleaning-brush',
        label: 'Electric Cleaning Brush',
        categoryId: 'trending-lifestyle-gadgets',
        searchKeywords: ['electric spin cleaning brush', 'rechargeable cleaning brush'],
        matchPatterns: [/electric.*(cleaning|spin).*brush/i, /spin\s*scrubber/i],
      },
      {
        id: 'life-portable-blender',
        label: 'Portable Blender',
        categoryId: 'trending-lifestyle-gadgets',
        searchKeywords: ['portable usb blender juicer', 'mini blender bottle'],
        matchPatterns: [/(portable|mini|usb|wireless).*blender/i, /juicer\s*cup/i],
      },
      {
        id: 'life-mini-projector',
        label: 'Mini Projector',
        categoryId: 'trending-lifestyle-gadgets',
        searchKeywords: ['mini portable projector', 'smart home projector'],
        matchPatterns: [/(mini|portable|smart|wifi).*projector/i],
      },
      {
        id: 'life-handheld-fan',
        label: 'Rechargeable Handheld Fan',
        categoryId: 'trending-lifestyle-gadgets',
        searchKeywords: ['rechargeable handheld mini fan', 'portable cooling fan usb'],
        matchPatterns: [/(handheld|portable|mini|usb|cooling|rechargeable).*fan/i],
      },
      {
        id: 'life-digital-measuring-tape',
        label: 'Digital Measuring Tape',
        categoryId: 'trending-lifestyle-gadgets',
        searchKeywords: ['digital laser measuring tape', 'electronic tape measure'],
        matchPatterns: [/(digital|electronic|laser).*measur/i, /tape\s*measure/i],
      },
      {
        id: 'life-automatic-water-dispenser',
        label: 'Automatic Water Dispenser',
        categoryId: 'trending-lifestyle-gadgets',
        searchKeywords: ['automatic water bottle dispenser', 'electric water pump dispenser'],
        matchPatterns: [/(automatic|electric|usb).*water.*(dispenser|pump)/i],
      },
      {
        id: 'life-multifunction-kitchen-gadget',
        label: 'Multifunction Kitchen Gadget',
        categoryId: 'trending-lifestyle-gadgets',
        searchKeywords: ['multifunction vegetable chopper', 'electric food chopper garlic'],
        matchPatterns: [/kitchen|chopper|slicer|peeler|grinder|sealer/i],
      },
    ],
  },
  {
    id: 'premium-everyday-accessories',
    label: 'Premium Everyday Accessories',
    shortLabel: 'Everyday',
    description:
      'Minimalist wallets, travel & tech organizer bags, sunglass cases, smart travel accessories, and portable jewelry boxes.',
    items: [
      {
        id: 'carry-minimalist-wallet',
        label: 'Minimalist Wallet',
        categoryId: 'premium-everyday-accessories',
        searchKeywords: ['minimalist metal wallet rfid', 'slim aluminum card wallet'],
        matchPatterns: [/(minimalist|slim|metal|rfid|leather).*wallet|card\s*holder/i],
      },
      {
        id: 'carry-travel-organizer',
        label: 'Travel Organizer',
        categoryId: 'premium-everyday-accessories',
        searchKeywords: ['travel storage organizer bag', 'luggage packing organizer'],
        matchPatterns: [/travel.*(organizer|pouch|bag|storage)/i],
      },
      {
        id: 'carry-smart-travel-accessories',
        label: 'Smart Travel Accessories',
        categoryId: 'premium-everyday-accessories',
        searchKeywords: ['universal travel power adapter', 'digital luggage scale'],
        matchPatterns: [/travel.*(adapter|scale|pillow|lock|bottle|kit)/i],
      },
      {
        id: 'carry-sunglass-case',
        label: 'Premium Sunglass Case',
        categoryId: 'premium-everyday-accessories',
        searchKeywords: ['luxury leather sunglasses case', 'hard shell eyeglasses box'],
        matchPatterns: [/(sunglass|glasses|eyeglass).*(case|box|holder|pouch)/i],
      },
      {
        id: 'carry-electronic-organizer-bag',
        label: 'Electronic Organizer Bag',
        categoryId: 'premium-everyday-accessories',
        searchKeywords: ['electronic organizer bag cable', 'digital tech storage pouch'],
        matchPatterns: [/(electronic|digital|tech|cable|gadget).*(organizer|bag|pouch|case)/i],
      },
      {
        id: 'carry-portable-jewelry-box',
        label: 'Portable Jewellery Box',
        categoryId: 'premium-everyday-accessories',
        searchKeywords: ['portable travel jewelry box', 'mini leather jewelry organizer'],
        matchPatterns: [/(jewelry|jewellery).*(box|case|organizer)/i],
      },
    ],
  },
];

export const ALL_CURATED_SPECS: CuratedProductTypeSpec[] = CURATED_CATEGORIES.flatMap((c) => c.items);

export function getCuratedCategoryById(id: string): CuratedCategorySpec | undefined {
  return CURATED_CATEGORIES.find((c) => c.id === id);
}

/**
 * Checks if a candidate CJ product title/category strictly belongs to the given curated product specification.
 */
export function matchesCuratedSpec(
  title: string | null | undefined,
  categoryName: string | null | undefined,
  spec: CuratedProductTypeSpec
): boolean {
  const cleanTitle = String(title || '').trim();
  if (!cleanTitle) return false;

  if (spec.excludePatterns?.some((rx) => rx.test(cleanTitle))) {
    return false;
  }

  const combined = `${cleanTitle} ${categoryName || ''}`;
  return spec.matchPatterns.some((rx) => rx.test(cleanTitle) || rx.test(combined));
}

/**
 * Matches a CJ product against ALL curated specifications and returns the matching spec + category.
 * Returns null if the product is NOT one of the curated types specified by the CEO.
 */
export function findMatchingCuratedSpec(
  title: string | null | undefined,
  categoryName?: string | null | undefined
): CuratedProductTypeSpec | null {
  for (const spec of ALL_CURATED_SPECS) {
    if (matchesCuratedSpec(title, categoryName, spec)) {
      return spec;
    }
  }
  return null;
}

/**
 * Maps legacy storefront category slugs cleanly into the 5 new VANTÉRA categories so older URLs
 * or existing items remain grouped seamlessly.
 */
export function mapLegacyCategoryToCurated(category: string): CuratedCategoryId | string {
  switch (category) {
    case 'charging':
    case 'phone-cases':
    case 'audio':
    case 'phones':
    case 'photography':
      return 'premium-tech-accessories';
    case 'room-desk':
    case 'computer':
      return 'laptop-workspace';
    case 'festive-season':
    case 'trending':
      return 'trending-lifestyle-gadgets';
    default:
      return category;
  }
}
