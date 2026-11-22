import {useAuth} from '../../context/AuthContext';
import React, { useState, useEffect } from 'react';
import { CreditCard } from 'lucide-react';

type IndicativeQuote={scope:{campaignId:string;institutions:number;vacancies:number};quote:{totalMinor:number;currency:string};paymentStatus:string;quoteStatus:string};
export function CommercialCampaignCheckout({campaignId}: {campaignId:string;defaultVacancies:number;defaultInstitutions:number}) {
  const {request,currentPrincipal}=useAuth();
  const [quote,setQuote]=useState<IndicativeQuote|null>(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  useEffect(()=>{setQuote(null);setMessage('');},[campaignId]);
  const refresh=async()=>{
    const uid=currentPrincipal()?.uid;
    if(!uid){setMessage('Authentication is required.');return;}
    setBusy(true);setMessage('');setQuote(null);
    try{

      const response=await request('/api/commercial/campaign-quote',{method:'POST',signal:AbortSignal.timeout(20000),headers:{'Content-Type':'application/json'},body:JSON.stringify({campaignId})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||'Quote unavailable');
      if(currentPrincipal()?.uid!==uid||data.scope?.campaignId!==campaignId||data.quoteStatus!=='INDICATIVE_NOT_PAYABLE')throw new Error('Quote scope changed; refresh the campaign.');
      setQuote(data);
    }catch(error){setMessage(error instanceof Error?error.message:'Quote unavailable');}
    finally{setBusy(false);}
  };
  return <section className="bg-white border border-slate-300 p-4 sm:p-5 space-y-4">
    <div className="flex items-start gap-3"><CreditCard className="w-5 h-5 text-indigo-600 mt-0.5 shrink-0"/><div className="min-w-0"><h3 className="font-black uppercase text-sm">Campaign pricing estimate</h3><p className="text-xs text-slate-500 mt-1">Payment collection is disabled pending commercial approval. Estimates use stored campaign details; no payment or invoice is created.</p></div></div>
    {quote && quote.scope.campaignId===campaignId && <div className="text-sm"><p>{quote.scope.institutions} targeted institutions · {quote.scope.vacancies} vacancies</p><p className="text-xl font-black">₹{(quote.quote.totalMinor/100).toLocaleString('en-IN',{minimumFractionDigits:2})}</p><p className="text-xs text-slate-500">Indicative estimate only — not payable</p></div>}
    <button onClick={refresh} disabled={busy} className="px-4 py-2 bg-slate-900 text-white text-xs font-bold disabled:opacity-50">Refresh server estimate</button>
    {message && <p role="status" className="text-xs p-2 border border-slate-200 break-words">{message}</p>}
  </section>;
}
