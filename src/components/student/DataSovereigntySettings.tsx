import React, { useState } from 'react';
import { useTalentNetwork } from '../../context/TalentNetworkContext';
import {
  ShieldCheck,
  Shield,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  History,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Sliders,
  DollarSign,
  Radio,
  Share2,
} from 'lucide-react';

export const DataSovereigntySettings: React.FC = () => {
  const {
    currentStudent,
    updateGlobalPrivacySettings,
    grantAllCampaignConsents,
    revokeAllCampaignConsents,
  } = useTalentNetwork();

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const globalSettings = currentStudent.globalDataPrivacy || {
    allowUnsolicitedPings: false,
    anonymizeProfileUntilConsent: false,
    shareVerifiedBadgesGlobally: true,
    autoDeclineBelowMinSalary: false,
  };

  const auditRecords = currentStudent.consentAuditTrail || [];

  const handleCopyReceipt = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="space-y-6 font-mono text-xs text-slate-900">
      {/* Global Privacy Controls */}
      <div className="bg-white p-6 border border-slate-300 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-indigo-600 flex items-center space-x-1.5">
              <Shield className="w-3.5 h-3.5" />
              <span>PRIVACY PREFERENCES</span>
            </div>
            <h3 className="text-xl font-black uppercase italic tracking-tight text-slate-900 mt-0.5">
              Student Privacy & Profile Settings
            </h3>
            <p className="text-xs text-slate-500 font-sans mt-1">
              Choose your default privacy settings for all current and upcoming campus placement drives.
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={grantAllCampaignConsents}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-xs transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Allow All</span>
            </button>
            <button
              onClick={revokeAllCampaignConsents}
              className="px-3.5 py-2 bg-slate-100 hover:bg-rose-950 hover:text-rose-400 text-slate-500 font-bold uppercase text-xs border border-slate-300 transition-colors flex items-center space-x-1.5 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Hide from All</span>
            </button>
          </div>
        </div>

        {/* Global Policy Toggles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Toggle 1: Anonymize Profile */}
          <div
            onClick={() =>
              updateGlobalPrivacySettings({
                anonymizeProfileUntilConsent: !globalSettings.anonymizeProfileUntilConsent,
              })
            }
            className={`p-4 border transition-all cursor-pointer flex flex-col justify-between ${
              globalSettings.anonymizeProfileUntilConsent
                ? 'bg-white border-indigo-600'
                : 'bg-slate-50 border-slate-300'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <EyeOff className={`w-4 h-4 ${globalSettings.anonymizeProfileUntilConsent ? 'text-indigo-600' : 'text-slate-500'}`} />
                  <span className="font-black text-sm uppercase text-slate-900">Hide Name Until I Apply</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 font-sans">
                  Employers only see your skills and college tier until you explicitly approve or apply for their job drive.
                </p>
              </div>
              <span
                className={`px-2 py-0.5 text-[10px] font-bold uppercase border ${
                  globalSettings.anonymizeProfileUntilConsent
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-slate-100 text-slate-500 border-slate-300'
                }`}
              >
                {globalSettings.anonymizeProfileUntilConsent ? 'ON' : 'OFF'}
              </span>
            </div>
          </div>

          {/* Toggle 2: Allow Direct Pings */}
          <div
            onClick={() =>
              updateGlobalPrivacySettings({
                allowUnsolicitedPings: !globalSettings.allowUnsolicitedPings,
              })
            }
            className={`p-4 border transition-all cursor-pointer flex flex-col justify-between ${
              globalSettings.allowUnsolicitedPings
                ? 'bg-white border-indigo-600'
                : 'bg-slate-50 border-slate-300'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <Radio className={`w-4 h-4 ${globalSettings.allowUnsolicitedPings ? 'text-indigo-600' : 'text-slate-500'}`} />
                  <span className="font-black text-sm uppercase text-slate-900">Direct Job Invites from Top Companies</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 font-sans">
                  Allow top recruiters to send fast-track interview invitations directly to your inbox.
                </p>
              </div>
              <span
                className={`px-2 py-0.5 text-[10px] font-bold uppercase border ${
                  globalSettings.allowUnsolicitedPings
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-slate-100 text-slate-500 border-slate-300'
                }`}
              >
                {globalSettings.allowUnsolicitedPings ? 'ON' : 'OFF'}
              </span>
            </div>
          </div>

          {/* Toggle 3: Share Badges Globally */}
          <div
            onClick={() =>
              updateGlobalPrivacySettings({
                shareVerifiedBadgesGlobally: !globalSettings.shareVerifiedBadgesGlobally,
              })
            }
            className={`p-4 border transition-all cursor-pointer flex flex-col justify-between ${
              globalSettings.shareVerifiedBadgesGlobally
                ? 'bg-white border-indigo-600'
                : 'bg-slate-50 border-slate-300'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <Share2 className={`w-4 h-4 ${globalSettings.shareVerifiedBadgesGlobally ? 'text-indigo-600' : 'text-slate-500'}`} />
                  <span className="font-black text-sm uppercase text-slate-900">Show Verified Skill Badges on Directory</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 font-sans">
                  Display your verified subject and domain skill test badges on the campus talent directory.
                </p>
              </div>
              <span
                className={`px-2 py-0.5 text-[10px] font-bold uppercase border ${
                  globalSettings.shareVerifiedBadgesGlobally
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-slate-100 text-slate-500 border-slate-300'
                }`}
              >
                {globalSettings.shareVerifiedBadgesGlobally ? 'ON' : 'OFF'}
              </span>
            </div>
          </div>

          {/* Toggle 4: Auto Decline Below Min Salary */}
          <div
            onClick={() =>
              updateGlobalPrivacySettings({
                autoDeclineBelowMinSalary: !globalSettings.autoDeclineBelowMinSalary,
              })
            }
            className={`p-4 border transition-all cursor-pointer flex flex-col justify-between ${
              globalSettings.autoDeclineBelowMinSalary
                ? 'bg-white border-indigo-600'
                : 'bg-slate-50 border-slate-300'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <DollarSign className={`w-4 h-4 ${globalSettings.autoDeclineBelowMinSalary ? 'text-indigo-600' : 'text-slate-500'}`} />
                  <span className="font-black text-sm uppercase text-slate-900">Auto-Hide Low Salary Offers</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 font-sans">
                  Automatically hide campus drives offering below your target package of ₹{currentStudent.preferences.expectedSalaryMinLPA || 10} LPA.
                </p>
              </div>
              <span
                className={`px-2 py-0.5 text-[10px] font-bold uppercase border ${
                  globalSettings.autoDeclineBelowMinSalary
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-slate-100 text-slate-500 border-slate-300'
                }`}
              >
                {globalSettings.autoDeclineBelowMinSalary ? 'ON' : 'OFF'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Activity & Audit History */}
      <div className="bg-white p-6 border border-slate-300 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-indigo-600 flex items-center space-x-1.5">
              <History className="w-3.5 h-3.5" />
              <span>SECURITY & ACTIVITY HISTORY</span>
            </div>
            <h3 className="text-xl font-black uppercase italic tracking-tight text-slate-900 mt-0.5">
              Permission Change History
            </h3>
          </div>
          <span className="text-[10px] text-slate-500 bg-white px-2.5 py-1 border border-slate-300">
            TOTAL ENTRIES: <strong className="text-slate-900">{auditRecords.length}</strong>
          </span>
        </div>

        <p className="text-xs text-slate-500 font-sans">
          A clear record of every time you granted, hid, or changed company permissions for your profile.
        </p>

        <div className="space-y-2.5">
          {auditRecords.length === 0 ? (
            <div className="p-6 text-center bg-white border border-slate-200 text-slate-500">
              No activity logged yet. Your changes to company permissions will appear here.
            </div>
          ) : (
            auditRecords.map((record) => {
              const isApprove = record.action === 'APPROVED' || record.action === 'GRANTED_ALL';
              const isDeny = record.action === 'DENIED' || record.action === 'REVOKED_ALL';

              const receiptHash = `0x${Math.abs(
                record.id.split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0)
              ).toString(16).padStart(8, '0')}`;

              return (
                <div
                  key={record.id}
                  className="bg-white p-4 border border-slate-200 hover:border-slate-300 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-black uppercase border ${
                          isApprove
                            ? 'bg-indigo-50 text-indigo-600 border-indigo-600/40'
                            : isDeny
                            ? 'bg-rose-950/70 text-rose-400 border-rose-800'
                            : 'bg-slate-100 text-cyan-400 border-cyan-800'
                        }`}
                      >
                        {isApprove ? 'ALLOWED' : isDeny ? 'HIDDEN' : record.action}
                      </span>
                      <strong className="text-slate-900 text-xs">{record.employerName}</strong>
                      <span className="text-slate-500">//</span>
                      <span className="text-slate-500">{record.targetCampaign}</span>
                    </div>

                    <span className="text-[10px] text-slate-500">
                      {new Date(record.timestamp).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 mt-2 font-sans">{record.details}</p>

                  <div className="mt-3 pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400">
                    <div className="flex items-center space-x-2">
                      <span>USER: <strong className="text-slate-500">{record.actor}</strong></span>
                      <span>//</span>
                      <span>REF: <code className="text-indigo-600">{receiptHash}</code></span>
                    </div>

                    <button
                      onClick={() => handleCopyReceipt(record.id, JSON.stringify(record, null, 2))}
                      className="hover:text-slate-900 flex items-center space-x-1 cursor-pointer transition-colors"
                    >
                      {copiedId === record.id ? (
                        <>
                          <Check className="w-3 h-3 text-indigo-600" />
                          <span className="text-indigo-600">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Log</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
