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
        searchKeywords: ['magnetic charging cable', 'magnetic usb cable', 'magnetic data cable'],
        matchPatterns: [
          /magnetic.*(cable|wire|cord|charger|line|usb)/i,
          /(cable|wire|cord).*magnetic/i,
          /mag[\s-]*charg.*cable/i,
        ],
        excludePatterns: [/phone\s*holder|car\s*mount|ring\s*holder/i],
      },
      {
        id: 'tech-3in1-charging-stand',
        label: '3-in-1 Wireless Charging Stand',
        categoryId: 'premium-tech-accessories',
        searchKeywords: ['3 in 1 wireless charger', '3 in 1 charging stand', '3 in 1 magsafe charger'],
        matchPatterns: [
          /3[\s-]*in[\s-]*1.*(wireless|charg|magsafe|dock|station|stand)/i,
          /three[\s-]*in[\s-]*one.*(wireless|charg|stand)/i,
        ],
      },
      {
        id: 'tech-magsafe-stand',
        label: 'MagSafe Phone Stand',
        categoryId: 'premium-tech-accessories',
        searchKeywords: ['magsafe stand', 'magsafe wireless charger stand', 'magnetic wireless charger stand'],
        matchPatterns: [
          /magsafe.*(stand|dock|charger|holder|mount)/i,
          /magnetic.*wireless.*(stand|charger|dock)/i,
          /wireless.*charg.*phone\s*stand/i,
        ],
        excludePatterns: [/\bcase\b|\bcover\b|\bwallet\b|car\s*(mount|vent|air)/i],
      },
      {
        id: 'tech-usb-c-hub',
        label: 'USB-C Hub',
        categoryId: 'premium-tech-accessories',
        searchKeywords: ['usb c hub', 'type c hub', 'usb c docking station', 'usb c adapter'],
        matchPatterns: [
          /(usb[\s-]*c|type[\s-]*c).*(hub|dock|adapter|splitter|multiport|converter)/i,
          /(hub|docking).*type[\s-]*c/i,
        ],
      },
      {
        id: 'tech-wireless-earbuds',
        label: 'Premium Wireless Earbuds',
        categoryId: 'premium-tech-accessories',
        searchKeywords: ['wireless earbuds', 'tws bluetooth earbuds', 'wireless earphones anc'],
        matchPatterns: [/(earbud|earphone|tws|headphone|headset|in[\s-]*ear)/i],
        excludePatterns: [/\bcase\s*only\b|\bprotective\s*case\b|\bsilicone\s*cover\b|\bear\s*tip|\bdust\s*guard/i],
      },
      {
        id: 'tech-smartwatch-accessories',
        label: 'Smartwatch Accessories',
        categoryId: 'premium-tech-accessories',
        searchKeywords: ['smartwatch band', 'apple watch strap', 'smart watch charger', 'watch band strap'],
        matchPatterns: [
          /(smart\s*watch|apple\s*watch|iwatch|galaxy\s*watch|watch).*(band|strap|case|charger|dock|loop|cable|protector)/i,
          /watch\s*(band|strap|charger|dock|loop)/i,
        ],
      },
      {
        id: 'tech-bluetooth-speaker',
        label: 'Portable Bluetooth Speaker',
        categoryId: 'premium-tech-accessories',
        searchKeywords: ['portable bluetooth speaker', 'wireless bluetooth speaker', 'mini bluetooth speaker'],
        matchPatterns: [/(bluetooth|wireless|portable|mini).*speaker/i, /speaker.*bluetooth/i],
      },
      {
        id: 'tech-lavalier-mic',
        label: 'Wireless Lavalier Microphone',
        categoryId: 'premium-tech-accessories',
        searchKeywords: ['wireless lavalier microphone', 'wireless lapel microphone', 'mini wireless mic'],
        matchPatterns: [/(lavalier|lapel|wireless.*micro|microphone.*wireless|clip.*mic|collar.*mic)/i],
      },
      {
        id: 'tech-fast-usbc-cable',
        label: 'Fast Charging USB-C Cable',
        categoryId: 'premium-tech-accessories',
        searchKeywords: ['fast charging usb c cable', 'pd usb c cable', 'type c fast charging cable'],
        matchPatterns: [/(usb[\s-]*c|type[\s-]*c|pd|fast\s*charg|quick\s*charg|100w|60w).*(cable|cord|wire|line)/i],
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
        searchKeywords: ['smart led light', 'wifi smart bulb', 'smart led lamp'],
        matchPatterns: [/smart.*(led|light|bulb|lamp)/i, /wifi.*(bulb|light|led)/i],
      },
      {
        id: 'home-motion-night-light',
        label: 'Motion Sensor Night Light',
        categoryId: 'smart-home-technology',
        searchKeywords: ['motion sensor night light', 'sensor night light', 'human sensor led light'],
        matchPatterns: [
          /(motion|body|pir|infrared).*sensor.*(light|lamp)/i,
          /night\s*light/i,
          /sensor.*night\s*light/i,
        ],
      },
      {
        id: 'home-smart-desk-lamp',
        label: 'Smart LED Desk Lamp',
        categoryId: 'smart-home-technology',
        searchKeywords: ['led desk lamp', 'smart desk lamp', 'rechargeable desk lamp'],
        matchPatterns: [
          /(led|smart|touch|eye|folding|rechargeable|dimmable).*desk\s*lamp/i,
          /desk\s*lamp/i,
          /led.*table\s*lamp/i,
        ],
      },
      {
        id: 'home-rgb-ambient-light',
        label: 'RGB Ambient Light',
        categoryId: 'smart-home-technology',
        searchKeywords: ['rgb ambient light', 'rgb atmosphere lamp', 'ambient light bar'],
        matchPatterns: [
          /rgb.*(light|lamp|bar|ambient|atmosphere|mood)/i,
          /(ambient|atmosphere|sunset).*(light|lamp)/i,
        ],
      },
      {
        id: 'home-smart-controller',
        label: 'Smart Home Controller',
        categoryId: 'smart-home-technology',
        searchKeywords: ['smart home switch', 'smart wifi controller', 'tuya smart switch'],
        matchPatterns: [/smart.*(controller|switch|hub|gateway|remote|panel|zigbee|tuya|socket|plug)/i],
        excludePatterns: [/travel\s*(adapter|plug|charger)/i],
      },
      {
        id: 'home-led-strip-lights',
        label: 'LED Strip Lights',
        categoryId: 'smart-home-technology',
        searchKeywords: ['led strip lights', 'rgb led strip', 'smart led strip'],
        matchPatterns: [/led.*strip|strip\s*light|light\s*strip/i],
      },
      {
        id: 'home-digital-alarm-clock',
        label: 'Digital Alarm Clock',
        categoryId: 'smart-home-technology',
        searchKeywords: ['digital alarm clock', 'led alarm clock', 'smart mirror alarm clock'],
        matchPatterns: [/(digital|led|smart|mirror|electronic).*(alarm|clock)/i, /alarm\s*clock/i],
      },
      {
        id: 'home-automatic-soap-dispenser',
        label: 'Automatic Soap Dispenser',
        categoryId: 'smart-home-technology',
        searchKeywords: ['automatic soap dispenser', 'touchless soap dispenser', 'foam soap dispenser'],
        matchPatterns: [
          /(automatic|sensor|touchless|induction|smart|foam).*soap\s*dispenser/i,
          /soap\s*dispenser/i,
        ],
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
        searchKeywords: ['aluminum laptop stand', 'laptop riser', 'metal laptop stand'],
        matchPatterns: [
          /(aluminum|aluminium|alloy|metal|ergonomic).*laptop\s*(stand|riser|holder|bracket)/i,
          /laptop.*(stand|riser|holder)/i,
        ],
      },
      {
        id: 'work-wireless-keyboard-mouse',
        label: 'Wireless Keyboard & Mouse',
        categoryId: 'laptop-workspace',
        searchKeywords: ['wireless keyboard and mouse', 'bluetooth keyboard', 'wireless keyboard mouse'],
        matchPatterns: [/(wireless|bluetooth).*(keyboard|mouse)/i, /keyboard.*mouse/i],
      },
      {
        id: 'work-desk-cable-organizer',
        label: 'Desk Cable Organizer',
        categoryId: 'laptop-workspace',
        searchKeywords: ['desk cable organizer', 'cable organizer', 'cord holder clip'],
        matchPatterns: [/(cable|cord|wire).*(organizer|holder|clip|management|box|tidy|sleeve|winder)/i],
      },
      {
        id: 'work-monitor-light-bar',
        label: 'Monitor Light Bar',
        categoryId: 'laptop-workspace',
        searchKeywords: ['monitor light bar', 'computer monitor lamp', 'screenbar'],
        matchPatterns: [/(monitor|screen|computer).*(light\s*bar|lamp|hanging\s*light|reading\s*light)/i, /screenbar/i],
      },
      {
        id: 'work-foldable-laptop-stand',
        label: 'Foldable Laptop Stand',
        categoryId: 'laptop-workspace',
        searchKeywords: ['foldable laptop stand', 'folding laptop stand', 'portable laptop stand'],
        matchPatterns: [/(foldable|folding|portable|adjustable).*laptop\s*(stand|holder|riser)/i],
      },
      {
        id: 'work-desktop-phone-holder',
        label: 'Desktop Phone Holder',
        categoryId: 'laptop-workspace',
        searchKeywords: ['desktop phone holder', 'desk phone stand', 'desktop tablet stand'],
        matchPatterns: [
          /(desk|desktop|table|adjustable|rotating|foldable).*(phone|tablet|mobile).*(holder|stand|bracket)/i,
          /phone.*tablet.*stand/i,
        ],
        excludePatterns: [/car\s*mount|dashboard|windshield|vent|bicycle|bike|magnetic\s*phone\s*holder/i],
      },
      {
        id: 'work-mini-desk-vacuum',
        label: 'Mini Desktop Vacuum Cleaner',
        categoryId: 'laptop-workspace',
        searchKeywords: ['mini desk vacuum', 'desktop vacuum cleaner', 'keyboard vacuum'],
        matchPatterns: [/(mini|desk|desktop|table|keyboard|portable).*vacuum/i],
      },
      {
        id: 'work-portable-monitor-acc',
        label: 'Portable Monitor Accessories',
        categoryId: 'laptop-workspace',
        searchKeywords: ['portable monitor', 'monitor stand mount', 'portable display stand'],
        matchPatterns: [/portable\s*monitor|monitor\s*(stand|arm|mount|bracket|sleeve|holder|riser)/i],
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
        searchKeywords: ['mini portable printer', 'mini thermal printer', 'pocket printer'],
        matchPatterns: [/(mini|portable|pocket|thermal|inkless|bluetooth).*printer/i],
      },
      {
        id: 'life-electric-cleaning-brush',
        label: 'Electric Cleaning Brush',
        categoryId: 'trending-lifestyle-gadgets',
        searchKeywords: ['electric cleaning brush', 'electric spin scrubber', 'spin cleaning brush'],
        matchPatterns: [/(electric|spin|wireless|rechargeable|rotary).*(cleaning\s*brush|scrubber|brush)/i, /spin\s*scrubber/i],
      },
      {
        id: 'life-portable-blender',
        label: 'Portable Blender',
        categoryId: 'trending-lifestyle-gadgets',
        searchKeywords: ['portable blender', 'mini blender bottle', 'usb juicer blender'],
        matchPatterns: [/(portable|mini|usb|wireless|rechargeable|personal).*blender/i, /juicer\s*(cup|bottle|blender)/i],
      },
      {
        id: 'life-mini-projector',
        label: 'Mini Projector',
        categoryId: 'trending-lifestyle-gadgets',
        searchKeywords: ['mini projector', 'portable projector', 'smart home projector'],
        matchPatterns: [/(mini|portable|smart|wifi|pocket|home|hd).*projector/i, /\bprojector\b/i],
        excludePatterns: [/screen\s*only|curtain|storage\s*bag\s*only|bracket\s*only/i],
      },
      {
        id: 'life-handheld-fan',
        label: 'Rechargeable Handheld Fan',
        categoryId: 'trending-lifestyle-gadgets',
        searchKeywords: ['rechargeable handheld fan', 'handheld mini fan', 'portable cooling fan'],
        matchPatterns: [/(handheld|portable|mini|usb|rechargeable|folding|neck|pocket|cooling).*fan/i],
      },
      {
        id: 'life-digital-measuring-tape',
        label: 'Digital Measuring Tape',
        categoryId: 'trending-lifestyle-gadgets',
        searchKeywords: ['digital measuring tape', 'laser measuring tape', 'electronic tape measure'],
        matchPatterns: [
          /(digital|electronic|laser|smart|led).*(measuring\s*tape|tape\s*measure|rangefinder|ruler|measure)/i,
          /tape\s*measure/i,
        ],
      },
      {
        id: 'life-automatic-water-dispenser',
        label: 'Automatic Water Dispenser',
        categoryId: 'trending-lifestyle-gadgets',
        searchKeywords: ['automatic water dispenser', 'electric water pump dispenser', 'usb water dispenser'],
        matchPatterns: [/(automatic|electric|usb|rechargeable|portable).*water.*(dispenser|pump)/i],
      },
      {
        id: 'life-multifunction-kitchen-gadget',
        label: 'Multifunction Kitchen Gadget',
        categoryId: 'trending-lifestyle-gadgets',
        searchKeywords: ['multifunction kitchen gadget', 'electric vegetable chopper', 'electric garlic chopper'],
        matchPatterns: [
          /(multifunction|electric|mini|kitchen).*(chopper|slicer|peeler|grinder|sealer|mixer|gadget|whisk|cutter)/i,
          /(vegetable|garlic|food)\s*(chopper|slicer|cutter)/i,
        ],
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
        searchKeywords: ['minimalist wallet', 'slim metal wallet', 'rfid card wallet'],
        matchPatterns: [
          /(minimalist|slim|metal|rfid|aluminum|carbon|smart|popup|leather).*wallet/i,
          /(metal|rfid|minimalist|slim).*card\s*holder/i,
        ],
      },
      {
        id: 'carry-travel-organizer',
        label: 'Travel Organizer',
        categoryId: 'premium-everyday-accessories',
        searchKeywords: ['travel organizer', 'travel storage bag', 'packing organizer'],
        matchPatterns: [/travel.*(organizer|storage|pouch|bag|case|cube)/i, /packing\s*(cube|organizer)/i],
      },
      {
        id: 'carry-smart-travel-accessories',
        label: 'Smart Travel Accessories',
        categoryId: 'premium-everyday-accessories',
        searchKeywords: ['universal travel adapter', 'digital luggage scale', 'smart travel kit'],
        matchPatterns: [
          /(universal|smart|worldwide).*travel.*(adapter|charger|plug)/i,
          /(digital|electronic).*luggage\s*scale/i,
          /travel.*(adapter|scale|pillow|smart\s*lock|kit)/i,
        ],
      },
      {
        id: 'carry-sunglass-case',
        label: 'Premium Sunglass Case',
        categoryId: 'premium-everyday-accessories',
        searchKeywords: ['sunglass case', 'sunglasses case', 'leather glasses case'],
        matchPatterns: [/(sunglass|sunglasses|eyeglass|glasses).*(case|box|holder|organizer|pouch)/i],
      },
      {
        id: 'carry-electronic-organizer-bag',
        label: 'Electronic Organizer Bag',
        categoryId: 'premium-everyday-accessories',
        searchKeywords: ['electronic organizer bag', 'tech organizer bag', 'cable organizer pouch'],
        matchPatterns: [/(electronic|digital|tech|cable|gadget|charger).*(organizer|storage|bag|pouch|case)/i],
      },
      {
        id: 'carry-portable-jewelry-box',
        label: 'Portable Jewellery Box',
        categoryId: 'premium-everyday-accessories',
        searchKeywords: ['portable jewelry box', 'travel jewelry box', 'jewelry organizer box'],
        matchPatterns: [/(portable|travel|mini|leather).*(jewelry|jewellery).*(box|case|organizer|bag)/i, /(jewelry|jewellery)\s*(box|organizer)/i],
      },
    ],
  },
];

export const ALL_CURATED_SPECS: CuratedProductTypeSpec[] = CURATED_CATEGORIES.flatMap((c) => c.items);

export function getCuratedCategoryById(id: string): CuratedCategorySpec | undefined {
  return CURATED_CATEGORIES.find((c) => c.id === id);
}

export function getCuratedSpecById(id: string): CuratedProductTypeSpec | undefined {
  return ALL_CURATED_SPECS.find((s) => s.id === id);
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
