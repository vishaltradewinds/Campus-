import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Building2, CheckCircle2, LoaderCircle, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

type TenantContextResponse = { tenant: { id: string; slug: string }; role: string };

export const TenantIsolationPanel: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState<TenantContextResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [httpStatus, setHttpStatus] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setContext(null);
      setError('Sign in with an authorized account to inspect tenant context.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/tenant/context', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        cache: 'no-store',
      });
      setHttpStatus(response.status);
      const body = await response.json().catch(() => ({})) as TenantContextResponse & { error?: string };
      if (!response.ok) {
        setContext(null);
        setError(body.error || `Tenant context could not be verified (HTTP ${response.status}).`);
        return;
      }
      if (!body.tenant?.id || !body.tenant?.slug || !body.role) {
        setContext(null);
        setError('The tenant service returned an incomplete response.');
        return;
      }
      setContext(body);
    } catch {
      setHttpStatus(null);
      setContext(null);
      setError('Tenant service could not be reached. No tenant readiness is assumed.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <section className="space-y-6" aria-labelledby="tenant-isolation-heading">
      <header className="border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-widest text-indigo-600">
              <ShieldCheck className="h-4 w-4" /> Module 1 · Tenant isolation
            </p>
            <h2 id="tenant-isolation-heading" className="mt-2 text-xl font-black uppercase tracking-tight text-slate-900 sm:text-2xl">
              University boundary verification
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Verifies the tenant resolved by the server and the authenticated account's control-plane membership. A subdomain alone never grants data access.
            </p>
          </div>
          <button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex shrink-0 items-center justify-center gap-2 border border-slate-300 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {loading ? 'Checking' : 'Recheck context'}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="border border-slate-200 bg-white p-5">
          <Building2 className="h-5 w-5 text-indigo-600" />
          <p className="mt-3 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">Resolved tenant</p>
          <p className="mt-1 break-words text-lg font-black text-slate-900">{context ? context.tenant.slug : 'Not verified'}</p>
          <p className="mt-1 text-xs text-slate-500">{context ? `Tenant ID: ${context.tenant.id}` : 'Requires an active tenant subdomain and registry record.'}</p>
        </div>
        <div className="border border-slate-200 bg-white p-5">
          <ShieldCheck className="h-5 w-5 text-indigo-600" />
          <p className="mt-3 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">Access authorization</p>
          <p className="mt-1 text-lg font-black text-slate-900">{context ? 'Verified' : 'Not verified'}</p>
          <p className="mt-1 text-xs text-slate-500">{context ? `Authorized role: ${context.role}` : 'Requires a valid token and platform role or active university membership.'}</p>
        </div>
        <div className="border border-slate-200 bg-white p-5">
          {context ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <AlertTriangle className="h-5 w-5 text-amber-600" />}
          <p className="mt-3 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">Control-plane status</p>
          <p className="mt-1 text-lg font-black text-slate-900">{context ? 'Responding' : 'Unconfirmed'}</p>
          <p className="mt-1 text-xs text-slate-500">{httpStatus ? `Last response: HTTP ${httpStatus}` : 'No successful tenant-context response yet.'}</p>
        </div>
      </div>

      {error && (
        <div role="status" className="flex items-start gap-3 border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-bold">Tenant isolation has not been verified</p>
            <p className="mt-1">{error}</p>
            <p className="mt-2 text-xs">This status is intentionally fail-closed. Do not treat it as proof of a tenant database connection, successful migration, or production certification.</p>
          </div>
        </div>
      )}

      <div className="border border-slate-200 bg-slate-50 p-5">
        <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-800">Module 1 release checks</h3>
        <ul className="mt-3 grid grid-cols-1 gap-2 text-sm text-slate-700 sm:grid-cols-2">
          <li>• Direct host-to-tenant resolution</li>
          <li>• Trusted registry schema validation</li>
          <li>• Authenticated membership authorization</li>
          <li>• Unknown and suspended tenants fail closed</li>
          <li>• Per-schema client isolation</li>
          <li>• Database migration and cross-tenant tests still required</li>
        </ul>
      </div>
    </section>
  );
};
