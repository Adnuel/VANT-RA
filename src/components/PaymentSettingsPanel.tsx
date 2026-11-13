/**
 * VANTÉRA Payment Settings & Gateway Panel (CEO Suite)
 * Slogan: Technology, Elevated.
 *
 * Allows CEO Adnuel to configure Wavy (wavy.ng) public/secret keys,
 * toggle live card payments, and manage bank transfer preferences.
 */

import React, { useState, useEffect } from 'react';
import { safeFetchJson } from '../lib/safeFetch.ts';

interface PaymentSettings {
  wavyEnabled?: boolean;
  wavyPublicKey?: string;
  wavySecretKey?: string;
  wavyTestMode?: boolean;
  paystackEnabled?: boolean;
  paystackPublicKey?: string;
  paystackSecretKey?: string;
  paystackTestMode?: boolean;
  bankTransferEnabled: boolean;
  activeCurrencies: ('NGN' | 'USD')[];
  updatedAt?: string;
}

interface PaymentSettingsPanelProps {
  token: string;
}

export const PaymentSettingsPanel: React.FC<PaymentSettingsPanelProps> = ({ token }) => {
  const [settings, setSettings] = useState<PaymentSettings>({
    wavyEnabled: true,
    wavyPublicKey: 'wavy_pk_live_64e762e61f597be9bfcc4228f2751672',
    wavySecretKey: 'wavy_sk_live_cc203228f83a6039c1001b9b24a8ff513346bc49a37db3cb',
    wavyTestMode: false,
    paystackEnabled: true,
    paystackPublicKey: 'wavy_pk_live_64e762e61f597be9bfcc4228f2751672',
    paystackSecretKey: 'wavy_sk_live_cc203228f83a6039c1001b9b24a8ff513346bc49a37db3cb',
    paystackTestMode: false,
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
    safeFetchJson<{ paymentSettings?: PaymentSettings }>('/api/admin/payment-settings', { headers })
      .then((res) => {
        if (res.ok && res.data?.paymentSettings) {
          setSettings((prev) => ({
            ...prev,
            ...res.data!.paymentSettings,
            wavyPublicKey: res.data!.paymentSettings?.wavyPublicKey || 'wavy_pk_live_64e762e61f597be9bfcc4228f2751672',
            wavySecretKey: res.data!.paymentSettings?.wavySecretKey || 'wavy_sk_live_cc203228f83a6039c1001b9b24a8ff513346bc49a37db3cb',
          }));
        }
      })
      .catch(() => {
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

    const payload = {
      ...settings,
      paystackPublicKey: settings.wavyPublicKey,
      paystackSecretKey: settings.wavySecretKey,
      paystackEnabled: settings.wavyEnabled,
      paystackTestMode: settings.wavyTestMode,
    };

    try {
      const res = await safeFetchJson<{ paymentSettings?: PaymentSettings; error?: string }>(
        '/api/admin/payment-settings',
        {
          method: 'PUT',
          headers,
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok || !res.data) {
        throw new Error(res.error || 'Failed to save payment settings');
      }

      if (res.data.paymentSettings) {
        setSettings(res.data.paymentSettings);
      }
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
      <div className="border border-[#e7e4de] bg-white p-6 shadow-xs">
        <div className="flex items-start justify-between border-b border-[#e7e4de] pb-4 mb-6">
          <div>
            <h3 className="font-serif text-lg font-bold text-[#121210] tracking-tight">
              Payment Gateway Architecture (Wavy.ng)
            </h3>
            <p className="text-xs text-[#77746d] mt-1">
              Configure online card processing (Wavy multi-currency gateway) and direct bank transfers for VANTÉRA.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#e8f5e9] text-[#1b5e20] text-[10px] font-mono uppercase tracking-wider font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2e7d32] animate-pulse"></span>
            Wavy Live Mode Active
          </span>
        </div>

        {saveSuccess && (
          <div className="border border-[#b7eb8f] bg-[#f6ffed] p-3 text-xs text-[#237804] flex items-center justify-between mb-4">
            <span>✓ Payment gateway configurations successfully deployed.</span>
            <span className="text-[10px] font-mono">Live</span>
          </div>
        )}

        {errorMessage && (
          <div className="border border-[#f8b4b4] bg-[#fdf2f2] p-3 text-xs text-[#9b1c1c] mb-4">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* Section 1: Wavy Online Processing */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">💳</span>
                <h4 className="font-semibold text-xs uppercase tracking-wider text-[#121210]">
                  Wavy Online Payments (Cards, Apple Pay & Bank)
                </h4>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.wavyEnabled ?? true}
                  onChange={(e) => setSettings({ ...settings, wavyEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:width-5 after:transition-all peer-checked:bg-[#1e7e34]"></div>
                <span className="ml-2 text-xs font-mono">{(settings.wavyEnabled ?? true) ? 'ENABLED' : 'DISABLED'}</span>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-[11px] text-[#77746d] mb-1 font-medium">
                  Wavy Public Key (Client-side)
                </label>
                <input
                  type="text"
                  value={settings.wavyPublicKey || ''}
                  onChange={(e) => setSettings({ ...settings, wavyPublicKey: e.target.value })}
                  placeholder="wavy_pk_live_..."
                  className="w-full border border-[#e7e4de] px-3 py-2 text-xs font-mono focus:border-[#121210] focus:outline-hidden"
                />
                <span className="text-[9px] text-[#a9a69f] mt-1 block">
                  Live Public Key used for secure tokenization & client sessions.
                </span>
              </div>

              <div>
                <label className="block text-[11px] text-[#77746d] mb-1 font-medium">
                  Wavy Secret Key (Server verification)
                </label>
                <input
                  type="password"
                  value={settings.wavySecretKey || ''}
                  onChange={(e) => setSettings({ ...settings, wavySecretKey: e.target.value })}
                  placeholder="wavy_sk_live_..."
                  className="w-full border border-[#e7e4de] px-3 py-2 text-xs font-mono focus:border-[#121210] focus:outline-hidden"
                />
                <span className="text-[9px] text-[#a9a69f] mt-1 block">
                  Secured server-side for real-time transaction verification via wavy.ng.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                id="wavy-test-mode-toggle"
                type="checkbox"
                checked={settings.wavyTestMode ?? false}
                onChange={(e) => setSettings({ ...settings, wavyTestMode: e.target.checked })}
                className="w-4 h-4 border-[#e7e4de] rounded-xs"
              />
              <label htmlFor="wavy-test-mode-toggle" className="text-xs text-[#252521] cursor-pointer">
                <strong>Enable Sandbox / Test Mode</strong> (Leave unchecked for live production sales)
              </label>
            </div>
          </div>

          {/* Section 2: Bank Transfers */}
          <div className="border-t border-[#e7e4de] pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">🏦</span>
                <h4 className="font-semibold text-xs uppercase tracking-wider text-[#121210]">
                  Direct Bank Wire Transfers
                </h4>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.bankTransferEnabled}
                  onChange={(e) => setSettings({ ...settings, bankTransferEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:width-5 after:transition-all peer-checked:bg-[#1e7e34]"></div>
                <span className="ml-2 text-xs font-mono">{settings.bankTransferEnabled ? 'ENABLED' : 'DISABLED'}</span>
              </label>
            </div>
            <p className="text-xs text-[#77746d]">
              Allows clients to send manual payments to Zenith Bank PLC accounts (NGN & USD Domiciliary) with payment proof upload.
            </p>
          </div>

          <div className="border-t border-[#e7e4de] pt-4 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="bg-[#121210] hover:bg-[#252521] text-white px-6 py-2.5 text-xs uppercase font-mono tracking-wider transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? 'Saving Configurations...' : 'Save Payment Configurations'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
