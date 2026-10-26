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
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h2 className="font-serif text-2xl">Page Not Found</h2>
        <button
          onClick={() => onNavigate('/')}
          className="mt-4 bg-[#121210] text-[#f8f7f4] px-5 py-2 text-xs uppercase"
        >
          Return Home
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-12">
      {/* Masthead */}
      <div className="border-b border-[#e7e4de] pb-8 space-y-3">
        <span className="text-[10px] uppercase tracking-widest font-mono text-[#c4a66b]">
          {data.eyebrow}
        </span>
        <h1 className="font-serif text-3xl sm:text-5xl font-normal text-[#121210]">
          {data.title}
        </h1>
        <p className="text-xs sm:text-sm text-[#77746d] max-w-2xl leading-relaxed">
          {data.intro}
        </p>
      </div>

      {/* Sections */}
      <div className="space-y-8 divide-y divide-[#e7e4de]">
        {data.sections.map((section, idx) => (
          <div key={idx} className={`grid grid-cols-1 md:grid-cols-12 gap-4 ${idx > 0 ? 'pt-8' : ''}`}>
            <div className="md:col-span-4">
              <span className="text-[10px] font-mono text-[#77746d] block mb-1">
                0{idx + 1} /
              </span>
              <h3 className="font-serif text-lg font-medium text-[#121210]">
                {section.heading}
              </h3>
            </div>
            <div className="md:col-span-8">
              <div className="text-xs sm:text-sm text-[#252521] leading-relaxed whitespace-pre-line">
                {section.body}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Contact highlight and message form if on contact page */}
      {cleanKey === 'contact' && (
        <div className="space-y-6 pt-4 border-t border-[#e7e4de]">
          <div className="border border-[#c4a66b]/40 bg-[#fffdfa] p-6 space-y-3">
            <h4 className="font-serif font-bold text-base text-[#121210]">
              Direct WhatsApp Assistance
            </h4>
            <p className="text-xs text-[#77746d] leading-relaxed">
              Need immediate verification for your bank transfer or a custom wholesale inquiry? Message CEO Adnuel directly on our official WhatsApp business channel:
            </p>
            <a
              href="https://wa.me/2349132793670"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#1e7e34] text-white px-5 py-2.5 text-xs font-semibold uppercase tracking-wider hover:bg-[#186429] transition-colors"
            >
              Open WhatsApp (+234 913 279 3670)
            </a>
          </div>

          <div className="border border-[#e7e4de] bg-white p-6 space-y-4">
            <h4 className="font-serif font-bold text-base text-[#121210]">
              Send an Official Client Inquiry
            </h4>
            <p className="text-xs text-[#77746d]">
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
    <form onSubmit={handleSubmit} className="space-y-4 text-xs">
      {status === 'success' && (
        <div className="p-3 bg-[#eef8ee] border border-[#c3e6cb] text-[#1e7e34]">
          ✓ Your message has been transmitted directly to CEO Adnuel. We will reply promptly to your email.
        </div>
      )}
      {status === 'error' && (
        <div className="p-3 bg-[#fdf2f2] border border-[#f8b4b4] text-[#9b1c1c]">
          Please check that your name, email, and message are filled out correctly.
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-[#77746d] mb-1 uppercase text-[10px] tracking-wider">Full Name *</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full border border-[#e7e4de] p-2 focus:border-[#121210] focus:outline-hidden"
            placeholder="e.g. John Doe"
          />
        </div>
        <div>
          <label className="block text-[#77746d] mb-1 uppercase text-[10px] tracking-wider">Email Address *</label>
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full border border-[#e7e4de] p-2 focus:border-[#121210] focus:outline-hidden"
            placeholder="e.g. john@example.com"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-[#77746d] mb-1 uppercase text-[10px] tracking-wider">Subject</label>
          <input
            type="text"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            className="w-full border border-[#e7e4de] p-2 focus:border-[#121210] focus:outline-hidden"
          />
        </div>
        <div>
          <label className="block text-[#77746d] mb-1 uppercase text-[10px] tracking-wider">Phone / WhatsApp (Optional)</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full border border-[#e7e4de] p-2 focus:border-[#121210] focus:outline-hidden"
            placeholder="+234..."
          />
        </div>
      </div>
      <div>
        <label className="block text-[#77746d] mb-1 uppercase text-[10px] tracking-wider">Message *</label>
        <textarea
          required
          rows={4}
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          className="w-full border border-[#e7e4de] p-2 focus:border-[#121210] focus:outline-hidden"
          placeholder="Write your inquiry or transaction questions here..."
        />
      </div>
      <button
        type="submit"
        disabled={status === 'sending'}
        className="bg-[#121210] text-[#f8f7f4] px-6 py-2.5 uppercase tracking-wider font-semibold hover:bg-[#c4a66b] hover:text-[#121210] transition-colors"
      >
        {status === 'sending' ? 'Transmitting...' : 'Send Inquiry to CEO Adnuel'}
      </button>
    </form>
  );
};
