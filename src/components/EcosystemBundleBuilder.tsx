import React, { useState } from 'react';
import { Product } from '../data/catalog.ts';
import { useCart } from '../contexts/CartContext.tsx';
import { useCurrency } from '../contexts/CurrencyContext.tsx';

interface EcosystemBundleBuilderProps {
  products: Product[];
}

export const EcosystemBundleBuilder: React.FC<EcosystemBundleBuilderProps> = ({ products }) => {
  const { addToCart, setIsCartOpen } = useCart();
  const { currency, formatAmount } = useCurrency();

  // Pick top candidates for 3 pillars
  const deskItem = products.find((p) => p.id === 'foldable-laptop-stand') || products[0];
  const powerItem = products.find((p) => p.id === 'compact-20w-usb-c-charger') || products[1];
  const audioItem = products.find((p) => p.id === 'wireless-bluetooth-earbuds') || products[2];

  const [selectedItems, setSelectedItems] = useState<{ [key: string]: boolean }>({
    [deskItem.id]: true,
    [powerItem.id]: true,
    [audioItem.id]: true,
  });

  const [bundleAdded, setBundleAdded] = useState(false);

  const bundleCandidates = [
    { item: deskItem, role: 'Desk Ergonomics', tag: 'AERO-STAND' },
    { item: powerItem, role: 'GaN Turbo Power', tag: 'FAST-POWER' },
    { item: audioItem, role: 'Acoustic Clarity', tag: 'TRUE-AUDIO' },
  ];

  const activeBundleItems = bundleCandidates.filter((c) => selectedItems[c.item.id]);

  const rawTotalCents = activeBundleItems.reduce((acc, curr) => acc + curr.item.retailPriceCents, 0);
  const isEligibleForBundleDiscount = activeBundleItems.length >= 2;
  const discountRate = isEligibleForBundleDiscount ? 0.15 : 0;
  const bundleDiscountCents = Math.round(rawTotalCents * discountRate);
  const finalBundleTotalCents = rawTotalCents - bundleDiscountCents;

  const toggleItem = (id: string) => {
    setSelectedItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleAddBundleToCart = () => {
    activeBundleItems.forEach((c) => {
      addToCart(c.item, 1);
    });
    setBundleAdded(true);
    setTimeout(() => {
      setBundleAdded(false);
      setIsCartOpen(true);
    }, 600);
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
      <div className="bg-[#121210] border border-[#2a2a26] text-[#f8f7f4] p-8 sm:p-12 rounded-xs shadow-xl relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute -top-24 right-0 w-96 h-96 bg-[#c4a66b]/10 blur-[120px] pointer-events-none rounded-full" />

        <div className="relative z-10 space-y-8">
          <div className="max-w-2xl space-y-2">
            <span className="text-[10px] uppercase font-mono tracking-widest text-[#c4a66b] font-bold">
              CONNECTED WORKSPACE ECOSYSTEM
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight font-sans text-white">
              VANTÉRA Complete Ecosystem
            </h2>
            <p className="text-xs sm:text-sm text-[#a9a69f] leading-relaxed">
              Combine your desk ergonomics, GaN fast charging, and studio acoustic earbuds. Save 15% automatically when pairing 2 or more flagship essentials.
            </p>
          </div>

          {/* Interactive 3-Item Selector Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {bundleCandidates.map(({ item, role, tag }) => {
              const isSelected = selectedItems[item.id];
              return (
                <div
                  key={item.id}
                  onClick={() => toggleItem(item.id)}
                  className={`border p-6 rounded-xs transition-all cursor-pointer flex flex-col justify-between space-y-4 relative ${
                    isSelected
                      ? 'bg-[#1a1a18] border-[#c4a66b] shadow-md'
                      : 'bg-[#151513]/60 border-[#2a2a26] opacity-70 hover:opacity-100'
                  }`}
                >
                  {/* Selection Checkbox */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-[#c4a66b] font-semibold">
                      {role}
                    </span>
                    <div
                      className={`w-5 h-5 rounded-2xs flex items-center justify-center transition-colors ${
                        isSelected ? 'bg-[#c4a66b] text-[#121210]' : 'border border-[#77746d]'
                      }`}
                    >
                      {isSelected ? (
                        <svg className="w-3.5 h-3.5 text-[#121210]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : null}
                    </div>
                  </div>

                  <div className="aspect-square bg-[#0f0f0e] rounded-xs p-4 flex items-center justify-center">
                    <img
                      src={item.image || ''}
                      alt={item.title}
                      className="max-h-full max-w-full object-contain filter drop-shadow-md"
                    />
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-white line-clamp-1">{item.title}</h4>
                    <div className="flex items-baseline justify-between pt-1">
                      <span className="text-xs font-bold text-[#c4a66b] font-mono">
                        {formatAmount(item.retailPriceCents)}
                      </span>
                      <span className="text-[10px] text-[#77746d] font-mono uppercase">{tag}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bundle Summary Bar */}
          <div className="pt-6 border-t border-[#2e2e2a] flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="space-y-1 text-center sm:text-left">
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#a9a69f] font-mono uppercase">Ecosystem Total:</span>
                {isEligibleForBundleDiscount && (
                  <span className="text-xs font-mono line-through text-[#77746d]">
                    {formatAmount(rawTotalCents)}
                  </span>
                )}
                <span className="text-2xl font-extrabold text-white font-sans">
                  {formatAmount(finalBundleTotalCents)}
                </span>
                {isEligibleForBundleDiscount && (
                  <span className="text-xs bg-[#c4a66b] text-[#121210] px-2 py-0.5 font-bold font-mono rounded-2xs">
                    15% OFF BUNDLE
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#77746d]">
                {activeBundleItems.length} items configured · Free Express delivery across Nigeria & Worldwide
              </p>
            </div>

            <button
              type="button"
              onClick={handleAddBundleToCart}
              disabled={activeBundleItems.length === 0}
              className="bg-[#c4a66b] text-[#121210] px-8 py-4 text-xs font-bold uppercase tracking-widest hover:bg-[#d6b97d] transition-all rounded-xs cursor-pointer shadow-lg active:scale-95 disabled:opacity-40"
            >
              {bundleAdded
                ? '✓ Bundle Added to Bag!'
                : `Add Entire Bundle (${activeBundleItems.length} Items)`}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
