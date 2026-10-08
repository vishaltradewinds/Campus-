import React, { useState } from 'react';
import { CreditCard, ShieldCheck } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { quoteHiringCampaign } from '../../lib/commercial';

declare global { interface Window { Razorpay?: new (options: Record<string, unknown>) => { open: () => void } } }

export function CommercialCampaignCheckout({ campaignId, defaultVacancies, defaultInstitutions }: { campaignId: string; defaultVacancies: number; defaultInstitutions: number }) {
  const [vacancies, setVacancies] = useState(Math.max(1, defaultVacancies));
  const [institutions, setInstitutions] = useState(Math.max(1, defaultInstitutions));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const quote = quoteHiringCampaign({ vacancies, institutions, currency: 'INR' });

  const checkout = async () => {
    if (!auth.currentUser) { setMessage('Authentication is required.'); return; }
    setBusy(true); setMessage('');
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/commercial/razorpay/order', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: crypto.randomUUID(), campaignId, institutions, vacancies, description: `NexusTalent hiring campaign ${campaignId}` })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Payment order could not be created');
      if (!data.orderId) throw new Error('Payment provider returned no order identifier');
      if (!window.Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script'); script.src = 'https://checkout.razorpay.com/v1/checkout.js'; script.onload = () => resolve(); script.onerror = () => reject(new Error('Payment checkout could not be loaded')); document.body.appendChild(script);
        });
      }
      if (!window.Razorpay) throw new Error('Payment checkout is unavailable');
      const rzp = new window.Razorpay({
        key: data.keyId || undefined,
        amount: data.amountMinor,
        currency: data.currency,
        name: 'NexusTalent',
        description: 'Hiring campaign',
        order_id: data.orderId,
        handler: () => setMessage('Payment response received. Final settlement is confirmed only by the server webhook.'),
        modal: { ondismiss: () => setMessage('Payment window closed.') }
      });
      rzp.open();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Payment failed'); }
    finally { setBusy(false); }
  };

  return (
    <section className="bg-white border border-slate-300 p-4 sm:p-5 space-y-4">
      <div className="flex items-start gap-3"><CreditCard className="w-5 h-5 text-indigo-600 mt-0.5" /><div><h3 className="font-black uppercase text-sm">Campaign Billing</h3><p className="text-xs text-slate-500 mt-1">Quote is calculated on the trusted server. Client payment callbacks never mark an invoice paid.</p></div></div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <label className="space-y-1"><span className="text-[10px] uppercase font-bold text-slate-500">Institutions</span><input type="number" min="1" max="1000" value={institutions} onChange={e => setInstitutions(Number(e.target.value)||1)} className="w-full border border-slate-300 p-2" /></label>
        <label className="space-y-1"><span className="text-[10px] uppercase font-bold text-slate-500">Vacancies</span><input type="number" min="1" max="100000" value={vacancies} onChange={e => setVacancies(Number(e.target.value)||1)} className="w-full border border-slate-300 p-2" /></label>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-200 pt-3">
        <div><div className="text-xs text-slate-500 uppercase">Server quote</div><div className="text-xl font-black">₹{(quote.totalMinor/100).toLocaleString('en-IN', {minimumFractionDigits:2})}</div></div>
        <button onClick={checkout} disabled={busy} className="px-4 py-2 bg-slate-900 text-white text-xs font-bold uppercase disabled:opacity-50 flex items-center justify-center gap-2"><ShieldCheck className="w-4 h-4"/>Proceed to secure checkout</button>
      </div>
      {message && <div className="text-xs p-2 border border-slate-200 bg-slate-50" role="status">{message}</div>}
    </section>
  );
}
