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
  "about": {
    "eyebrow": "ABOUT VANTÉRA",
    "title": "A considered approach to everyday technology.",
    "intro": "VANTÉRA is a premium technology storefront centred on phones, their everyday essentials, and a carefully selected set of high-performance accessories.",
    "sections": [
      {
        "heading": "Technology, Elevated.",
        "body": "Our guiding philosophy is singular: modern devices should be paired with accessories designed with restraint, craftsmanship, and longevity. We curate rather than aggregate, selecting only items that meet rigorous standards for tactile quality and durability."
      },
      {
        "heading": "Curated Catalog",
        "body": "Every phone case, charging dock, audio accessory, and workspace essential in the VANTÉRA catalog is chosen to complement your daily digital routine with sophistication and utility."
      },
      {
        "heading": "Leadership & Integrity",
        "body": "Under the direction of CEO Adnuel, VANTÉRA operates with direct personal oversight. Every direct bank transfer order is verified prior to dispatch to safeguard customer purchases."
      }
    ]
  },
  "contact": {
    "eyebrow": "CONTACT & SUPPORT",
    "title": "How can we assist you?",
    "intro": "Our customer concierge and executive desk are available to assist with orders, corporate procurement, and product inquiries.",
    "sections": [
      {
        "heading": "Customer Concierge & Orders",
        "body": "Email: emmanueladarikwu@gmail.com\nWhatsApp: +234 913 279 3670\nHours: Monday – Saturday, 8am – 8pm (WAT)"
      },
      {
        "heading": "Headquarters & Leadership",
        "body": "CEO: Adnuel\nVANTÉRA — Technology, Elevated.\nFor direct wholesale inquiries, bespoke corporate gifting, and strategic supplier partnerships, connect directly via our executive email or verified WhatsApp line."
      },
      {
        "heading": "Order & Payment Verification",
        "body": "Upon completing your checkout with Direct Bank Transfer, your unique order reference (e.g. VAN-2026-XXXX) is generated. For priority confirmation, forward your transfer receipt to WhatsApp (+234 913 279 3670) or track your order progress in your account portal."
      }
    ]
  },
  "faq": {
    "eyebrow": "FREQUENTLY ASKED QUESTIONS",
    "title": "Essential information regarding orders and services.",
    "intro": "Answers to common questions regarding purchasing, payments, and delivery with VANTÉRA.",
    "sections": [
      {
        "heading": "How do I place and confirm an order?",
        "body": "Select your desired items and proceed through the checkout drawer. Select Direct Bank Transfer to receive your order reference and designated business bank account details. Transfers are verified by CEO Adnuel before order fulfillment."
      },
      {
        "heading": "What payment methods are supported?",
        "body": "We currently process direct bank transfers to our verified corporate account under CEO Adnuel. This ensures maximum security, transparent transaction auditing, and immediate order assignment."
      },
      {
        "heading": "How can I track my package?",
        "body": "Navigate to the 'Order Status' page in the top or footer navigation, or log in to your VANTÉRA customer account. Enter your Order Reference (e.g. VAN-2026-XXXX) to view real-time fulfillment status."
      },
      {
        "heading": "Are products genuine and guaranteed?",
        "body": "All VANTÉRA products are authenticated and inspected prior to dispatch. Each item carries our standard VANTÉRA Purchase Assurance."
      },
      {
        "heading": "Will a case or charger fit my specific device?",
        "body": "Device compatibility details are listed on each product page. If you are unsure about model dimensions or charging protocols (e.g., MagSafe, Qi2, USB-C PD), reach out to our WhatsApp concierge (+234 913 279 3670) for personalized guidance."
      }
    ]
  },
  "shipping": {
    "eyebrow": "SHIPPING & DELIVERY",
    "title": "Careful packaging, prompt dispatch.",
    "intro": "We treat every order with meticulous care from our fulfillment centers to your doorstep.",
    "sections": [
      {
        "heading": "Order Dispatch Timeline",
        "body": "Once your direct bank transfer is verified, your order is prepared, packed in custom protective packaging, and dispatched within 24 to 48 business hours."
      },
      {
        "heading": "Shipping Destinations & Coverage",
        "body": "We provide priority regional delivery and international courier fulfillment. Standard ground delivery takes 3–5 business days, while express courier options are available for urgent requests."
      },
      {
        "heading": "Tracking & Notifications",
        "body": "You will receive an updated order milestone notification and tracking code as soon as your package has been handed over to our logistics partner."
      }
    ]
  },
  "returns": {
    "eyebrow": "RETURNS & EXCHANGES",
    "title": "Our commitment to quality assurance.",
    "intro": "We stand behind the craftsmanship and performance of every item in the VANTÉRA collection.",
    "sections": [
      {
        "heading": "Return Window",
        "body": "Unused items in original packaging with seals intact may be returned within 14 days of delivery for exchange or store credit."
      },
      {
        "heading": "Damaged or Defective Items",
        "body": "In the unlikely event an item arrives damaged or exhibits manufacturing faults, contact our support desk at emmanueladarikwu@gmail.com or WhatsApp within 48 hours for immediate replacement."
      },
      {
        "heading": "Return Process",
        "body": "To initiate a return, message our concierge team with your order reference (VAN-2026-XXXX) and photographs of the product condition. We will issue shipping instructions promptly."
      }
    ]
  },
  "privacy": {
    "eyebrow": "PRIVACY POLICY",
    "title": "Your privacy and data security.",
    "intro": "VANTÉRA respects your personal information and handles your data with strict confidentiality.",
    "sections": [
      {
        "heading": "Information We Collect",
        "body": "We collect information necessary to fulfill your orders: name, shipping address, email, phone number, and transaction references. We never store payment banking credentials on client devices."
      },
      {
        "heading": "Use of Information",
        "body": "Your details are utilized solely for order processing, customer support communication, and security verification. We do not sell or trade customer personal data with external third parties."
      },
      {
        "heading": "Data Security",
        "body": "All transactions and account sessions are secured using encrypted server-side tokens and modern industry-standard cryptographic protocols."
      }
    ]
  },
  "terms": {
    "eyebrow": "TERMS OF SERVICE",
    "title": "Official terms and purchase conditions.",
    "intro": "These terms govern the purchase of goods and access to services provided by VANTÉRA.",
    "sections": [
      {
        "heading": "Purchases & Payment",
        "body": "All orders are subject to acceptance and payment verification. Pricing is displayed in USD. Upon completing order checkout, the buyer agrees to fulfill payment via direct bank transfer using the generated order reference."
      },
      {
        "heading": "Product Representation",
        "body": "We make every effort to display product colors, textures, and specifications accurately. Specifications reflect real-world performance metrics."
      },
      {
        "heading": "Governing Law",
        "body": "These terms are interpreted and enforced in accordance with applicable commercial trade laws, with direct escalation to executive management under CEO Adnuel."
      }
    ]
  }
};
