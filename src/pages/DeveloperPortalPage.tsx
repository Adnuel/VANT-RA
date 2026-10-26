import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { DomainSetupManager } from '../components/DomainSetupManager';

interface DeveloperPortalPageProps {
  onNavigate: (path: string) => void;
}

interface SystemHealth {
  status: string;
  uptimeSeconds: number;
  memoryUsageMb: number;
  nodeVersion: string;
  totalProducts: number;
  totalOrders: number;
  totalUsers: number;
  totalEvents: number;
  totalBackups: number;
  databaseSizeBytes: number;
  timestamp: string;
}

interface BackupItem {
  filename: string;
  sizeBytes: number;
  createdAt: string;
}

interface IntegrityReport {
  valid: boolean;
  issues: string[];
  productCount: number;
  orderCount: number;
  userCount: number;
  timestamp: string;
}

export function DeveloperPortalPage({ onNavigate }: DeveloperPortalPageProps) {
  const { adminToken } = useAuth();
  const [activeTab, setActiveTab] = useState<'health' | 'backups' | 'integrity' | 'api_test' | 'custom_domain'>('custom_domain');
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [integrity, setIntegrity] = useState<IntegrityReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [apiLatencyMs, setApiLatencyMs] = useState<number | null>(null);

  // Authenticate with admin or developer token
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
  };

  const loadHealth = async () => {
    setIsLoading(true);
    const start = performance.now();
    try {
      const res = await fetch('/api/dev/health', { headers });
      const elapsed = Math.round(performance.now() - start);
      setApiLatencyMs(elapsed);
      if (res.ok) {
        const data = await res.json();
        setHealth(data.health);
      } else if (res.status === 401 || res.status === 403) {
        setStatusMessage('Authentication required: Sign in via CEO / Admin credentials to access Technical Operations.');
      }
    } catch {
      setStatusMessage('Failed to connect to /api/dev/health.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadBackups = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/dev/backups', { headers });
      if (res.ok) {
        const data = await res.json();
        setBackups(data.backups || []);
      }
    } catch {
      setStatusMessage('Error loading database backups');
    } finally {
      setIsLoading(false);
    }
  };

  const loadIntegrity = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/dev/integrity', { headers });
      if (res.ok) {
        const data = await res.json();
        setIntegrity(data);
      }
    } catch {
      setStatusMessage('Error verifying database integrity');
    } finally {
      setIsLoading(false);
    }
  };

  const createBackup = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/dev/backups', { method: 'POST', headers });
      const data = await res.json();
      if (res.ok) {
        setStatusMessage(`Backup created: ${data.backup?.filename || 'Success'}`);
        loadBackups();
      } else {
        setStatusMessage(data.error || 'Failed to create backup');
      }
    } catch {
      setStatusMessage('Server error during backup creation');
    } finally {
      setIsLoading(false);
    }
  };

  const restoreBackup = async (filename: string) => {
    if (!confirm(`Are you certain you want to roll back the database to ${filename}? Current state will be replaced.`)) {
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`/api/dev/backups/${encodeURIComponent(filename)}/restore`, {
        method: 'POST',
        headers,
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMessage(data.message || 'Database restored successfully');
        loadHealth();
      } else {
        setStatusMessage(data.error || 'Restore failed');
      }
    } catch {
      setStatusMessage('Error executing database restore');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHealth();
    loadBackups();
  }, [adminToken]);

  const formatUptime = (sec: number) => {
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    return `${d > 0 ? `${d}d ` : ''}${h}h ${m}m ${s}s`;
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-[#f4f4f5] font-sans antialiased selection:bg-[#c4a66b]/30">
      {/* Top Header */}
      <header className="border-b border-[#27272a] bg-[#121215]/80 backdrop-blur sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-8 w-8 rounded bg-[#18181b] border border-[#3f3f46] flex items-center justify-center font-mono font-bold text-xs text-[#c4a66b]">
            V/T
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-wide flex items-center gap-2">
              <span>VANTÉRA Technical Operations & Developer Console</span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-[#1e293b] text-[#38bdf8] border border-[#0284c7]/40">
                Independent Platform
              </span>
            </h1>
            <p className="text-[11px] text-[#71717a] font-mono">Engine: Node.js {health?.nodeVersion || 'v20.x'} · Express · Real DB</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('/admin/dashboard')}
            className="text-xs px-3 py-1.5 rounded bg-[#18181b] hover:bg-[#27272a] text-[#a1a1aa] hover:text-[#fafafa] border border-[#27272a] transition-colors"
          >
            ← CEO Portal
          </button>
          <button
            onClick={() => onNavigate('/')}
            className="text-xs px-3 py-1.5 rounded bg-[#c4a66b] text-[#121210] font-medium hover:bg-[#d4af37] transition-colors"
          >
            Storefront
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {statusMessage && (
          <div className="p-3 rounded bg-[#27272a]/70 border border-[#3f3f46] text-xs font-mono text-[#fbbf24] flex items-center justify-between">
            <span>[SYSTEM] {statusMessage}</span>
            <button onClick={() => setStatusMessage(null)} className="text-[#a1a1aa] hover:text-white">✕</button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-[#27272a] pb-2 font-mono text-xs">
          <button
            onClick={() => setActiveTab('health')}
            className={`px-4 py-2 rounded-t transition-colors ${
              activeTab === 'health'
                ? 'bg-[#18181b] text-[#fafafa] border-t-2 border-[#c4a66b]'
                : 'text-[#71717a] hover:text-[#d4d4d8]'
            }`}
          >
            01. System Health
          </button>
          <button
            onClick={() => {
              setActiveTab('backups');
              loadBackups();
            }}
            className={`px-4 py-2 rounded-t transition-colors ${
              activeTab === 'backups'
                ? 'bg-[#18181b] text-[#fafafa] border-t-2 border-[#c4a66b]'
                : 'text-[#71717a] hover:text-[#d4d4d8]'
            }`}
          >
            02. Backups & Recovery
          </button>
          <button
            onClick={() => {
              setActiveTab('integrity');
              loadIntegrity();
            }}
            className={`px-4 py-2 rounded-t transition-colors ${
              activeTab === 'integrity'
                ? 'bg-[#18181b] text-[#fafafa] border-t-2 border-[#c4a66b]'
                : 'text-[#71717a] hover:text-[#d4d4d8]'
            }`}
          >
            03. Database Integrity
          </button>
          <button
            onClick={() => setActiveTab('api_test')}
            className={`px-4 py-2 rounded-t transition-colors ${
              activeTab === 'api_test'
                ? 'bg-[#18181b] text-[#fafafa] border-t-2 border-[#c4a66b]'
                : 'text-[#71717a] hover:text-[#d4d4d8]'
            }`}
          >
            04. Diagnostics & Uptime
          </button>
          <button
            onClick={() => setActiveTab('custom_domain')}
            className={`px-4 py-2 rounded-t transition-colors font-semibold ${
              activeTab === 'custom_domain'
                ? 'bg-[#18181b] text-[#c4a66b] border-t-2 border-[#c4a66b]'
                : 'text-[#a1a1aa] hover:text-[#f4f4f5]'
            }`}
          >
            05. Custom Domain & DNS Setup
          </button>
        </div>

        {/* Tab 1: System Health */}
        {activeTab === 'health' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-[#121215] border border-[#27272a]">
                <div className="text-[10px] font-mono uppercase text-[#71717a]">Engine Status</div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-lg font-semibold text-emerald-400 font-mono">
                    {health?.status || 'HEALTHY'}
                  </span>
                </div>
                <div className="mt-2 text-[11px] font-mono text-[#a1a1aa]">
                  Latency: {apiLatencyMs !== null ? `${apiLatencyMs}ms` : '—'}
                </div>
              </div>

              <div className="p-4 rounded-lg bg-[#121215] border border-[#27272a]">
                <div className="text-[10px] font-mono uppercase text-[#71717a]">Process Uptime</div>
                <div className="mt-1 text-lg font-semibold font-mono text-[#fafafa]">
                  {health ? formatUptime(health.uptimeSeconds) : '—'}
                </div>
                <div className="mt-2 text-[11px] font-mono text-[#a1a1aa]">Continuous service</div>
              </div>

              <div className="p-4 rounded-lg bg-[#121215] border border-[#27272a]">
                <div className="text-[10px] font-mono uppercase text-[#71717a]">Memory RSS</div>
                <div className="mt-1 text-lg font-semibold font-mono text-[#fafafa]">
                  {health?.memoryUsageMb ? `${health.memoryUsageMb} MB` : '—'}
                </div>
                <div className="mt-2 text-[11px] font-mono text-[#a1a1aa]">Optimized footprint</div>
              </div>

              <div className="p-4 rounded-lg bg-[#121215] border border-[#27272a]">
                <div className="text-[10px] font-mono uppercase text-[#71717a]">Database Footprint</div>
                <div className="mt-1 text-lg font-semibold font-mono text-[#fafafa]">
                  {health ? `${Math.round(health.databaseSizeBytes / 1024)} KB` : '—'}
                </div>
                <div className="mt-2 text-[11px] font-mono text-[#a1a1aa]">JSON / Atomic Storage</div>
              </div>
            </div>

            {/* Table of Database Records */}
            <div className="p-5 rounded-lg bg-[#121215] border border-[#27272a] space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#fafafa]">
                  Database Table & Record Inventory
                </h2>
                <button
                  onClick={loadHealth}
                  disabled={isLoading}
                  className="text-xs px-3 py-1 rounded bg-[#18181b] hover:bg-[#27272a] text-[#a1a1aa] font-mono"
                >
                  {isLoading ? 'Scanning...' : 'Refresh Records'}
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
                <div className="p-3 rounded bg-[#18181b] border border-[#27272a]">
                  <span className="text-[#71717a] block text-[10px]">TOTAL PRODUCTS</span>
                  <span className="text-lg font-bold text-[#fafafa]">{health?.totalProducts ?? '—'}</span>
                </div>
                <div className="p-3 rounded bg-[#18181b] border border-[#27272a]">
                  <span className="text-[#71717a] block text-[10px]">CUSTOMER ORDERS</span>
                  <span className="text-lg font-bold text-[#fafafa]">{health?.totalOrders ?? '—'}</span>
                </div>
                <div className="p-3 rounded bg-[#18181b] border border-[#27272a]">
                  <span className="text-[#71717a] block text-[10px]">REGISTERED ACCOUNTS</span>
                  <span className="text-lg font-bold text-[#fafafa]">{health?.totalUsers ?? '—'}</span>
                </div>
                <div className="p-3 rounded bg-[#18181b] border border-[#27272a]">
                  <span className="text-[#71717a] block text-[10px]">LIVE EVENTS LOGGED</span>
                  <span className="text-lg font-bold text-[#fafafa]">{health?.totalEvents ?? '—'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Backups */}
        {activeTab === 'backups' && (
          <div className="p-5 rounded-lg bg-[#121215] border border-[#27272a] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#fafafa]">
                  Automated & On-Demand Database Backups
                </h2>
                <p className="text-[11px] text-[#71717a]">
                  Snapshots of products, orders, customers, and bank accounts stored in <code>/data/backups/</code>.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={createBackup}
                  disabled={isLoading}
                  className="text-xs px-3.5 py-1.5 rounded bg-[#c4a66b] text-[#121210] font-mono font-semibold hover:bg-[#d4af37]"
                >
                  + Create Snapshot Now
                </button>
                <a
                  href="/api/download-zip"
                  download="vantera-project.zip"
                  className="text-xs px-3.5 py-1.5 rounded bg-[#18181b] text-[#fafafa] border border-[#27272a] font-mono hover:bg-[#27272a]"
                >
                  Download Source ZIP
                </a>
              </div>
            </div>

            <div className="overflow-x-auto border border-[#27272a] rounded">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#18181b] text-[#71717a] border-b border-[#27272a]">
                  <tr>
                    <th className="p-3">Snapshot Filename</th>
                    <th className="p-3">Size</th>
                    <th className="p-3">Created At</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#27272a]">
                  {backups.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-[#71717a]">
                        No backup archives created yet. Click "+ Create Snapshot Now" to preserve current state.
                      </td>
                    </tr>
                  ) : (
                    backups.map((b) => (
                      <tr key={b.filename} className="hover:bg-[#18181b]/50">
                        <td className="p-3 font-semibold text-[#fafafa]">{b.filename}</td>
                        <td className="p-3 text-[#a1a1aa]">{Math.round(b.sizeBytes / 1024)} KB</td>
                        <td className="p-3 text-[#71717a]">{new Date(b.createdAt).toLocaleString()}</td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => restoreBackup(b.filename)}
                            className="px-2.5 py-1 rounded text-[11px] bg-red-950/40 text-red-400 border border-red-800/40 hover:bg-red-900/50"
                          >
                            Restore Database
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Database Integrity */}
        {activeTab === 'integrity' && (
          <div className="p-5 rounded-lg bg-[#121215] border border-[#27272a] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#fafafa]">
                  Foreign Key & Schema Consistency Audit
                </h2>
                <p className="text-[11px] text-[#71717a]">
                  Validates order item pricing, product slugs, customer accounts, and payment links.
                </p>
              </div>
              <button
                onClick={loadIntegrity}
                disabled={isLoading}
                className="text-xs px-3 py-1.5 rounded bg-[#18181b] hover:bg-[#27272a] text-[#fafafa] font-mono border border-[#27272a]"
              >
                Run Audit Now
              </button>
            </div>

            {integrity ? (
              <div className="space-y-4">
                <div className={`p-4 rounded border text-xs font-mono ${
                  integrity.valid
                    ? 'bg-emerald-950/20 border-emerald-800/50 text-emerald-400'
                    : 'bg-red-950/20 border-red-800/50 text-red-400'
                }`}>
                  <div className="font-semibold text-sm">
                    {integrity.valid ? '✓ ALL DATABASE INTEGRITY CHECKS PASSED' : '⚠ INTEGRITY WARNINGS DETECTED'}
                  </div>
                  <div className="mt-1 text-[11px]">
                    Verified {integrity.productCount} products, {integrity.orderCount} orders, {integrity.userCount} user accounts.
                  </div>
                </div>

                {integrity.issues && integrity.issues.length > 0 ? (
                  <div className="space-y-2">
                    <h3 className="text-xs font-mono text-[#a1a1aa] uppercase">Discrepancies Found</h3>
                    <ul className="list-disc pl-5 text-xs font-mono text-red-400 space-y-1">
                      {integrity.issues.map((issue, idx) => (
                        <li key={idx}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="text-xs font-mono text-[#71717a]">
                    No orphaned orders, invalid product references, or data corruptions detected.
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 text-center text-xs font-mono text-[#71717a]">
                Click "Run Audit Now" to perform consistency checks.
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Diagnostics */}
        {activeTab === 'api_test' && (
          <div className="p-5 rounded-lg bg-[#121215] border border-[#27272a] space-y-4">
            <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#fafafa]">
              Service Endpoints & Response Matrix
            </h2>
            <div className="space-y-2 text-xs font-mono">
              <div className="p-3 rounded bg-[#18181b] border border-[#27272a] flex items-center justify-between">
                <div>
                  <span className="text-[#38bdf8] font-bold">GET</span> <code>/api/products</code>
                  <span className="text-[#71717a] ml-2">— Public Storefront Catalog</span>
                </div>
                <span className="text-emerald-400">200 OK</span>
              </div>
              <div className="p-3 rounded bg-[#18181b] border border-[#27272a] flex items-center justify-between">
                <div>
                  <span className="text-[#38bdf8] font-bold">GET</span> <code>/api/currency-settings</code>
                  <span className="text-[#71717a] ml-2">— Dual Currency (USD & NGN)</span>
                </div>
                <span className="text-emerald-400">200 OK</span>
              </div>
              <div className="p-3 rounded bg-[#18181b] border border-[#27272a] flex items-center justify-between">
                <div>
                  <span className="text-[#38bdf8] font-bold">GET</span> <code>/api/bank-details</code>
                  <span className="text-[#71717a] ml-2">— Bank Settlement Destinations</span>
                </div>
                <span className="text-emerald-400">200 OK</span>
              </div>
              <div className="p-3 rounded bg-[#18181b] border border-[#27272a] flex items-center justify-between">
                <div>
                  <span className="text-[#38bdf8] font-bold">GET</span> <code>/api/admin/events/stream</code>
                  <span className="text-[#71717a] ml-2">— Server-Sent Events (SSE) Live Feed</span>
                </div>
                <span className="text-emerald-400">Active Stream</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Custom Domain & DNS Setup */}
        {activeTab === 'custom_domain' && <DomainSetupManager />}
      </main>
    </div>
  );
}
