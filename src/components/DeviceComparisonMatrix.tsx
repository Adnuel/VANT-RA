import React, { useState } from 'react';
import { Product } from '../data/catalog.ts';
import { useCart } from '../contexts/CartContext.tsx';
import { useCurrency } from '../contexts/CurrencyContext.tsx';

interface DeviceComparisonMatrixProps {
  products: Product[];
  onNavigate: (url: string) => void;
}

export const DeviceComparisonMatrix: React.FC<DeviceComparisonMatrixProps> = ({ products, onNavigate }) => {
  const { addToCart, setIsCartOpen } = useCart();
  const { currency, formatAmount } = useCurrency();

  // Pick default compare items across categories
  const defaultItems = products.filter((p) =>
    ['foldable-laptop-stand', 'compact-20w-usb-c-charger', 'wireless-bluetooth-earbuds'].includes(p.id)
  );

  const [slot1, setSlot1] = useState<string>(defaultItems[0]?.id || products[0]?.id || '');
  const [slot2, setSlot2] = useState<string>(defaultItems[1]?.id || products[1]?.id || '');
  const [slot3, setSlot3] = useState<string>(defaultItems[2]?.id || products[2]?.id || '');

  const p1 = products.find((p) => p.id === slot1) || products[0];
  const p2 = products.find((p) => p.id === slot2) || products[1];
  const p3 = products.find((p) => p.id === slot3) || products[2];

  const compareList = [p1, p2, p3].filter(Boolean);

  const getTechDetails = (p: Product) => {
    switch (p.category) {
      case 'charging':
        return {
          powerOutput: 'GaNFast™ 20W - 65W Turbo',
          connectivity: 'Dual USB-C PD 3.0 / PPS',
          durability: 'Flame-Retardant V0 Polycarbonate',
          efficiency: '94.2% Conversion Ratio',
          bestFor: 'Rapid iPhone & Mac Top-Ups',
        };
      case 'audio':
        return {
          powerOutput: '32h Total Playback (Case + Buds)',
          connectivity: 'Bluetooth 5.3 + Dual-Mic ENC',
          durability: 'IPX5 Splash & Sweat Resistance',
          efficiency: 'Ultra-low 45ms Latency Mode',
          bestFor: 'Studio Acoustics & Daily Commute',
        };
      case 'room-desk':
        return {
          powerOutput: 'Passive Heat Dissipation Fin',
          connectivity: 'Universal Ergonomic Fit',
          durability: 'Aircraft Grade CNC Aluminum',
          efficiency: '15,000 Hinge Rotation Cycle',
          bestFor: 'Posture Alignment & Laptop Cooling',
        };
      default:
        return {
          powerOutput: 'Qi2 Magnetic Alignment',
          connectivity: 'Zero Signal Interference',
          durability: 'Impact-Resistant TPU Armor',
          efficiency: 'Anti-Yellowing UV Barrier',
          bestFor: 'Everyday Flagship Defense',
        };
    }
  };

  const handleAddSingle = (p: Product) => {
    addToCart(p, 1);
    setIsCartOpen(true);
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#e7e4de] pb-6">
        <div>
          <span className="text-[10px] uppercase tracking-widest font-mono text-[#c4a66b] font-bold">
            SAMSUNG-STYLE COMPARISON STUDIO
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#121210] tracking-tight mt-1 font-sans">
            Compare Flagship Essentials
          </h2>
          <p className="text-xs sm:text-sm text-[#77746d] mt-1">
            Analyze architectural specs, thermal materials, and power efficiency side by side.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto pb-4">
        <div className="min-w-[760px] grid grid-cols-3 gap-6">
          {compareList.map((p, idx) => {
            const specs = getTechDetails(p);
            return (
              <div
                key={p.id + idx}
                className="bg-white border border-[#e7e4de] p-6 rounded-xs flex flex-col justify-between space-y-6 hover:border-[#121210] transition-colors shadow-2xs"
              >
                {/* Header & Product Switcher Dropdown */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-[#77746d]">
                      SLOT 0{idx + 1}
                    </span>
                    <select
                      value={p.id}
                      onChange={(e) => {
                        const newId = e.target.value;
                        if (idx === 0) setSlot1(newId);
                        if (idx === 1) setSlot2(newId);
                        if (idx === 2) setSlot3(newId);
                      }}
                      className="text-xs font-mono bg-[#fbfaf7] border border-[#e7e4de] rounded-xs px-2 py-1 max-w-[140px] truncate cursor-pointer text-[#121210] focus:outline-none focus:border-[#121210]"
                    >
                      {products.slice(0, 20).map((prod) => (
                        <option key={prod.id} value={prod.id}>
                          {prod.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="aspect-square bg-[#f4f2ee] rounded-xs p-4 flex items-center justify-center">
                    <img
                      src={p.image || ''}
                      alt={p.title}
                      className="max-h-full max-w-full object-contain filter drop-shadow-md"
                    />
                  </div>

                  <div>
                    <span className="text-[9px] uppercase font-mono tracking-wider text-[#9d8048] font-bold block">
                      {p.category.replace('-', ' ')}
                    </span>
                    <h3 className="font-bold text-sm text-[#121210] line-clamp-1">{p.title}</h3>
                    <div className="text-base font-extrabold text-[#121210] mt-1">
                      {formatAmount(p.retailPriceCents)}
                    </div>
                  </div>
                </div>

                {/* Specs List */}
                <div className="space-y-3 pt-4 border-t border-[#e7e4de] text-xs font-sans">
                  <div>
                    <span className="text-[10px] text-[#77746d] font-mono block">Power & Output</span>
                    <span className="font-semibold text-[#121210]">{specs.powerOutput}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#77746d] font-mono block">Connectivity</span>
                    <span className="font-semibold text-[#121210]">{specs.connectivity}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#77746d] font-mono block">Chassis Durability</span>
                    <span className="font-semibold text-[#121210]">{specs.durability}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#77746d] font-mono block">Efficiency Rating</span>
                    <span className="font-semibold text-[#121210]">{specs.efficiency}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#77746d] font-mono block">Engineered For</span>
                    <span className="font-semibold text-[#121210]">{specs.bestFor}</span>
                  </div>
                </div>

                {/* Action button */}
                <div className="pt-4 border-t border-[#e7e4de]">
                  <button
                    type="button"
                    onClick={() => handleAddSingle(p)}
                    className="w-full bg-[#121210] text-[#f8f7f4] py-2.5 text-xs uppercase tracking-wider font-bold hover:bg-[#c4a66b] hover:text-[#121210] transition-colors rounded-xs cursor-pointer shadow-xs"
                  >
                    Add {p.title.split(' ')[0]} to Cart
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
