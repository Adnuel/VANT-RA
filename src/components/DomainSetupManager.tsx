import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface DomainSettings {
  domain: string;
  status: 'not_configured' | 'active' | 'dns_pending' | 'propagating';
  primaryRegistrar?: string;
  targetCname: string;
  sslStatus: 'active' | 'provisioning' | 'pending';
  lastChecked?: string;
  configuredAt?: string;
}

interface DnsCheckResult {
  domain: string;
  resolvedCnames: string[];
  resolvedA: string[];
  targetHost: string;
  isCnameMatched: boolean;
  isReachable: boolean;
  status: 'active' | 'propagating' | 'dns_pending';
  error?: string;
  timestamp: string;
}

const TARGET_HOST = 'ais-pre-mya5tkvgiwvj2cq7n3u4lg-518971387912.europe-west2.run.app';

export function DomainSetupManager() {
  const { adminToken } = useAuth();
  const [settings, setSettings] = useState<DomainSettings | null>(null);
  const [inputDomain, setInputDomain] = useState('');
  const [selectedRegistrar, setSelectedRegistrar] = useState('Cloudflare');
  const [isChecking, setIsChecking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [checkResult, setCheckResult] = useState<DnsCheckResult | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
  };

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/admin/domain-settings', { headers });
      if (res.ok) {
        const data = await res.json();
        setSettings(data.domainSettings);
        if (data.domainSettings?.domain) {
          setInputDomain(data.domainSettings.domain);
        }
      }
    } catch (e) {
      console.error('Failed to load domain settings:', e);
    }
  };

  useEffect(() => {
    loadSettings();
  }, [adminToken]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCheckDns = async (domainToCheck?: string) => {
    const domain = (domainToCheck || inputDomain).trim();
    if (!domain) {
      setNotification({ type: 'error', message: 'Please enter a domain name to test.' });
      return;
    }

    setIsChecking(true);
    setCheckResult(null);
    setNotification(null);

    try {
      const res = await fetch('/api/dev/check-domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
      });
      const data: DnsCheckResult = await res.json();
      setCheckResult(data);

      if (data.status === 'active') {
        setNotification({
          type: 'success',
          message: `Success! ${data.domain} is properly pointing to VANTÉRA Cloud Run!`,
        });
      } else if (data.status === 'propagating') {
        setNotification({
          type: 'success',
          message: `DNS records detected for ${data.domain}. DNS propagation in progress across global root servers.`,
        });
      } else {
        setNotification({
          type: 'error',
          message: `No active DNS records pointing to VANTÉRA found for ${data.domain}. Follow the DNS records guide below.`,
        });
      }
    } catch {
      setNotification({ type: 'error', message: 'Failed to execute DNS check. Verify network connectivity.' });
    } finally {
      setIsChecking(false);
    }
  };

  const handleSaveDomain = async () => {
    const domain = inputDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!domain) {
      setNotification({ type: 'error', message: 'Please enter a valid domain name.' });
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/domain-settings', {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          domain,
          primaryRegistrar: selectedRegistrar,
          targetCname: TARGET_HOST,
          status: checkResult?.status || 'dns_pending',
          sslStatus: checkResult?.status === 'active' ? 'active' : 'provisioning',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSettings(data.domainSettings);
        setNotification({
          type: 'success',
          message: `Canonical domain "${domain}" saved successfully in VANTÉRA configuration!`,
        });
      } else {
        const err = await res.json();
        setNotification({ type: 'error', message: err.error || 'Failed to update domain settings.' });
      }
    } catch {
      setNotification({ type: 'error', message: 'Network error saving domain settings.' });
    } finally {
      setIsSaving(false);
    }
  };

  const domainIdeas = [
    { name: 'vanterastore.com', type: 'Global Brand (.com)', estPrice: '$9.98/yr' },
    { name: 'vantera.store', type: 'E-Commerce TLD', estPrice: '$1.99/yr' },
    { name: 'vantera.shop', type: 'Retail TLD', estPrice: '$2.99/yr' },
    { name: 'vantera.tech', type: 'Tech Elevated', estPrice: '$3.99/yr' },
    { name: 'vantera.ng', type: 'Nigeria National (.ng)', estPrice: '₦15,000/yr' },
    { name: 'vanterastore.ng', type: 'Commercial Nigeria (.com.ng)', estPrice: '₦1,200/yr' },
  ];

  const registrars = [
    {
      name: 'Cloudflare Registrar',
      badge: 'Recommended for Cloud Run',
      desc: 'Zero markup at-cost pricing, free SSL/TLS, and 1-click CNAME flattening for root domains.',
      link: 'https://www.cloudflare.com/products/registrar/',
    },
    {
      name: 'Namecheap',
      badge: 'Best Value Deals',
      desc: 'Top choice for .store ($1.99) and .com with free lifetime WHOIS privacy and simple DNS manager.',
      link: 'https://www.namecheap.com/',
    },
    {
      name: 'Whogohost / QServers',
      badge: 'Best for Nigeria (.ng)',
      desc: 'Top accredited NiRA registrars. Pay easily in Naira (NGN) via GTBank debit card or bank transfer.',
      link: 'https://www.whogohost.ng/',
    },
    {
      name: 'Porkbun',
      badge: 'Fast & Clean',
      desc: 'Honest renewal rates, free SSL certs, clean DNS dashboard without upselling.',
      link: 'https://porkbun.com/',
    },
  ];

  return (
    <div className="space-y-8 font-sans">
      {/* Overview Header */}
      <div className="border border-[#27272a] bg-[#121215] p-6 lg:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#c4a66b] border border-[#c4a66b]/30 px-2 py-0.5">
                VANTÉRA Web Infrastructure
              </span>
              <span className="text-xs text-[#a1a1aa] font-mono">Cloud Run Deployment Target</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#f4f4f5]">
              Custom Domain & DNS Setup Guide
            </h2>
            <p className="text-xs sm:text-sm text-[#a1a1aa] max-w-2xl leading-relaxed">
              Connect your own custom web domain (e.g. <span className="text-[#f4f4f5] font-mono">vanterastore.com</span> or{' '}
              <span className="text-[#f4f4f5] font-mono">vantera.ng</span>) to your live VANTÉRA luxury e-commerce engine.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="border border-[#3f3f46] bg-[#18181b] p-3 text-left">
              <span className="block text-[10px] font-mono uppercase tracking-wider text-[#71717a]">
                Active Cloud Run Host
              </span>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-mono text-xs text-[#38bdf8] truncate max-w-[220px] sm:max-w-[280px]">
                  {TARGET_HOST}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(TARGET_HOST, 'target-host')}
                  className="px-2 py-0.5 text-[10px] font-mono border border-[#52525b] hover:bg-[#27272a] text-[#e4e4e7] transition-colors"
                >
                  {copiedKey === 'target-host' ? 'COPIED' : 'COPY'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Current Configured Domain Banner */}
        {settings?.domain && (
          <div className="mt-6 pt-6 border-t border-[#27272a] flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  settings.status === 'active'
                    ? 'bg-[#22c55e] shadow-[0_0_8px_#22c55e]'
                    : settings.status === 'propagating'
                    ? 'bg-[#eab308] shadow-[0_0_8px_#eab308]'
                    : 'bg-[#94a3b8]'
                }`}
              />
              <div>
                <span className="text-xs text-[#71717a] uppercase font-mono tracking-wider block">
                  Configured Store Domain
                </span>
                <span className="text-base font-bold text-[#fafafa] font-mono tracking-wide">
                  https://{settings.domain}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <a
                href={`https://${settings.domain}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-mono px-3 py-1.5 border border-[#3f3f46] hover:border-[#c4a66b] text-[#c4a66b] hover:text-[#f4f4f5] transition-colors flex items-center gap-1.5"
              >
                <span>Visit Domain</span>
                <span>↗</span>
              </a>
              <button
                type="button"
                onClick={() => handleCheckDns(settings.domain)}
                disabled={isChecking}
                className="text-xs font-mono px-3 py-1.5 bg-[#27272a] hover:bg-[#3f3f46] text-[#fafafa] transition-colors"
              >
                {isChecking ? 'Verifying...' : 'Re-verify DNS'}
              </button>
            </div>
          </div>
        )}
      </div>

      {notification && (
        <div
          className={`p-4 border text-xs sm:text-sm font-mono flex items-center justify-between gap-3 ${
            notification.type === 'success'
              ? 'bg-[#052e16]/60 border-[#15803d] text-[#86efac]'
              : 'bg-[#450a0a]/60 border-[#b91c1c] text-[#fca5a5]'
          }`}
        >
          <span>{notification.message}</span>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-xs uppercase font-mono px-2 py-0.5 border border-current opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 3 Step Practical Walkthrough */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Step 1 */}
        <div className="border border-[#27272a] bg-[#121215] p-6 flex flex-col justify-between">
          <div className="space-y-3">
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#71717a]">Step 01</span>
            <h3 className="text-base font-bold text-[#f4f4f5]">Choose & Buy Your Domain</h3>
            <p className="text-xs text-[#a1a1aa] leading-relaxed">
              Pick a domain name for your luxury store. You can buy directly from any registrar in under 3 minutes.
            </p>

            <div className="pt-2 space-y-1.5">
              <span className="text-[11px] font-semibold text-[#d4d4d8] block">Popular Registrars:</span>
              <ul className="text-xs space-y-1 text-[#a1a1aa]">
                <li>
                  • <strong className="text-[#f4f4f5]">Namecheap / Porkbun</strong>: Best for global <code className="text-[#c4a66b]">.com</code>, <code className="text-[#c4a66b]">.store</code>
                </li>
                <li>
                  • <strong className="text-[#f4f4f5]">Whogohost / QServers</strong>: Best for Nigerian <code className="text-[#c4a66b]">.ng</code>, <code className="text-[#c4a66b]">.com.ng</code>
                </li>
                <li>
                  • <strong className="text-[#f4f4f5]">Cloudflare</strong>: Best wholesale pricing & built-in SSL
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6 border-t border-[#27272a] mt-6">
            <a
              href="https://www.namecheap.com/"
              target="_blank"
              rel="noreferrer"
              className="w-full text-center block text-xs font-semibold uppercase tracking-wider py-2 bg-[#27272a] hover:bg-[#3f3f46] text-[#fafafa] transition-colors"
            >
              Search Names on Namecheap ↗
            </a>
          </div>
        </div>

        {/* Step 2 */}
        <div className="border border-[#27272a] bg-[#121215] p-6 flex flex-col justify-between">
          <div className="space-y-3">
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#71717a]">Step 02</span>
            <h3 className="text-base font-bold text-[#f4f4f5]">Configure DNS Records</h3>
            <p className="text-xs text-[#a1a1aa] leading-relaxed">
              In your domain registrar's DNS Management panel, add a single CNAME record pointing to VANTÉRA.
            </p>

            <div className="bg-[#18181b] p-3 border border-[#27272a] font-mono text-[11px] space-y-1.5 text-[#e4e4e7]">
              <div>
                <span className="text-[#71717a]">Type: </span>
                <span className="text-[#38bdf8] font-bold">CNAME</span>
              </div>
              <div>
                <span className="text-[#71717a]">Host / Name: </span>
                <span className="text-[#f4f4f5] font-bold">www</span> (or @)
              </div>
              <div className="break-all">
                <span className="text-[#71717a]">Target: </span>
                <span className="text-[#c4a66b] font-bold">{TARGET_HOST}</span>
              </div>
              <div>
                <span className="text-[#71717a]">TTL: </span>
                <span>Auto / 300</span>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-[#27272a] mt-6">
            <button
              type="button"
              onClick={() => copyToClipboard(TARGET_HOST, 'step2-host')}
              className="w-full text-center text-xs font-semibold uppercase tracking-wider py-2 border border-[#3f3f46] hover:border-[#c4a66b] text-[#c4a66b] transition-colors"
            >
              {copiedKey === 'step2-host' ? 'Target Host Copied!' : 'Copy Target Host'}
            </button>
          </div>
        </div>

        {/* Step 3 */}
        <div className="border border-[#27272a] bg-[#121215] p-6 flex flex-col justify-between">
          <div className="space-y-3">
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#71717a]">Step 03</span>
            <h3 className="text-base font-bold text-[#f4f4f5]">Verify & Activate</h3>
            <p className="text-xs text-[#a1a1aa] leading-relaxed">
              Type your registered domain below to run our real-time DNS resolver. Once verified, activate it as the store's primary canonical domain.
            </p>

            <div className="pt-2 space-y-1 text-xs text-[#a1a1aa]">
              <p>• DNS propagation usually takes 5 to 30 minutes.</p>
              <p>• SSL / HTTPS certificates are automatically generated by Google Cloud Run / Cloudflare.</p>
            </div>
          </div>

          <div className="pt-6 border-t border-[#27272a] mt-6">
            <a
              href="#dns-checker"
              className="w-full text-center block text-xs font-semibold uppercase tracking-wider py-2 bg-[#c4a66b] hover:bg-[#d6ba82] text-[#121210] transition-colors font-bold"
            >
              Jump to Live DNS Checker ↓
            </a>
          </div>
        </div>
      </div>

      {/* Suggested Brand Domains for VANTÉRA */}
      <div className="border border-[#27272a] bg-[#121215] p-6 lg:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-[#f4f4f5]">Curated Domain Recommendations</h3>
            <p className="text-xs text-[#a1a1aa]">
              Hand-picked domain options tailored for the VANTÉRA luxury tech brand identity.
            </p>
          </div>
          <span className="text-[11px] font-mono text-[#71717a]">Click any suggestion to prefill</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {domainIdeas.map((item) => (
            <button
              key={item.name}
              type="button"
              onClick={() => {
                setInputDomain(item.name);
                setCheckResult(null);
              }}
              className={`p-3 border text-left transition-all ${
                inputDomain === item.name
                  ? 'border-[#c4a66b] bg-[#18181b] shadow-sm'
                  : 'border-[#27272a] bg-[#09090b]/60 hover:border-[#3f3f46] hover:bg-[#18181b]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-bold text-[#fafafa]">{item.name}</span>
                <span className="text-[10px] font-mono text-[#c4a66b] font-bold">{item.estPrice}</span>
              </div>
              <span className="text-[11px] text-[#71717a] mt-1 block">{item.type}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Live Interactive DNS Checker & Save Hub */}
      <div id="dns-checker" className="border border-[#27272a] bg-[#121215] p-6 lg:p-8 space-y-6">
        <div className="space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#c4a66b]">Live Operations Tool</span>
          <h3 className="text-lg font-bold text-[#f4f4f5]">Domain DNS Resolver & Connection Tester</h3>
          <p className="text-xs text-[#a1a1aa]">
            Enter your purchased domain to query live DNS records, verify CNAME target, and check HTTPS reachability.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-[#71717a]">https://</span>
            <input
              type="text"
              value={inputDomain}
              onChange={(e) => setInputDomain(e.target.value)}
              placeholder="e.g. vanterastore.com or vantera.ng"
              className="w-full bg-[#18181b] border border-[#3f3f46] pl-20 pr-4 py-2.5 text-sm font-mono text-[#f4f4f5] focus:outline-none focus:border-[#c4a66b] transition-colors"
            />
          </div>

          <select
            value={selectedRegistrar}
            onChange={(e) => setSelectedRegistrar(e.target.value)}
            className="bg-[#18181b] border border-[#3f3f46] px-4 py-2.5 text-xs font-mono text-[#f4f4f5] focus:outline-none focus:border-[#c4a66b]"
          >
            <option value="Cloudflare">Registrar: Cloudflare</option>
            <option value="Namecheap">Registrar: Namecheap</option>
            <option value="Whogohost">Registrar: Whogohost (Nigeria)</option>
            <option value="QServers">Registrar: QServers (Nigeria)</option>
            <option value="GoDaddy">Registrar: GoDaddy</option>
            <option value="Porkbun">Registrar: Porkbun</option>
            <option value="Other">Registrar: Other</option>
          </select>

          <button
            type="button"
            onClick={() => handleCheckDns()}
            disabled={isChecking || !inputDomain}
            className="px-5 py-2.5 bg-[#27272a] hover:bg-[#3f3f46] text-[#fafafa] font-semibold text-xs uppercase tracking-wider font-mono transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isChecking ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-[#fafafa]/20 border-t-[#fafafa] rounded-full animate-spin" />
                <span>Querying DNS...</span>
              </>
            ) : (
              <span>Test DNS Now</span>
            )}
          </button>

          <button
            type="button"
            onClick={handleSaveDomain}
            disabled={isSaving || !inputDomain}
            className="px-5 py-2.5 bg-[#c4a66b] hover:bg-[#d6ba82] text-[#121210] font-bold text-xs uppercase tracking-wider font-mono transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? 'Saving...' : 'Set Active Domain'}
          </button>
        </div>

        {/* Live DNS Diagnostic Output */}
        {checkResult && (
          <div className="border border-[#27272a] bg-[#09090b] p-5 space-y-4 font-mono text-xs animate-in fade-in duration-200">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#27272a] pb-3">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    checkResult.status === 'active'
                      ? 'bg-[#22c55e]'
                      : checkResult.status === 'propagating'
                      ? 'bg-[#eab308]'
                      : 'bg-[#ef4444]'
                  }`}
                />
                <span className="text-[#fafafa] font-bold text-sm">
                  Diagnostics for {checkResult.domain}
                </span>
              </div>
              <span className="text-[10px] text-[#71717a]">
                Checked: {new Date(checkResult.timestamp).toLocaleTimeString()}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <span className="text-[11px] text-[#71717a] uppercase tracking-wider block">
                  CNAME Records Detected
                </span>
                {checkResult.resolvedCnames.length > 0 ? (
                  <div className="space-y-1">
                    {checkResult.resolvedCnames.map((c, i) => (
                      <div key={i} className="text-[#38bdf8] bg-[#18181b] p-2 border border-[#27272a] break-all">
                        {c}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[#a1a1aa] bg-[#18181b] p-2 border border-[#27272a]">
                    No direct CNAME resolved (Check 'www' prefix or root record).
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <span className="text-[11px] text-[#71717a] uppercase tracking-wider block">
                  IPv4 (A) Records Resolved
                </span>
                {checkResult.resolvedA.length > 0 ? (
                  <div className="space-y-1">
                    {checkResult.resolvedA.map((ip, i) => (
                      <div key={i} className="text-[#22c55e] bg-[#18181b] p-2 border border-[#27272a]">
                        {ip}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[#a1a1aa] bg-[#18181b] p-2 border border-[#27272a]">
                    No IPv4 A records found yet.
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-[#27272a] flex flex-wrap items-center justify-between gap-3 text-[11px]">
              <div>
                <span className="text-[#71717a]">Target Match: </span>
                <span className={checkResult.isCnameMatched ? 'text-[#22c55e] font-bold' : 'text-[#eab308]'}>
                  {checkResult.isCnameMatched ? 'MATCHED (Pointing to Cloud Run)' : 'PENDING DNS UPDATE'}
                </span>
              </div>
              <div>
                <span className="text-[#71717a]">HTTPS Handshake: </span>
                <span className={checkResult.isReachable ? 'text-[#22c55e] font-bold' : 'text-[#a1a1aa]'}>
                  {checkResult.isReachable ? 'SECURE HANDSHAKE SUCCESSFUL' : 'Awaiting DNS / SSL provisioning'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Registrar Directory Cards */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-[#f4f4f5]">Trusted Registrars & Platforms</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {registrars.map((reg) => (
            <div key={reg.name} className="border border-[#27272a] bg-[#121215] p-5 space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-[#fafafa]">{reg.name}</h4>
                  <span className="text-[10px] font-mono px-2 py-0.5 border border-[#3f3f46] text-[#c4a66b]">
                    {reg.badge}
                  </span>
                </div>
                <p className="text-xs text-[#a1a1aa] mt-2 leading-relaxed">{reg.desc}</p>
              </div>
              <div className="pt-3 border-t border-[#27272a]">
                <a
                  href={reg.link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-mono text-[#fafafa] hover:text-[#c4a66b] transition-colors"
                >
                  <span>Visit {reg.name}</span>
                  <span>↗</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
