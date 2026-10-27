import React from 'react';
import { INFO_PAGES, InfoPageData } from '../data/infoPages.ts';

interface InfoPageProps {
  pageKey: string;
  onNavigate: (url: string) => void;
}

export const InfoPage: React.FC<InfoPageProps> = ({ pageKey, onNavigate }) => {
  const cleanKey = pageKey.replace(/^\//, '');
  const data: InfoPageData | undefined = INFO_PAGES[cleanKey];

  if (!data) {
    return (
      <div className="w-full px-4 py-16 text-center space-y-4">
        <h2 className="font-editorial text-2xl text-[#F8F7F4]">Page Not Found</h2>
        <button
          onClick={() => onNavigate('/')}
          className="gold-gradient-bg text-[#0B0B0B] px-5 py-2 text-xs uppercase font-meta font-bold rounded-xs cursor-pointer"
        >
          Return Home
        </button>
      </div>
    );
  }

  return (
    <div className="w-full px-3.5 py-6 space-y-6 font-sans">
      {/* Masthead */}
      <div className="border-b border-white/5 pb-5 space-y-2">
        <span className="text-[9px] uppercase tracking-[0.18em] font-meta text-[#D4AF37] block">
          {data.eyebrow}
        </span>
        <h1 className="font-editorial text-2xl min-[360px]:text-3xl font-bold text-[#F8F7F4] leading-snug break-words">
          {data.title}
        </h1>
        <p className="text-xs text-[#8E8B82] leading-relaxed break-words font-light">
          {data.intro}
        </p>
      </div>

      {/* Sections */}
      <div className="space-y-6 divide-y divide-white/5">
        {data.sections.map((section, idx) => (
          <div key={idx} className={`space-y-2 ${idx > 0 ? 'pt-6' : ''}`}>
            <div>
              <span className="text-[9px] font-mono text-[#D4AF37] block mb-0.5">
                0{idx + 1} /
              </span>
              <h3 className="font-editorial text-base font-semibold text-[#F8F7F4] break-words">
                {section.heading}
              </h3>
            </div>
            <div>
              <div className="text-xs text-[#A9A69F] leading-relaxed whitespace-pre-line font-light break-words">
                {section.body}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Contact highlight and message form if on contact page */}
      {cleanKey === 'contact' && (
        <div className="space-y-5 pt-4 border-t border-white/5">
          <div className="border border-[#D4AF37]/30 bg-[#121212] p-4 space-y-2.5 rounded-xs">
            <h4 className="font-editorial font-bold text-sm text-[#F8F7F4]">
              Direct WhatsApp Concierge
            </h4>
            <p className="text-[11px] text-[#8E8B82] leading-relaxed break-words">
              Need immediate order assistance or custom concierge allocation? Reach CEO Adnuel directly on our official WhatsApp line:
            </p>
            <a
              href="https://wa.me/2349132793670"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#0F2E22] text-[#48BB78] border border-[#34A853]/30 px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-xs hover:bg-[#153e2f] transition-colors"
            >
              Open WhatsApp (+234 913 279 3670) ↗
            </a>
          </div>

          <div className="border border-white/5 bg-[#121212] p-4 space-y-3 rounded-xs">
            <h4 className="font-editorial font-bold text-sm text-[#F8F7F4]">
              Send Official Client Inquiry
            </h4>
            <p className="text-[11px] text-[#8E8B82] break-words">
              Inquiries are logged in the CEO dashboard and personally reviewed by Adnuel.
            </p>

            <ContactForm />
          </div>
        </div>
      )}
    </div>
  );
};

const ContactForm: React.FC = () => {
  const [form, setForm] = React.useState({ name: '', email: '', subject: 'Product & Availability Inquiry', phone: '', message: '' });
  const [status, setStatus] = React.useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setStatus('success');
        setForm({ name: '', email: '', subject: 'Product & Availability Inquiry', phone: '', message: '' });
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 text-xs">
      {status === 'success' && (
        <div className="p-3 bg-[#0F2E22] border border-[#34A853]/30 text-[#48BB78] text-[11px] rounded-xs">
          ✓ Your message has been transmitted directly to CEO Adnuel. We will reply promptly.
        </div>
      )}
      {status === 'error' && (
        <div className="p-3 bg-red-950/40 border border-red-500/30 text-red-300 text-[11px] rounded-xs">
          Please check that your name, email, and message are filled out correctly.
        </div>
      )}
      <div className="flex flex-col gap-2.5">
        <div>
          <label className="block text-[#8E8B82] mb-1 uppercase text-[9px] tracking-wider">Full Name *</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full bg-[#181818] border border-white/10 p-2.5 text-xs text-[#EDEDED] focus:border-[#D4AF37] focus:outline-hidden rounded-xs"
            placeholder="e.g. John Doe"
          />
        </div>
        <div>
          <label className="block text-[#8E8B82] mb-1 uppercase text-[9px] tracking-wider">Email Address *</label>
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full bg-[#181818] border border-white/10 p-2.5 text-xs text-[#EDEDED] focus:border-[#D4AF37] focus:outline-hidden rounded-xs"
            placeholder="e.g. john@example.com"
          />
        </div>
        <div>
          <label className="block text-[#8E8B82] mb-1 uppercase text-[9px] tracking-wider">Subject</label>
          <input
            type="text"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            className="w-full bg-[#181818] border border-white/10 p-2.5 text-xs text-[#EDEDED] focus:border-[#D4AF37] focus:outline-hidden rounded-xs"
          />
        </div>
        <div>
          <label className="block text-[#8E8B82] mb-1 uppercase text-[9px] tracking-wider">Phone / WhatsApp (Optional)</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full bg-[#181818] border border-white/10 p-2.5 text-xs text-[#EDEDED] focus:border-[#D4AF37] focus:outline-hidden rounded-xs"
            placeholder="+234..."
          />
        </div>
        <div>
          <label className="block text-[#8E8B82] mb-1 uppercase text-[9px] tracking-wider">Message *</label>
          <textarea
            required
            rows={4}
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            className="w-full bg-[#181818] border border-white/10 p-2.5 text-xs text-[#EDEDED] focus:border-[#D4AF37] focus:outline-hidden rounded-xs"
            placeholder="Write your inquiry or transaction questions here..."
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={status === 'sending'}
        className="w-full gold-gradient-bg text-[#0B0B0B] py-3 uppercase tracking-wider font-meta font-bold text-xs rounded-xs hover:opacity-90 transition-opacity cursor-pointer"
      >
        {status === 'sending' ? 'Transmitting...' : 'Send Inquiry to CEO Adnuel'}
      </button>
    </form>
  );
};
