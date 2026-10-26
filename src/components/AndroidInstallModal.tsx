import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';
import { downloadAndroidProjectZip } from '../lib/downloadZip.ts';

interface AndroidInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AndroidInstallModal: React.FC<AndroidInstallModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, install, isAndroid } = usePWAInstall();
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150"
    >
      <div className="bg-white w-full max-w-lg border border-[#121210] shadow-2xl rounded-xs overflow-hidden text-left font-sans">
        {/* Header */}
        <div className="bg-[#121210] text-[#f8f7f4] px-5 sm:px-6 py-4 sm:py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 bg-white text-[#121210] flex items-center justify-center font-serif text-base sm:text-lg font-bold rounded-xs shrink-0">
              V
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xs sm:text-sm tracking-wider uppercase">VANTÉRA Android App</span>
                <span className="bg-[#c4a66b] text-[#121210] text-[9px] font-bold px-1.5 py-0.5 rounded-2xs font-mono">
                  v1.0.0
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-[#a9a69f]">Official Mobile Experience · Technology, Elevated.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#a9a69f] hover:text-white p-1.5 rounded-xs transition-colors cursor-pointer shrink-0"
            aria-label="Close modal"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-[#e7e4de] bg-[#fbfaf7]">
          <button
            type="button"
            onClick={() => setActiveTab('pwa')}
            className={`flex-1 py-2.5 sm:py-3 px-2 text-[10px] sm:text-xs uppercase tracking-wider font-bold text-center border-b-2 transition-colors cursor-pointer ${
              activeTab === 'pwa'
                ? 'border-[#121210] text-[#121210] bg-white'
                : 'border-transparent text-[#77746d] hover:text-[#121210]'
            }`}
          >
            📱 WebAPK Install
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('apk')}
            className={`flex-1 py-2.5 sm:py-3 px-2 text-[10px] sm:text-xs uppercase tracking-wider font-bold text-center border-b-2 transition-colors cursor-pointer ${
              activeTab === 'apk'
                ? 'border-[#121210] text-[#121210] bg-white'
                : 'border-transparent text-[#77746d] hover:text-[#121210]'
            }`}
          >
            📦 Native APK & Code
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-4 sm:space-y-5">
          {activeTab === 'pwa' ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 bg-[#f4f2ee] border border-[#e7e4de] rounded-xs">
                <div className="text-xl shrink-0">⚡</div>
                <div className="text-xs text-[#252521] space-y-0.5">
                  <div className="font-bold text-[#121210]">Native Android WebAPK Installation</div>
                  <p className="text-[11px] text-[#77746d] leading-relaxed">
                    Installs directly to your Android App Drawer and Home Screen. Launches in pure standalone mode without browser bars, exactly like an app downloaded from the Google Play Store.
                  </p>
                </div>
              </div>

              {/* Android Features Grid */}
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 bg-white border border-[#e7e4de] rounded-xs">
                  <div className="font-bold text-[#121210] flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Full-Screen Standalone</span>
                  </div>
                  <span className="text-[#77746d] text-[10px] pl-5 block">No browser URL bar</span>
                </div>
                <div className="p-2.5 bg-white border border-[#e7e4de] rounded-xs">
                  <div className="font-bold text-[#121210] flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Offline Catalog Access</span>
                  </div>
                  <span className="text-[#77746d] text-[10px] pl-5 block">Browse cached tech anytime</span>
                </div>
                <div className="p-2.5 bg-white border border-[#e7e4de] rounded-xs">
                  <div className="font-bold text-[#121210] flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Push Orders & Tracking</span>
                  </div>
                  <span className="text-[#77746d] text-[10px] pl-5 block">Live alerts for GTBank wires</span>
                </div>
                <div className="p-2.5 bg-white border border-[#e7e4de] rounded-xs">
                  <div className="font-bold text-[#121210] flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Fast 60FPS UI</span>
                  </div>
                  <span className="text-[#77746d] text-[10px] pl-5 block">Optimized for Samsung & Android</span>
                </div>
              </div>

              {isInstalled ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-[#1e7e34] text-xs text-center font-bold rounded-xs flex items-center justify-center gap-1.5">
                  <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>VANTÉRA is already installed on this device!</span>
                </div>
              ) : isInstallable ? (
                <button
                  type="button"
                  onClick={handleInstallClick}
                  className="w-full bg-[#121210] text-[#f8f7f4] py-3.5 px-4 text-xs font-bold uppercase tracking-widest hover:bg-[#c4a66b] hover:text-[#121210] transition-colors rounded-xs flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <span>Install VANTÉRA on Android Now</span>
                  <span>↓</span>
                </button>
              ) : (
                <div className="p-4 bg-[#fbfaf7] border border-[#e7e4de] text-xs space-y-2 rounded-xs">
                  <span className="font-bold text-[#121210] block">How to Install on Android in 2 Steps:</span>
                  <ol className="list-decimal list-inside space-y-1.5 text-[#4b5563] text-[11px]">
                    <li>In Chrome or your Android browser, tap the <strong>three dots (⋮)</strong> at top right.</li>
                    <li>Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.</li>
                    <li>Confirm <strong>"Install"</strong> — the VANTÉRA icon will appear in your apps list!</li>
                  </ol>
                </div>
              )}

              {installSuccess && (
                <p className="text-xs text-[#1e7e34] text-center font-bold flex items-center justify-center gap-1.5">
                  <svg className="w-4 h-4 text-[#1e7e34]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Installation initiated! Check your Android home screen.</span>
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3.5 bg-[#f4f2ee] border border-[#e7e4de] rounded-xs text-xs space-y-2">
                <div className="font-bold text-[#121210] flex items-center gap-2">
                  <span>🤖</span>
                  <span>Capacitor Native Android Project Ready</span>
                </div>
                <p className="text-[11px] text-[#77746d] leading-relaxed">
                  We have configured a complete native Android wrapper using Capacitor <code>com.vantera.store</code>.
                  You can compile it into a standalone <code>.apk</code> or <code>.aab</code> bundle for the Google Play Store using Android Studio or command-line Gradle.
                </p>
              </div>

              <div className="space-y-2 text-xs">
                <span className="font-mono text-[10px] text-[#77746d] uppercase block">How to build the native APK:</span>
                <div className="bg-[#121210] text-[#f8f7f4] p-3 font-mono text-[11px] rounded-xs space-y-1">
                  <p className="text-[#a9a69f]"># 1. Build web assets & sync to Android:</p>
                  <p className="text-[#c4a66b]">npm run build && npx cap sync android</p>
                  <p className="text-[#a9a69f] pt-1"># 2. Open in Android Studio or compile APK directly:</p>
                  <p className="text-[#c4a66b]">cd android && ./gradlew assembleDebug</p>
                  <p className="text-[#a9a69f] pt-1"># Output APK location:</p>
                  <p className="text-[#e5e7eb]">android/app/build/outputs/apk/debug/app-debug.apk</p>
                </div>
              </div>

              {downloadError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xs flex items-center justify-between gap-2">
                  <span className="leading-snug">{downloadError}</span>
                  <a
                    href="/api/download-android-project"
                    download="vantera-android-project.zip"
                    className="shrink-0 bg-rose-700 text-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded-2xs hover:bg-rose-800"
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
                  className="flex-1 bg-[#121210] text-[#f8f7f4] py-3 px-4 text-xs font-bold uppercase tracking-wider hover:bg-[#c4a66b] hover:text-[#121210] transition-colors text-center rounded-xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <span>📦</span>
                  <span>{isDownloading ? 'Packaging & Downloading...' : 'Download Android Studio Package (.ZIP)'}</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="border border-[#e7e4de] px-4 py-3 text-xs uppercase tracking-wider text-[#77746d] hover:text-[#121210] cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="bg-[#fbfaf7] border-t border-[#e7e4de] px-6 py-3 flex items-center justify-between text-[11px] text-[#77746d]">
          <span>Optimized for Android 10, 11, 12, 13, 14 & 15+</span>
          <span className="text-[#1e7e34] font-semibold">● Android Verified</span>
        </div>
      </div>
    </div>
  );
};
