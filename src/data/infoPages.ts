export interface InfoSection {
  heading: string;
  body: string;
}

export interface InfoPageData {
  eyebrow: string;
  title: string;
  intro: string;
  sections: InfoSection[];
}

export const INFO_PAGES: Record<string, InfoPageData> = {
  about: {
    eyebrow: 'ABOUT VANTÉRA',
    title: 'A considered approach to everyday technology.',
    intro:
      'VANTÉRA is a luxury technology storefront focused on smartphones, essential protection, inductive power, and workspace hardware engineered to last.',
    sections: [
      {
        heading: 'Technology, Elevated.',
        body: 'Modern devices deserve accessories designed with restraint, durability, and reliable performance. We curate items tested for build quality, thermal safety, and tactile precision rather than flooding our catalog with unvetted hardware.',
      },
      {
        heading: 'Authenticated Inventory & Pricing',
        body: 'Every item lists live availability and verified pricing automatically displayed in Naira (₦) across Nigeria and US Dollars ($) internationally, with instant manual currency switching in the header.',
      },
      {
        heading: 'Leadership & Accountability',
        body: 'Founded and personally overseen by CEO Adnuel (emmanueladarikwu@gmail.com | +234 913 279 3670), VANTÉRA operates with direct executive oversight across online gateway settlements, bank transfers, and regional fulfillment.',
      },
    ],
  },
  contact: {
    eyebrow: 'CONTACT & CONCIERGE',
    title: 'How can we assist you?',
    intro:
      'Our concierge and executive support desk assist with orders, delivery updates, warranty claims, and corporate procurement.',
    sections: [
      {
        heading: 'Customer Concierge & Orders',
        body: 'Email: emmanueladarikwu@gmail.com\nWhatsApp: +234 913 279 3670\nHours: Monday – Saturday, 8:00 AM – 8:00 PM (WAT)',
      },
      {
        heading: 'Headquarters & Leadership',
        body: 'CEO: Adnuel\nVANTÉRA — https://vantera.com.ng\nFor wholesale orders, bespoke corporate gifting, or urgent order assistance, contact us directly via email or verified WhatsApp.',
      },
      {
        heading: 'Order & Payment Verification',
        body: 'Card payments confirm automatically via server-verified payment gateway webhooks. Direct bank transfers (e.g., VAN-2026-XXXX) stay awaiting payment until reconciled by our team; you can also share your receipt on WhatsApp (+234 913 279 3670) for faster dispatch.',
      },
    ],
  },
  faq: {
    eyebrow: 'FREQUENTLY ASKED QUESTIONS',
    title: 'Essential answers on accounts, payments, and delivery.',
    intro: 'Clear information on ordering, verification, currencies, and post-purchase care at VANTÉRA.',
    sections: [
      {
        heading: 'Do I need an account to check out?',
        body: 'Yes. For buyer protection, verified order history, saved Nigerian addresses, and self-service tracking and returns, every checkout requires signing in or creating a VANTÉRA client account. Your cart is preserved automatically while you log in.',
      },
      {
        heading: 'What payment methods are accepted?',
        body: 'We accept instant Online Card / Gateway Payments (verified automatically server-side via webhook) and Direct Bank Transfer in NGN or USD. Card payments confirm immediately and move your order straight into processing; bank transfers remain awaiting verification until confirmed.',
      },
      {
        heading: 'How do USD ($) and Naira (₦) prices work?',
        body: 'Visitors in Nigeria automatically see prices in Naira (₦), while international visitors see US Dollars ($). You can switch between NGN and USD anytime in the navigation bar, and totals remain consistent across product pages, your bag, checkout, and email receipts.',
      },
      {
        heading: 'How much is delivery across Nigerian states?',
        body: 'Delivery fees are calculated dynamically by destination state before payment—starting from ₦2,500 within Lagos, ₦3,500–₦4,500 across Abuja (FCT) and neighbouring zones, and up to ₦6,500 for distant regions. Orders over ₦75,000 ($50) qualify for complimentary domestic delivery.',
      },
      {
        heading: 'How do I track an order or request a return?',
        body: 'Log in to your Account Vault or open the Order Tracking page using your reference (VAN-2026-XXXX). Eligible orders within 14 days can also submit a return or cancellation request directly from your order history.',
      },
    ],
  },
  shipping: {
    eyebrow: 'SHIPPING & DELIVERY POLICY',
    title: 'Transparent state-based fees and reliable transit.',
    intro: 'Every order is inspected, sealed in protective packaging, and routed through vetted logistics partners.',
    sections: [
      {
        heading: 'Processing & Dispatch Timeline',
        body: 'Orders paid via our online gateway begin processing immediately upon webhook confirmation. Bank transfer orders enter processing once settled and confirmed. Most in-stock items ship within 24 business hours.',
      },
      {
        heading: 'Nigerian State Delivery Fees & Transit Times',
        body: 'Lagos State: ₦2,500 (1–2 business days).\nAbuja FCT, Ogun, Oyo, Ogun/Southwest corridors: ₦3,500–₦4,500 (2–3 business days).\nRivers, Enugu, Kano, Kaduna & Regional States: ₦4,500–₦6,500 (3–5 business days).\nOrders of ₦75,000 ($50) or more receive complimentary standard domestic shipping.',
      },
      {
        heading: 'International Delivery & Tracking',
        body: 'International courier orders ship via DHL / Express Air in 5–8 business days. Live carrier tracking numbers and milestone updates (Processing, Shipped, Delivered) appear automatically in your Account and email confirmations.',
      },
    ],
  },
  returns: {
    eyebrow: 'RETURN & REFUND POLICY',
    title: 'Our 14-day quality and satisfaction guarantee.',
    intro: 'We stand behind every VANTÉRA item and make returns or cancellations straightforward inside your account.',
    sections: [
      {
        heading: '14-Day Return Window',
        body: 'Unused items in original, sealed packaging may be requested for return within 14 days of delivery. You can submit a return or cancellation request directly inside your Account Order History without calling support first.',
      },
      {
        heading: 'Damaged, Faulty, or Incorrect Items',
        body: 'If an item arrives damaged or exhibits a manufacturing fault, report it via your Account portal or contact emmanueladarikwu@gmail.com / WhatsApp (+234 913 279 3670) within 48 hours of delivery for a full replacement or refund at zero extra cost.',
      },
      {
        heading: 'Refunds & Processing',
        body: 'Approved cancellations before dispatch or verified returned items are refunded to your original payment method or bank account within 2–5 business days. Approved refunds automatically restore order stock and send confirmation to your email.',
      },
    ],
  },
  privacy: {
    eyebrow: 'PRIVACY POLICY',
    title: 'Your privacy, encryption, and data protection.',
    intro: 'VANTÉRA collects only the information needed to authenticate your account, deliver your orders, and prevent fraud.',
    sections: [
      {
        heading: 'Information We Collect',
        body: 'When you register or check out, we store your name, verified email address, Nigerian phone number (+234), saved delivery addresses, and order history. Passwords are stored exclusively as salted cryptographic hashes. Card details are never stored on VANTÉRA servers.',
      },
      {
        heading: 'Cookies & Essential Storage',
        body: 'We use essential tokens for account sign-in and cart persistence, alongside currency and analytics preferences managed via our on-site Cookie Notice. You can opt for Essential Only cookies at any time.',
      },
      {
        heading: 'Security Controls',
        body: 'All traffic is served over HTTPS with strict transport security headers, rate-limited authentication, HMAC-verified payment webhooks, and strict role isolation between customer accounts and executive administration.',
      },
    ],
  },
  terms: {
    eyebrow: 'TERMS OF SERVICE',
    title: 'Official terms and conditions of sale.',
    intro: 'These terms govern account registration, purchases, payments, delivery, and returns on VANTÉRA.',
    sections: [
      {
        heading: 'Accounts, Inventory & Orders',
        body: 'Checkout requires an authenticated VANTÉRA account. Inventory is reserved atomically at checkout; items marked Out of Stock cannot be ordered. If an online card payment fails or is cancelled, reserved stock is released and your bag items remain available to retry.',
      },
      {
        heading: 'Pricing, Currency & Payment Settlement',
        body: 'Prices are available in Nigerian Naira (₦) and US Dollars ($). Online gateway orders are marked paid strictly upon cryptographic gateway/webhook verification. Bank transfer orders remain awaiting payment until verified.',
      },
      {
        heading: 'Governing Law & Disputes',
        body: 'Purchases and services are governed under the laws of the Federal Republic of Nigeria, with direct resolution through our executive customer care desk (emmanueladarikwu@gmail.com).',
      },
    ],
  },
};
