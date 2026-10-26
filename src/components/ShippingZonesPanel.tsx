import React, { useState } from 'react';

export interface ShippingZone {
  id: string;
  name: string;
  regions: string[];
  carrier: string;
  currency: 'USD' | 'NGN';
  rateAmount: number;
  freeShippingThreshold?: number;
  estimatedDays: string;
  isActive: boolean;
}

const DEFAULT_SHIPPING_ZONES: ShippingZone[] = [
  {
    id: 'zone_ng_standard',
    name: 'Nigeria Domestic Standard (GIG / Courier)',
    regions: ['Nigeria', 'Lagos', 'Abuja', 'Port Harcourt', 'All States'],
    carrier: 'GIG Logistics',
    currency: 'NGN',
    rateAmount: 3500,
    freeShippingThreshold: 75000,
    estimatedDays: '2 - 4 business days',
    isActive: true,
  },
  {
    id: 'zone_ng_express',
    name: 'Nigeria Express Priority Delivery',
    regions: ['Lagos', 'Abuja'],
    carrier: 'DHL Express Nigeria',
    currency: 'NGN',
    rateAmount: 6500,
    estimatedDays: 'Next business day',
    isActive: true,
  },
  {
    id: 'zone_us_standard',
    name: 'United States & North America Standard',
    regions: ['United States', 'Canada'],
    carrier: 'USPS Priority / FedEx Ground',
    currency: 'USD',
    rateAmount: 500, // $5.00
    freeShippingThreshold: 5000, // Free over $50
    estimatedDays: '3 - 5 business days',
    isActive: true,
  },
  {
    id: 'zone_intl_dhl',
    name: 'Worldwide Express Courier (DHL / FedEx)',
    regions: ['United Kingdom', 'Europe', 'Australia', 'Rest of World'],
    carrier: 'DHL Express Worldwide',
    currency: 'USD',
    rateAmount: 2500, // $25.00
    freeShippingThreshold: 15000, // Free over $150
    estimatedDays: '3 - 7 business days',
    isActive: true,
  },
];

export function ShippingZonesPanel() {
  const [zones, setZones] = useState<ShippingZone[]>(DEFAULT_SHIPPING_ZONES);
  const [editingZone, setEditingZone] = useState<ShippingZone | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const toggleZone = (id: string) => {
    setZones((prev) =>
      prev.map((z) => (z.id === id ? { ...z, isActive: !z.isActive } : z))
    );
    setSaveSuccess('Shipping rule updated.');
    setTimeout(() => setSaveSuccess(null), 3000);
  };

  const saveZoneForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingZone) return;
    setZones((prev) =>
      prev.map((z) => (z.id === editingZone.id ? editingZone : z))
    );
    setEditingZone(null);
    setSaveSuccess(`Shipping zone "${editingZone.name}" saved successfully.`);
    setTimeout(() => setSaveSuccess(null), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-lg font-bold text-[#121210]">Destination-Dependent Shipping & Logistics Zones</h2>
          <p className="text-xs text-[#77746d]">
            Configure regional courier rates, free shipping thresholds, and estimated delivery timelines for USD and NGN.
          </p>
        </div>

        {saveSuccess && (
          <div className="px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-mono rounded">
            ✓ {saveSuccess}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {zones.map((zone) => (
          <div
            key={zone.id}
            className={`p-5 bg-white border ${zone.isActive ? 'border-[#e7e4de]' : 'border-dashed border-gray-300 opacity-60'} shadow-xs space-y-3`}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-sm text-[#121210]">{zone.name}</h3>
                <span className="text-[11px] font-mono text-[#c4a66b] font-semibold">{zone.carrier}</span>
              </div>
              <button
                onClick={() => toggleZone(zone.id)}
                className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded font-bold ${
                  zone.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {zone.isActive ? 'Active Zone' : 'Disabled'}
              </button>
            </div>

            <div className="text-xs text-[#77746d] space-y-1">
              <div>Regions: <strong className="text-[#121210]">{zone.regions.join(', ')}</strong></div>
              <div>Estimated Transit: <strong className="text-[#121210]">{zone.estimatedDays}</strong></div>
              <div>
                Standard Rate:{' '}
                <strong className="text-[#121210] font-mono">
                  {zone.currency === 'NGN' ? `₦${zone.rateAmount.toLocaleString()}` : `$${(zone.rateAmount / 100).toFixed(2)}`}
                </strong>
              </div>
              {zone.freeShippingThreshold && (
                <div className="text-emerald-700">
                  Free Shipping:{' '}
                  <span className="font-mono">
                    Orders over {zone.currency === 'NGN' ? `₦${zone.freeShippingThreshold.toLocaleString()}` : `$${(zone.freeShippingThreshold / 100).toFixed(2)}`}
                  </span>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-[#e7e4de] flex justify-end">
              <button
                onClick={() => setEditingZone({ ...zone })}
                className="text-xs px-3 py-1 border border-[#e7e4de] rounded hover:bg-[#f4f2ee] font-mono"
              >
                Configure Zone
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Zone Modal */}
      {editingZone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white max-w-md w-full p-6 border border-[#e7e4de] shadow-2xl space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-[#e7e4de] pb-3">
              <h3 className="font-serif text-base font-bold text-[#121210]">Configure Shipping Zone</h3>
              <button onClick={() => setEditingZone(null)} className="text-[#77746d] hover:text-[#121210]">✕</button>
            </div>

            <form onSubmit={saveZoneForm} className="space-y-3">
              <div>
                <label className="block text-[#77746d] mb-1 font-medium">Zone Title</label>
                <input
                  type="text"
                  required
                  value={editingZone.name}
                  onChange={(e) => setEditingZone({ ...editingZone, name: e.target.value })}
                  className="w-full border border-[#e7e4de] p-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#77746d] mb-1 font-medium">Logistics Carrier</label>
                  <input
                    type="text"
                    required
                    value={editingZone.carrier}
                    onChange={(e) => setEditingZone({ ...editingZone, carrier: e.target.value })}
                    className="w-full border border-[#e7e4de] p-2"
                  />
                </div>
                <div>
                  <label className="block text-[#77746d] mb-1 font-medium">Currency</label>
                  <select
                    value={editingZone.currency}
                    onChange={(e) => setEditingZone({ ...editingZone, currency: e.target.value as 'USD' | 'NGN' })}
                    className="w-full border border-[#e7e4de] p-2 bg-white"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="NGN">NGN (₦)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#77746d] mb-1 font-medium">Rate ({editingZone.currency})</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editingZone.currency === 'USD' ? editingZone.rateAmount / 100 : editingZone.rateAmount}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setEditingZone({
                        ...editingZone,
                        rateAmount: editingZone.currency === 'USD' ? Math.round(val * 100) : Math.round(val),
                      });
                    }}
                    className="w-full border border-[#e7e4de] p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[#77746d] mb-1 font-medium">Free Shipping Threshold</label>
                  <input
                    type="number"
                    min="0"
                    value={editingZone.freeShippingThreshold ? (editingZone.currency === 'USD' ? editingZone.freeShippingThreshold / 100 : editingZone.freeShippingThreshold) : ''}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setEditingZone({
                        ...editingZone,
                        freeShippingThreshold: isNaN(val) ? undefined : (editingZone.currency === 'USD' ? Math.round(val * 100) : Math.round(val)),
                      });
                    }}
                    placeholder="e.g. 50"
                    className="w-full border border-[#e7e4de] p-2 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#77746d] mb-1 font-medium">Estimated Transit Time</label>
                <input
                  type="text"
                  required
                  value={editingZone.estimatedDays}
                  onChange={(e) => setEditingZone({ ...editingZone, estimatedDays: e.target.value })}
                  placeholder="e.g. 2 - 4 business days"
                  className="w-full border border-[#e7e4de] p-2"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-[#e7e4de]">
                <button
                  type="button"
                  onClick={() => setEditingZone(null)}
                  className="px-4 py-2 border border-[#e7e4de]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#121210] text-[#f8f7f4] px-5 py-2 uppercase tracking-wider font-semibold hover:bg-[#c4a66b] hover:text-[#121210]"
                >
                  Save Zone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
