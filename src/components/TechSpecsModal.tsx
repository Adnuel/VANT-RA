import React, { useState } from 'react';
import { Product } from '../data/catalog.ts';
import { useCart } from '../contexts/CartContext.tsx';
import { useCurrency } from '../contexts/CurrencyContext.tsx';

interface TechSpecsModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (url: string) => void;
}

export const TechSpecsModal: React.FC<TechSpecsModalProps> = ({
  product,
  isOpen,
  onClose,
  onNavigate,
}) => {
  const { addToCart, setIsCartOpen } = useCart();
  const { currency, formatAmount } = useCurrency();
  const [selectedFinish, setSelectedFinish] = useState<string>('Titanium Noir');
  const [quantity, setQuantity] = useState<number>(1);
  const [addedNotice, setAddedNotice] = useState<boolean>(false);

  if (!isOpen || !product) return null;

  const finishes = [
    { name: 'Titanium Noir', hex: '#141412', bgClass: 'bg-[#141412]' },
    { name: 'Natural Titanium', hex: '#8a8d8f', bgClass: 'bg-[#8a8d8f]' },
    { name: 'Desert Gold', hex: '#c4a66b', bgClass: 'bg-[#c4a66b]' },
    { name: 'Silver Frost', hex: '#e2e8f0', bgClass: 'bg-[#e2e8f0]' },
  ];

  const handleAddToCart = () => {
    addToCart(product, quantity);
    setAddedNotice(true);
    setTimeout(() => {
      setAddedNotice(false);
      onClose();
      setIsCartOpen(true);
    }, 700);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tech-specs-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-200"
    >
      <div className="bg-[#fbfaf7] text-[#121210] w-full max-w-3xl border border-[#252521] shadow-2xl rounded-xs overflow-hidden flex flex-col md:flex-row max-h-[90vh]">
        {/* Left Visual Stage */}
        <div className="md:w-1/2 bg-[#121210] p-8 flex flex-col items-center justify-between text-[#f8f7f4] relative overflow-hidden">
          {/* Subtle glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[#c4a66b]/15 blur-3xl rounded-full pointer-events-none"></div>

          <div className="w-full flex items-center justify-between text-[11px] font-mono tracking-widest text-[#a9a69f] uppercase z-10">
            <span>VANTÉRA STUDIO</span>
            <span className="text-[#c4a66b] font-bold">{selectedFinish}</span>
          </div>

          <div className="relative my-6 aspect-square w-full max-w-[260px] flex items-center justify-center z-10">
            <img
              src={product.image || ''}
              alt={product.title}
              className="max-h-full max-w-full object-contain filter drop-shadow-2xl transition-all duration-300"
            />
          </div>

          {/* Finish selector */}
          <div className="w-full z-10 pt-4 border-t border-[#252521] space-y-2">
            <span className="text-[10px] uppercase font-mono tracking-widest text-[#77746d] block text-center">
              Select Finish
            </span>
            <div className="flex items-center justify-center gap-3">
              {finishes.map((f) => (
                <button
                  key={f.name}
                  type="button"
                  onClick={() => setSelectedFinish(f.name)}
                  className={`w-6 h-6 rounded-full border border-white/20 transition-all cursor-pointer ${
                    selectedFinish === f.name
                      ? 'scale-125 ring-2 ring-[#c4a66b] ring-offset-2 ring-offset-[#121210]'
                      : 'hover:scale-110 opacity-70 hover:opacity-100'
                  } ${f.bgClass}`}
                  title={f.name}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right Hardware Specs & Purchase Sheet */}
        <div className="md:w-1/2 p-6 md:p-8 overflow-y-auto space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-[10px] uppercase font-mono tracking-widest text-[#9d8048] font-bold block">
                  {product.category.replace('-', ' ')} · Official Hardware
                </span>
                <h2 id="tech-specs-title" className="text-xl sm:text-2xl font-bold font-sans tracking-tight text-[#121210]">
                  {product.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-[#77746d] hover:text-[#121210] p-1.5 transition-colors cursor-pointer rounded-xs"
                aria-label="Close dialog"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-xs text-[#77746d] leading-relaxed">
              {product.description}
            </p>

            {/* Spec Table */}
            <div className="space-y-2 border-t border-b border-[#e7e4de] py-3 text-xs">
              <div className="flex justify-between py-1">
                <span className="text-[#77746d] font-mono text-[11px]">Chassis Material:</span>
                <span className="font-semibold text-[#121210]">Aerospace Grade Alloy / Grade 5 Titanium</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#77746d] font-mono text-[11px]">Thermal Architecture:</span>
                <span className="font-semibold text-[#121210]">Multi-Stage Passive Heat Dissipation</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#77746d] font-mono text-[11px]">Certification:</span>
                <span className="font-semibold text-[#121210]">Qi2 / CE / FCC / RoHS Verified</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#77746d] font-mono text-[11px]">Warranty:</span>
                <span className="font-semibold text-[#121210]">1-Year VANTÉRA Replacement Care</span>
              </div>
            </div>

            {/* Price Row */}
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-[10px] uppercase font-mono tracking-widest text-[#77746d] block">
                  Price ({currency})
                </span>
                <div className="text-2xl font-extrabold text-[#121210] font-sans">
                  {formatAmount(product.retailPriceCents * quantity)}
                </div>
              </div>

              {/* Quantity selector */}
              <div className="flex items-center border border-[#e7e4de] bg-white rounded-xs">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-2.5 py-1 text-xs hover:bg-[#eae7e0] cursor-pointer"
                >
                  -
                </button>
                <span className="px-3 py-1 font-mono text-xs font-bold">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  className="px-2.5 py-1 text-xs hover:bg-[#eae7e0] cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="pt-4 space-y-2">
            <button
              type="button"
              onClick={handleAddToCart}
              className="w-full bg-[#121210] text-[#f8f7f4] py-3.5 px-4 text-xs font-bold uppercase tracking-widest hover:bg-[#c4a66b] hover:text-[#121210] transition-colors rounded-xs flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-98"
            >
              <span>{addedNotice ? '✓ Added to Cart!' : 'Add to Bag'}</span>
              <span>·</span>
              <span>{formatAmount(product.retailPriceCents * quantity)}</span>
            </button>
            <p className="text-[10px] text-center text-[#77746d]">
              Direct GTBank wire settlement & card checkout supported · 100% CEO inspected
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
