/**
 * VANTÉRA Payment Settings & Gateway Panel (CEO Suite)
 * Slogan: Technology, Elevated.
 *
 * Allows CEO Adnuel to configure Paystack public/secret keys,
 * toggle live card payments, and manage bank transfer preferences.
 */

import React, { useState, useEffect } from 'react';

interface PaymentSettings {
  paystackEnabled: boolean;
  paystackPublicKey: string;
  paystackSecretKey: string;
  paystackTestMode: boolean;
  bankTransferEnabled: boolean;
  activeCurrencies: ('NGN' | 'USD')[];
  updatedAt?: string;
}

interface PaymentSettingsPanelProps {
  token: string;
}

export const PaymentSettingsPanel: React.FC<PaymentSettingsPanelProps> = ({ token }) => {
  const [settings, setSettings] = useState<PaymentSettings>({
    paystackEnabled: true,
    paystackPublicKey: '',
    paystackSecretKey: '',
    paystackTestMode: true,
    bankTransferEnabled: true,
    activeCurrencies: ['NGN', 'USD'],
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  useEffect(() => {
    fetch('/api/admin/payment-settings', { headers })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.paymentSettings) {
          setSettings(data.paymentSettings);
        }
      })
      .catch((err) => {
        setErrorMessage('Failed to load payment settings');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [token]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    setErrorMessage('');

    try {
      const res = await fetch('/api/admin/payment-settings', {
        method: 'PUT',
        headers,
        body: JSON.stringify(settings),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save payment settings');
      }

      setSettings(data.paymentSettings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error updating payment settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-[#77746d]">
        <div className="w-6 h-6 border-2 border-[#121210] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
        <p className="text-xs uppercase font-mono tracking-wider">Loading payment configurations...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border border-[#e7e4de] bg-white p-6 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-[#e7e4de] pb-4">
          <div>
            <h3 className="font-serif text-lg font-bold text-[#121210]">Payment Gateways & Settings</h3>
            <p className="text-xs text-[#77746d] mt-1">
              Configure online card processing (Paystack) and direct bank transfers for VANTÉRA.
            </p>
          </div>
          <span className="text-[10px] uppercase font-mono bg-[#121210] text-[#c4a66b] px-2.5 py-1">
            CEO Master Control
          </span>
        </div>

        {saveSuccess && (
          <div className="border border-[#c3e6cb] bg-[#eef8ee] p-3 text-xs text-[#1e7e34] font-medium flex items-center justify-between">
            <span>✓ Payment settings updated and deployed across customer checkout.</span>
            <span className="text-[10px] font-mono">Live</span>
          </div>
        )}

        {errorMessage && (
          <div className="border border-[#f8b4b4] bg-[#fdf2f2] p-3 text-xs text-[#9b1c1c]">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* Section 1: Paystack Online Processing */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">💳</span>
                <h4 className="font-semibold text-xs uppercase tracking-wider text-[#121210]">
                  Paystack Online Card Payments
                </h4>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.paystackEnabled}
                  onChange={(e) => setSettings({ ...settings, paystackEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:width-5 after:transition-all peer-checked:bg-[#1e7e34]"></div>
                <span className="ml-2 text-xs font-mono">{settings.paystackEnabled ? 'ENABLED' : 'DISABLED'}</span>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-[11px] text-[#77746d] mb-1 font-medium">
                  Paystack Public Key (Client-side)
                </label>
                <input
                  type="text"
                  value={settings.paystackPublicKey}
                  onChange={(e) => setSettings({ ...settings, paystackPublicKey: e.target.value })}
                  placeholder="pk_live_... or pk_test_..."
                  className="w-full border border-[#e7e4de] px-3 py-2 text-xs font-mono focus:border-[#121210] focus:outline-hidden"
                />
                <span className="text-[9px] text-[#a9a69f] mt-1 block">
                  Used by customer checkout for card tokenization.
                </span>
              </div>

              <div>
                <label className="block text-[11px] text-[#77746d] mb-1 font-medium">
                  Paystack Secret Key (Server verification)
                </label>
                <input
                  type="password"
                  value={settings.paystackSecretKey}
                  onChange={(e) => setSettings({ ...settings, paystackSecretKey: e.target.value })}
                  placeholder="sk_live_... or sk_test_..."
                  className="w-full border border-[#e7e4de] px-3 py-2 text-xs font-mono focus:border-[#121210] focus:outline-hidden"
                />
                <span className="text-[9px] text-[#a9a69f] mt-1 block">
                  Secured server-side for real-time transaction verification.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                id="test-mode-toggle"
                type="checkbox"
                checked={settings.paystackTestMode}
                onChange={(e) => setSettings({ ...settings, paystackTestMode: e.target.checked })}
                className="w-4 h-4 border-[#e7e4de] rounded-xs"
              />
              <label htmlFor="test-mode-toggle" className="text-xs text-[#252521] cursor-pointer">
                <strong>Enable Sandbox / Test Mode</strong> (Allows instant test checkout without real debits)
              </label>
            </div>
          </div>

          {/* Section 2: Direct Bank Transfer */}
          <div className="pt-6 border-t border-[#e7e4de] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">🏦</span>
                <h4 className="font-semibold text-xs uppercase tracking-wider text-[#121210]">
                  Direct Bank Transfer (Manual Narration)
                </h4>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.bankTransferEnabled}
                  onChange={(e) => setSettings({ ...settings, bankTransferEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:width-5 after:transition-all peer-checked:bg-[#121210]"></div>
                <span className="ml-2 text-xs font-mono">{settings.bankTransferEnabled ? 'ENABLED' : 'DISABLED'}</span>
              </label>
            </div>

            <div className="bg-[#f8f7f4] p-4 border border-[#e7e4de] text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#1e7e34]">Nigerian Naira (₦) GTBank Account:</span>
                <span className="font-mono bg-white px-2 py-0.5 border border-[#e7e4de]">Active</span>
              </div>
              <p className="text-[11px] text-[#77746d]">
                Bank: <strong>Guaranty Trust Bank (GTBank)</strong> | Account Number: <strong className="font-mono text-sm text-[#121210]">1033269410</strong> | Name: <strong>ADARIKWU EMMANUEL UGBADA</strong>
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-[#e7e4de] flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="bg-[#121210] hover:bg-[#c4a66b] hover:text-[#121210] !text-white px-6 py-2.5 text-xs uppercase tracking-wider font-semibold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? 'Saving Configurations...' : 'Save Payment Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
