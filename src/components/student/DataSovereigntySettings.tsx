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
    <div className="space-y-6 font-mono text-xs text-[#F5F5F5]">
      {/* Global Privacy Controls */}
      <div className="bg-[#111111] p-6 border border-[#333333] space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#222222]">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#CCFF00] flex items-center space-x-1.5">
              <Shield className="w-3.5 h-3.5" />
              <span>PRIVACY PREFERENCES</span>
            </div>
            <h3 className="text-xl font-black uppercase italic tracking-tight text-white mt-0.5">
              Student Privacy & Profile Settings
            </h3>
            <p className="text-xs text-[#888888] font-sans mt-1">
              Choose your default privacy settings for all current and upcoming campus placement drives.
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={grantAllCampaignConsents}
              className="px-3.5 py-2 bg-[#CCFF00] hover:bg-[#b8e600] text-black font-black uppercase text-xs transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Allow All</span>
            </button>
            <button
              onClick={revokeAllCampaignConsents}
              className="px-3.5 py-2 bg-[#222222] hover:bg-rose-950 hover:text-rose-400 text-[#888888] font-bold uppercase text-xs border border-[#333333] transition-colors flex items-center space-x-1.5 cursor-pointer"
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
                ? 'bg-[#181818] border-[#CCFF00]'
                : 'bg-[#141414] border-[#333333]'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <EyeOff className={`w-4 h-4 ${globalSettings.anonymizeProfileUntilConsent ? 'text-[#CCFF00]' : 'text-[#888888]'}`} />
                  <span className="font-black text-sm uppercase text-white">Hide Name Until I Apply</span>
                </div>
                <p className="text-[11px] text-[#888888] mt-1 font-sans">
                  Employers only see your skills and college tier until you explicitly approve or apply for their job drive.
                </p>
              </div>
              <span
                className={`px-2 py-0.5 text-[10px] font-bold uppercase border ${
                  globalSettings.anonymizeProfileUntilConsent
                    ? 'bg-[#CCFF00] text-black border-[#CCFF00]'
                    : 'bg-[#222222] text-[#888888] border-[#333333]'
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
                ? 'bg-[#181818] border-[#CCFF00]'
                : 'bg-[#141414] border-[#333333]'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <Radio className={`w-4 h-4 ${globalSettings.allowUnsolicitedPings ? 'text-[#CCFF00]' : 'text-[#888888]'}`} />
                  <span className="font-black text-sm uppercase text-white">Direct Job Invites from Top Companies</span>
                </div>
                <p className="text-[11px] text-[#888888] mt-1 font-sans">
                  Allow top recruiters to send fast-track interview invitations directly to your inbox.
                </p>
              </div>
              <span
                className={`px-2 py-0.5 text-[10px] font-bold uppercase border ${
                  globalSettings.allowUnsolicitedPings
                    ? 'bg-[#CCFF00] text-black border-[#CCFF00]'
                    : 'bg-[#222222] text-[#888888] border-[#333333]'
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
                ? 'bg-[#181818] border-[#CCFF00]'
                : 'bg-[#141414] border-[#333333]'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <Share2 className={`w-4 h-4 ${globalSettings.shareVerifiedBadgesGlobally ? 'text-[#CCFF00]' : 'text-[#888888]'}`} />
                  <span className="font-black text-sm uppercase text-white">Show Verified Skill Badges on Directory</span>
                </div>
                <p className="text-[11px] text-[#888888] mt-1 font-sans">
                  Display your verified subject and domain skill test badges on the campus talent directory.
                </p>
              </div>
              <span
                className={`px-2 py-0.5 text-[10px] font-bold uppercase border ${
                  globalSettings.shareVerifiedBadgesGlobally
                    ? 'bg-[#CCFF00] text-black border-[#CCFF00]'
                    : 'bg-[#222222] text-[#888888] border-[#333333]'
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
                ? 'bg-[#181818] border-[#CCFF00]'
                : 'bg-[#141414] border-[#333333]'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <DollarSign className={`w-4 h-4 ${globalSettings.autoDeclineBelowMinSalary ? 'text-[#CCFF00]' : 'text-[#888888]'}`} />
                  <span className="font-black text-sm uppercase text-white">Auto-Hide Low Salary Offers</span>
                </div>
                <p className="text-[11px] text-[#888888] mt-1 font-sans">
                  Automatically hide campus drives offering below your target package of ₹{currentStudent.preferences.expectedSalaryMinLPA || 10} LPA.
                </p>
              </div>
              <span
                className={`px-2 py-0.5 text-[10px] font-bold uppercase border ${
                  globalSettings.autoDeclineBelowMinSalary
                    ? 'bg-[#CCFF00] text-black border-[#CCFF00]'
                    : 'bg-[#222222] text-[#888888] border-[#333333]'
                }`}
              >
                {globalSettings.autoDeclineBelowMinSalary ? 'ON' : 'OFF'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Activity & Audit History */}
      <div className="bg-[#111111] p-6 border border-[#333333] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#222222]">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[#CCFF00] flex items-center space-x-1.5">
              <History className="w-3.5 h-3.5" />
              <span>SECURITY & ACTIVITY HISTORY</span>
            </div>
            <h3 className="text-xl font-black uppercase italic tracking-tight text-white mt-0.5">
              Permission Change History
            </h3>
          </div>
          <span className="text-[10px] text-[#888888] bg-[#181818] px-2.5 py-1 border border-[#333333]">
            TOTAL ENTRIES: <strong className="text-white">{auditRecords.length}</strong>
          </span>
        </div>

        <p className="text-xs text-[#888888] font-sans">
          A clear record of every time you granted, hid, or changed company permissions for your profile.
        </p>

        <div className="space-y-2.5">
          {auditRecords.length === 0 ? (
            <div className="p-6 text-center bg-[#181818] border border-[#222222] text-[#888888]">
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
                  className="bg-[#181818] p-4 border border-[#282828] hover:border-[#444444] transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-black uppercase border ${
                          isApprove
                            ? 'bg-[#182410] text-[#CCFF00] border-[#CCFF00]/40'
                            : isDeny
                            ? 'bg-rose-950/70 text-rose-400 border-rose-800'
                            : 'bg-[#222222] text-cyan-400 border-cyan-800'
                        }`}
                      >
                        {isApprove ? 'ALLOWED' : isDeny ? 'HIDDEN' : record.action}
                      </span>
                      <strong className="text-white text-xs">{record.employerName}</strong>
                      <span className="text-[#666666]">//</span>
                      <span className="text-[#AAAAAA]">{record.targetCampaign}</span>
                    </div>

                    <span className="text-[10px] text-[#888888]">
                      {new Date(record.timestamp).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-xs text-[#CCCCCC] mt-2 font-sans">{record.details}</p>

                  <div className="mt-3 pt-2 border-t border-[#222222] flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#777777]">
                    <div className="flex items-center space-x-2">
                      <span>USER: <strong className="text-[#AAAAAA]">{record.actor}</strong></span>
                      <span>//</span>
                      <span>REF: <code className="text-[#CCFF00]">{receiptHash}</code></span>
                    </div>

                    <button
                      onClick={() => handleCopyReceipt(record.id, JSON.stringify(record, null, 2))}
                      className="hover:text-white flex items-center space-x-1 cursor-pointer transition-colors"
                    >
                      {copiedId === record.id ? (
                        <>
                          <Check className="w-3 h-3 text-[#CCFF00]" />
                          <span className="text-[#CCFF00]">Copied</span>
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
