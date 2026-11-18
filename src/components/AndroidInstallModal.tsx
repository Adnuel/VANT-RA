import React, { useState } from 'react';
import { Check, Download, Package, Smartphone, Sparkles, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';
import { downloadAndroidProjectZip } from '../lib/downloadZip.ts';

interface AndroidInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AndroidInstallModal: React.FC<AndroidInstallModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [activeTab, setActiveTab] = useState<'pwa' | 'apk'>('pwa');
  const [installSuccess, setInstallSuccess] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (accepted) {
        setInstallSuccess(true);
      }
    }
  };

  const handleDownloadZip = async () => {
    setIsDownloading(true);
    setDownloadError(null);
    try {
      const res = await downloadAndroidProjectZip();
      if (!res.success) {
        setDownloadError(res.message || 'Download failed');
      }
    } catch (err: any) {
      setDownloadError(err?.message || 'Download failed');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="android-modal-title"
      className="vantera-overlay-fade fixed inset-0 z-50 flex items-center justify-center bg-[#111111]/65 backdrop-blur-xs p-4"
    >
      <div className="bg-[#FAF7F2] w-full max-w-lg border border-[#111111]/15 rounded-xs overflow-hidden text-left font-meta text-[#111111]">
        {/* Header */}
        <div className="bg-[#111111] text-[#F7F3EC] px-5 sm:px-6 py-4 sm:py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#F7F3EC] text-[#111111] flex items-center justify-center font-editorial text-lg font-medium rounded-xs shrink-0">
              V
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span id="android-modal-title" className="font-semibold text-xs sm:text-sm tracking-wider uppercase">
                  VANTÉRA Android App
                </span>
                <span className="bg-[#B89B5E] text-[#111111] text-[9px] font-semibold px-1.5 py-0.5 rounded-xs tabular-nums">
                  v1.0.0
                </span>
              </div>
              <p className="text-[11px] text-[#F7F3EC]/70">Official Mobile Experience · Technology, Elevated.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#F7F3EC]/70 hover:text-white p-1.5 rounded-xs transition-colors cursor-pointer shrink-0"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-[#111111]/10 bg-[#F7F3EC]">
          <button
            type="button"
            onClick={() => setActiveTab('pwa')}
            className={`flex-1 py-3 px-2 text-[10px] sm:text-xs uppercase tracking-[0.16em] font-semibold text-center border-b-2 transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 ${
              activeTab === 'pwa'
                ? 'border-[#B89B5E] text-[#111111] bg-[#FAF7F2]'
                : 'border-transparent text-[#5C574E] hover:text-[#111111]'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>WebAPK Install</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('apk')}
            className={`flex-1 py-3 px-2 text-[10px] sm:text-xs uppercase tracking-[0.16em] font-semibold text-center border-b-2 transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5 ${
              activeTab === 'apk'
                ? 'border-[#B89B5E] text-[#111111] bg-[#FAF7F2]'
                : 'border-transparent text-[#5C574E] hover:text-[#111111]'
            }`}
          >
            <Package className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>Native APK & Code</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-5">
          {activeTab === 'pwa' ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3.5 bg-[#F7F3EC] border border-[#111111]/10 rounded-xs">
                <Sparkles className="w-4 h-4 text-[#7A6230] shrink-0 mt-0.5" strokeWidth={1.5} />
                <div className="text-xs text-[#111111] space-y-1">
                  <div className="font-semibold">Native Android WebAPK Installation</div>
                  <p className="text-[11px] text-[#5C574E] leading-relaxed">
                    Installs directly to your Android App Drawer and Home Screen and launches in full standalone mode without browser bars.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-[11px]">
                <div className="p-3 bg-[#F7F3EC] border border-[#111111]/10 rounded-xs">
                  <div className="font-semibold text-[#111111] flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-[#7A6230] shrink-0" strokeWidth={2} />
                    <span>Standalone View</span>
                  </div>
                  <span className="text-[#5C574E] text-[10px] pl-5 block">No browser URL bar</span>
                </div>
                <div className="p-3 bg-[#F7F3EC] border border-[#111111]/10 rounded-xs">
                  <div className="font-semibold text-[#111111] flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-[#7A6230] shrink-0" strokeWidth={2} />
                    <span>Cached Catalog</span>
                  </div>
                  <span className="text-[#5C574E] text-[10px] pl-5 block">Fast browsing anywhere</span>
                </div>
                <div className="p-3 bg-[#F7F3EC] border border-[#111111]/10 rounded-xs">
                  <div className="font-semibold text-[#111111] flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-[#7A6230] shrink-0" strokeWidth={2} />
                    <span>Order Updates</span>
                  </div>
                  <span className="text-[#5C574E] text-[10px] pl-5 block">Live status tracking</span>
                </div>
                <div className="p-3 bg-[#F7F3EC] border border-[#111111]/10 rounded-xs">
                  <div className="font-semibold text-[#111111] flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-[#7A6230] shrink-0" strokeWidth={2} />
                    <span>Fluid 60fps UI</span>
                  </div>
                  <span className="text-[#5C574E] text-[10px] pl-5 block">Tuned for mobile devices</span>
                </div>
              </div>

              {isInstalled ? (
                <div className="p-3 bg-[#F7F3EC] border border-[#B89B5E] text-[#111111] text-xs text-center font-medium rounded-xs flex items-center justify-center gap-1.5">
                  <Check className="w-4 h-4 text-[#7A6230]" strokeWidth={2} />
                  <span>VANTÉRA is already installed on this device.</span>
                </div>
              ) : isInstallable ? (
                <button
                  type="button"
                  onClick={handleInstallClick}
                  className="w-full gold-gradient-bg py-3.5 px-4 text-[11px] font-semibold uppercase tracking-[0.2em] rounded-xs inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>Install VANTÉRA on Android Now</span>
                </button>
              ) : (
                <div className="p-4 bg-[#F7F3EC] border border-[#111111]/10 text-xs space-y-2 rounded-xs">
                  <span className="font-semibold text-[#111111] block">How to Install on Android:</span>
                  <ol className="list-decimal list-inside space-y-1.5 text-[#5C574E] text-[11px]">
                    <li>In Chrome or your Android browser, tap the menu button (⋮) at top right.</li>
                    <li>Tap <strong className="text-[#111111]">Install app</strong> or <strong className="text-[#111111]">Add to Home screen</strong>.</li>
                    <li>Confirm to place the VANTÉRA icon on your home screen.</li>
                  </ol>
                </div>
              )}

              {installSuccess && (
                <p className="text-xs text-[#7A6230] text-center font-medium flex items-center justify-center gap-1.5">
                  <Check className="w-4 h-4" strokeWidth={2} />
                  <span>Installation initiated. Check your Android home screen.</span>
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3.5 bg-[#F7F3EC] border border-[#111111]/10 rounded-xs text-xs space-y-1.5">
                <div className="font-semibold text-[#111111]">Capacitor Native Android Project Ready</div>
                <p className="text-[11px] text-[#5C574E] leading-relaxed">
                  Configured native Android wrapper (com.vantera.store) ready to compile into a standalone APK or AAB bundle via Android Studio or Gradle.
                </p>
              </div>

              <div className="space-y-2 text-xs">
                <span className="text-[10px] text-[#5C574E] uppercase tracking-[0.16em] block">
                  How to build the native APK:
                </span>
                <div className="bg-[#111111] text-[#F7F3EC] p-3.5 text-[11px] rounded-xs space-y-1 tabular-nums">
                  <p className="text-[#F7F3EC]/60"># 1. Build web assets & sync to Android:</p>
                  <p className="text-[#B89B5E]">npm run build && npx cap sync android</p>
                  <p className="text-[#F7F3EC]/60 pt-1"># 2. Compile APK in Android directory:</p>
                  <p className="text-[#B89B5E]">cd android && ./gradlew assembleDebug</p>
                </div>
              </div>

              {downloadError && (
                <div className="p-3 bg-[#8E3A3A]/8 border border-[#8E3A3A]/30 text-[#8E3A3A] text-xs rounded-xs flex items-center justify-between gap-2">
                  <span className="leading-snug">{downloadError}</span>
                  <a
                    href="/api/download-android-project"
                    download="vantera-android-project.zip"
                    className="shrink-0 bg-[#111111] text-[#F7F3EC] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-xs"
                  >
                    Direct Link
                  </a>
                </div>
              )}

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={handleDownloadZip}
                  disabled={isDownloading}
                  className="flex-1 gold-gradient-bg py-3 px-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-center rounded-xs cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  <Download className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>{isDownloading ? 'Packaging...' : 'Download Android Package (.ZIP)'}</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="border border-[#111111]/15 px-4 py-3 text-xs uppercase tracking-wider text-[#5C574E] hover:text-[#111111] rounded-xs cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="bg-[#F7F3EC] border-t border-[#111111]/10 px-6 py-3 flex items-center justify-between text-[11px] text-[#5C574E]">
          <span>Optimized for Android 10+</span>
          <span className="text-[#7A6230] font-medium">PWA Verified</span>
        </div>
      </div>
    </div>
  );
};
