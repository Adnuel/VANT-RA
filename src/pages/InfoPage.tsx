import React from 'react';
import { MessageCircle } from 'lucide-react';
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
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-28 text-center space-y-6 text-[#111111]">
        <p className="text-[11px] uppercase tracking-[0.22em] text-[#7A6230] font-semibold">Error 404</p>
        <h1 className="font-editorial text-3xl sm:text-4xl text-[#111111]">Page Not Found</h1>
        <button
          type="button"
          onClick={() => onNavigate('/')}
          className="gold-gradient-bg px-7 py-3 text-[11px] uppercase tracking-[0.2em] font-semibold rounded-xs cursor-pointer"
        >
          Return Home
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 lg:px-12 py-14 lg:py-24 space-y-14 text-[#111111]">
      {/* Masthead */}
      <div className="border-b border-[#111111]/10 pb-10 space-y-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7A6230]">
          {data.eyebrow}
        </p>
        <h1 className="font-editorial text-3xl sm:text-5xl font-medium text-[#111111] leading-tight text-balance">
          {data.title}
        </h1>
        <p className="text-base text-[#5C574E] leading-relaxed max-w-2xl">
          {data.intro}
        </p>
      </div>

      {/* Editorial Sections */}
      <div className="divide-y divide-[#111111]/10">
        {data.sections.map((section, idx) => (
          <div key={idx} className={`grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-8 ${idx > 0 ? 'py-9' : 'pb-9'}`}>
            <div className="md:col-span-4 space-y-1.5">
              <span className="text-[11px] uppercase tracking-[0.2em] text-[#7A6230] font-semibold block tabular-nums">
                0{idx + 1}
              </span>
              <h2 className="font-editorial text-xl font-medium text-[#111111]">
                {section.heading}
              </h2>
            </div>
            <div className="md:col-span-8">
              <div className="text-sm sm:text-base text-[#5C574E] leading-relaxed whitespace-pre-line">
                {section.body}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Direct Concierge & Contact Inquiry Form */}
      {cleanKey === 'contact' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pt-10 border-t border-[#111111]/10">
          <div className="md:col-span-5 bg-[#FAF7F2] border border-[#111111]/10 p-6 sm:p-8 rounded-xs space-y-4 self-start">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#7A6230] font-semibold">Concierge</p>
            <h3 className="font-editorial text-2xl font-medium text-[#111111]">
              Direct Support
            </h3>
            <p className="text-sm text-[#5C574E] leading-relaxed">
              Reach CEO Adnuel directly for order inquiries, dispatch tracking, or bank transfer confirmation.
            </p>
            <a
              href="https://wa.me/2347015285932"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full gold-gradient-bg px-5 py-3 text-[11px] uppercase tracking-[0.18em] font-semibold rounded-xs"
            >
              <MessageCircle className="w-4 h-4" strokeWidth={1.5} />
              <span>WhatsApp (07015285932)</span>
            </a>
            <p className="text-xs text-[#5C574E] pt-1">
              Email: vanteratechnologyelevated@gmail.com
            </p>
          </div>

          <div className="md:col-span-7 bg-[#FAF7F2] border border-[#111111]/10 p-6 sm:p-8 rounded-xs space-y-5">
            <div>
              <h3 className="font-editorial text-2xl font-medium text-[#111111]">
                Send an Inquiry
              </h3>
              <p className="text-sm text-[#5C574E] mt-1">
                Messages are logged directly to our support desk.
              </p>
            </div>
            <ContactForm />
          </div>
        </div>
      )}
    </div>
  );
};

const ContactForm: React.FC = () => {
  const [form, setForm] = React.useState({
    name: '',
    email: '',
    subject: 'Product & Availability Inquiry',
    phone: '',
    message: '',
  });
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
        setForm({
          name: '',
          email: '',
          subject: 'Product & Availability Inquiry',
          phone: '',
          message: '',
        });
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-sm">
      {status === 'success' && (
        <div className="p-3.5 bg-[#F7F3EC] border border-[#B89B5E] text-[#111111] text-xs rounded-xs">
          Your message has been sent. We will reply shortly.
        </div>
      )}
      {status === 'error' && (
        <div className="p-3.5 bg-[#8E3A3A]/8 border border-[#8E3A3A]/30 text-[#8E3A3A] text-xs rounded-xs">
          Please check that your name, email, and message are filled out correctly.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="contact-name" className="block text-[10px] uppercase tracking-[0.18em] text-[#5C574E] mb-1.5">
            Full Name *
          </label>
          <input
            id="contact-name"
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full bg-[#F7F3EC] border border-[#111111]/15 p-3 text-sm text-[#111111] focus:border-[#B89B5E] focus:outline-hidden rounded-xs"
            placeholder="Adaora Okafor"
          />
        </div>
        <div>
          <label htmlFor="contact-email" className="block text-[10px] uppercase tracking-[0.18em] text-[#5C574E] mb-1.5">
            Email Address *
          </label>
          <input
            id="contact-email"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full bg-[#F7F3EC] border border-[#111111]/15 p-3 text-sm text-[#111111] focus:border-[#B89B5E] focus:outline-hidden rounded-xs"
            placeholder="you@example.com"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="contact-subject" className="block text-[10px] uppercase tracking-[0.18em] text-[#5C574E] mb-1.5">
            Subject
          </label>
          <input
            id="contact-subject"
            type="text"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            className="w-full bg-[#F7F3EC] border border-[#111111]/15 p-3 text-sm text-[#111111] focus:border-[#B89B5E] focus:outline-hidden rounded-xs"
          />
        </div>
        <div>
          <label htmlFor="contact-phone" className="block text-[10px] uppercase tracking-[0.18em] text-[#5C574E] mb-1.5">
            Phone / WhatsApp
          </label>
          <input
            id="contact-phone"
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full bg-[#F7F3EC] border border-[#111111]/15 p-3 text-sm text-[#111111] focus:border-[#B89B5E] focus:outline-hidden rounded-xs tabular-nums"
            placeholder="+234..."
          />
        </div>
      </div>

      <div>
        <label htmlFor="contact-message" className="block text-[10px] uppercase tracking-[0.18em] text-[#5C574E] mb-1.5">
          Message *
        </label>
        <textarea
          id="contact-message"
          required
          rows={4}
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          className="w-full bg-[#F7F3EC] border border-[#111111]/15 p-3 text-sm text-[#111111] focus:border-[#B89B5E] focus:outline-hidden rounded-xs"
          placeholder="How can we help?"
        />
      </div>

      <button
        type="submit"
        disabled={status === 'sending'}
        className="w-full gold-gradient-bg py-3.5 text-[11px] uppercase tracking-[0.2em] font-semibold rounded-xs cursor-pointer"
      >
        {status === 'sending' ? 'Sending...' : 'Send Message'}
      </button>
    </form>
  );
};
