import React, { useState } from 'react';
import { useTalentNetwork } from '../../context/TalentNetworkContext';
import {
  ShieldCheck,
  ShieldAlert,
  Shield,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  EyeOff,
  Sliders,
  Sparkles,
  Building2,
  MapPin,
  IndianRupee,
  Lock,
  Unlock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
} from 'lucide-react';
import { CampaignConsentPermission } from '../../types';

export const StudentConsentMatrix: React.FC = () => {
  const {
    currentStudent,
    campaigns,
    toggleCampaignConsent,
    updateCampaignConsentScope,
    grantAllCampaignConsents,
    revokeAllCampaignConsents,
  } = useTalentNetwork();

  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null);
  const [denialModalCampaignId, setDenialModalCampaignId] = useState<string | null>(null);
  const [customDenialReason, setCustomDenialReason] = useState('');
  const [selectedDenialPreset, setSelectedDenialPreset] = useState('Location Preference Mismatch');
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'denied' | 'pending'>('all');
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const denialPresets = [
    'Location Preference Mismatch (Prefer Remote / Bangalore)',
    'Compensation Below Minimum Target Threshold',
    'Domain / Tech Stack Mismatch (Focusing on AI/ML)',
    'Currently Prioritizing Other Specific Active Offers',
    'Personal Career Preference / Culture Fit',
  ];

  const studentConsents = currentStudent.campaignConsents || {};

  // Build list of all active campaigns with current consent info
  const campaignConsentList = campaigns.map((camp) => {
    const consent = studentConsents[camp.id];
    const status: 'approved' | 'denied' | 'pending' = consent?.status || 'pending';
    return {
      campaign: camp,
      consent: consent || {
        campaignId: camp.id,
        employerId: camp.employerId,
        employerName: camp.employerName,
        role: camp.requirement.role,
        salaryLPA: `₹${camp.requirement.salaryMinLPA} - ${camp.requirement.salaryMaxLPA} LPA`,
        status: 'pending' as const,
        academicDataShared: false,
        skillBenchmarksShared: false,
        projectReposShared: false,
        contactInfoShared: false,
      },
      status,
    };
  });

  const filteredCampaigns = campaignConsentList.filter(({ campaign, status }) => {
    const matchesSearch =
      campaign.employerName.toLowerCase().includes(searchFilter.toLowerCase()) ||
      campaign.requirement.role.toLowerCase().includes(searchFilter.toLowerCase()) ||
      campaign.requirement.locations.some((l) => l.toLowerCase().includes(searchFilter.toLowerCase()));
    
    if (!matchesSearch) return false;
    if (statusFilter === 'all') return true;
    return status === statusFilter;
  });

  const handleApprove = (campaignId: string) => {
    toggleCampaignConsent(campaignId, true);
    setSuccessToast(`Granted visibility permissions for ${campaigns.find((c) => c.id === campaignId)?.employerName}`);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const handleOpenDenialModal = (campaignId: string) => {
    setDenialModalCampaignId(campaignId);
    setCustomDenialReason('');
  };

  const handleConfirmDenial = () => {
    if (!denialModalCampaignId) return;
    const finalReason = customDenialReason.trim() ? customDenialReason : selectedDenialPreset;
    toggleCampaignConsent(denialModalCampaignId, false, finalReason);
    setDenialModalCampaignId(null);
    setSuccessToast(`Revoked visibility permissions and locked data for this campaign.`);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const approvedCount = campaignConsentList.filter((c) => c.status === 'approved').length;
  const deniedCount = campaignConsentList.filter((c) => c.status === 'denied').length;
  const pendingCount = campaignConsentList.filter((c) => c.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {successToast && (
        <div className="bg-[#181818] border-l-4 border-[#CCFF00] border-y border-r border-[#333333] text-white px-4 py-3 flex items-center justify-between text-xs font-mono font-bold">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-[#CCFF00] shrink-0" />
            <span>{successToast}</span>
          </div>
          <span className="text-[10px] text-[#888888] uppercase">Privacy Setting Saved</span>
        </div>
      )}

      {/* Core Principle Banner */}
      <div className="bg-[#111111] p-6 border border-[#333333] relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-[#CCFF00] flex items-center space-x-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>STUDENT PRIVACY CONTROLS</span>
            </div>
            <h2 className="text-xl font-black uppercase italic tracking-tight text-white mt-1">
              Company Permissions & Profile Sharing
            </h2>
            <p className="text-xs text-[#888888] mt-1 max-w-3xl font-sans leading-relaxed">
              <strong className="text-white">You are in complete control of your data.</strong> Even if your college verifies you for campus placement drives, companies cannot view your personal details, GitHub code, or test scores without your permission.
            </p>
          </div>

          {/* Quick Bulk Actions */}
          <div className="flex items-center space-x-2 shrink-0">
            <button
              id="bulk-grant-btn"
              onClick={grantAllCampaignConsents}
              className="px-3.5 py-2 bg-[#CCFF00] hover:bg-[#b8e600] text-black font-mono font-black uppercase text-xs transition-all flex items-center space-x-1.5 cursor-pointer shadow-md"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Allow All Companies</span>
            </button>
            <button
              id="bulk-revoke-btn"
              onClick={revokeAllCampaignConsents}
              className="px-3.5 py-2 bg-[#222222] hover:bg-rose-950 hover:text-rose-400 text-[#888888] font-mono font-bold uppercase text-xs border border-[#333333] transition-colors flex items-center space-x-1.5 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Hide from All</span>
            </button>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="mt-5 pt-4 border-t border-[#222222] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className="bg-[#181818] p-3 border border-[#222222]">
            <span className="text-[10px] text-[#888888] uppercase block">ACTIVE COMPANIES</span>
            <strong className="text-lg font-black text-white">{campaigns.length}</strong>
          </div>
          <div className="bg-[#181818] p-3 border border-[#222222]">
            <span className="text-[10px] text-[#CCFF00] uppercase block">PROFILE SHARED</span>
            <strong className="text-lg font-black text-[#CCFF00]">{approvedCount}</strong>
          </div>
          <div className="bg-[#181818] p-3 border border-[#222222]">
            <span className="text-[10px] text-rose-400 uppercase block">HIDDEN / BLOCKED</span>
            <strong className="text-lg font-black text-rose-400">{deniedCount}</strong>
          </div>
          <div className="bg-[#181818] p-3 border border-[#222222]">
            <span className="text-[10px] text-[#AAAAAA] uppercase block">AWAITING YOUR CHOICE</span>
            <strong className="text-lg font-black text-white">{pendingCount}</strong>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-[#111111] p-4 border border-[#333333] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 font-mono text-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#666666] absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search by company name, job role, or city..."
            className="w-full pl-9 pr-4 py-2 bg-[#181818] text-white border border-[#333333] focus:border-[#CCFF00] focus:outline-none placeholder-[#666666]"
          />
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center space-x-1 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-[#888888] mr-2 text-[10px] uppercase">STATUS:</span>
          {[
            { id: 'all', label: 'All' },
            { id: 'approved', label: 'Allowed' },
            { id: 'denied', label: 'Hidden' },
            { id: 'pending', label: 'Pending' },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setStatusFilter(st.id as any)}
              className={`px-2.5 py-1 text-[11px] font-bold uppercase transition-colors cursor-pointer border ${
                statusFilter === st.id
                  ? 'bg-[#CCFF00] text-black border-[#CCFF00]'
                  : 'bg-[#181818] text-[#888888] hover:text-white border-[#333333]'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Campaign List */}
      <div className="space-y-4">
        {filteredCampaigns.length === 0 ? (
          <div className="p-8 text-center bg-[#111111] border border-[#333333] text-[#888888] text-xs font-mono">
            No recruitment drives match your filters.
          </div>
        ) : (
          filteredCampaigns.map(({ campaign, consent, status }) => {
            const isApproved = status === 'approved';
            const isDenied = status === 'denied';
            const isPending = status === 'pending';
            const isExpanded = expandedCampaignId === campaign.id;

            return (
              <div
                key={campaign.id}
                className={`bg-[#111111] border transition-all ${
                  isApproved
                    ? 'border-[#333333] border-l-4 border-l-[#CCFF00]'
                    : isDenied
                    ? 'border-[#333333] border-l-4 border-l-rose-500/80 opacity-90'
                    : 'border-[#333333] border-l-4 border-l-amber-500'
                }`}
              >
                {/* Main Campaign Row */}
                <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-black text-base uppercase text-white tracking-tight flex items-center space-x-1.5">
                        <Building2 className="w-4 h-4 text-[#CCFF00]" />
                        <span>{campaign.employerName}</span>
                      </span>

                      {/* Status Tag */}
                      {isApproved && (
                        <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-bold uppercase bg-[#182410] text-[#CCFF00] border border-[#CCFF00]/40">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          PROFILE VISIBLE
                        </span>
                      )}
                      {isDenied && (
                        <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-bold uppercase bg-rose-950/60 text-rose-400 border border-rose-800">
                          <XCircle className="w-3 h-3 mr-1" />
                          PROFILE HIDDEN
                        </span>
                      )}
                      {isPending && (
                        <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-bold uppercase bg-[#222222] text-amber-400 border border-amber-800">
                          <Clock className="w-3 h-3 mr-1" />
                          APPROVAL PENDING
                        </span>
                      )}
                    </div>

                    <h4 className="text-xs font-mono font-bold text-[#CCFF00] uppercase">
                      {campaign.requirement.role}
                    </h4>

                    <div className="text-xs font-mono text-[#888888] flex flex-wrap items-center gap-3">
                      <span>Salary: <strong className="text-white">₹{campaign.requirement.salaryMinLPA} - {campaign.requirement.salaryMaxLPA} LPA</strong></span>
                      <span>//</span>
                      <span>Locations: <strong className="text-white">{campaign.requirement.locations.join(', ')}</strong></span>
                      <span>//</span>
                      <span>Openings: <strong className="text-white">{campaign.requirement.vacancies}</strong></span>
                    </div>

                    {/* Denial Reason Display */}
                    {isDenied && consent.reasonForDenial && (
                      <div className="mt-2 text-xs font-mono text-rose-300 bg-rose-950/40 px-3 py-1.5 border border-rose-900/60 flex items-start space-x-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                        <span><strong>Reason profile is hidden:</strong> {consent.reasonForDenial}</span>
                      </div>
                    )}
                  </div>

                  {/* Consent Toggle & Action Controls */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <div className="bg-[#181818] p-1 border border-[#333333] flex items-center space-x-1 font-mono text-xs font-bold">
                      <button
                        id={`approve-consent-${campaign.id}`}
                        onClick={() => handleApprove(campaign.id)}
                        className={`px-3 py-1.5 transition-all uppercase flex items-center space-x-1 cursor-pointer ${
                          isApproved
                            ? 'bg-[#CCFF00] text-black font-black'
                            : 'text-[#888888] hover:text-white hover:bg-[#222222]'
                        }`}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>ALLOW</span>
                      </button>

                      <button
                        id={`deny-consent-${campaign.id}`}
                        onClick={() => handleOpenDenialModal(campaign.id)}
                        className={`px-3 py-1.5 transition-all uppercase flex items-center space-x-1 cursor-pointer ${
                          isDenied
                            ? 'bg-rose-600 text-white font-black'
                            : 'text-[#888888] hover:text-rose-400 hover:bg-[#222222]'
                        }`}
                      >
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>HIDE</span>
                      </button>
                    </div>

                    {/* Customize details button */}
                    <button
                      onClick={() => setExpandedCampaignId(isExpanded ? null : campaign.id)}
                      className={`px-2.5 py-1.5 text-xs font-mono uppercase border transition-colors flex items-center space-x-1 cursor-pointer ${
                        isExpanded
                          ? 'bg-[#222222] text-[#CCFF00] border-[#CCFF00]'
                          : 'bg-[#181818] text-[#AAAAAA] hover:text-white border-[#333333]'
                      }`}
                      title="Choose which profile details to share"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>DETAILS</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Granular Scope Customization Drawer */}
                {isExpanded && (
                  <div className="bg-[#0D0D0D] p-5 border-t border-[#222222] space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Sliders className="w-4 h-4 text-[#CCFF00]" />
                        <h5 className="font-mono text-xs font-bold uppercase text-white">
                          Choose what {campaign.employerName} recruiters can see:
                        </h5>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {/* Scope 1: Academic Data */}
                      <div
                        onClick={() =>
                          isApproved &&
                          updateCampaignConsentScope(
                            campaign.id,
                            'academicDataShared',
                            !consent.academicDataShared
                          )
                        }
                        className={`p-3 border font-mono text-xs transition-all cursor-pointer ${
                          !isApproved
                            ? 'opacity-40 cursor-not-allowed bg-[#141414] border-[#222222]'
                            : consent.academicDataShared
                            ? 'bg-[#181818] border-[#CCFF00] text-white'
                            : 'bg-[#141414] border-[#333333] text-[#888888]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold uppercase text-[11px]">Academic & Marks</span>
                          <span
                            className={`w-3.5 h-3.5 rounded-none flex items-center justify-center text-[10px] font-black ${
                              consent.academicDataShared ? 'bg-[#CCFF00] text-black' : 'border border-[#555555]'
                            }`}
                          >
                            {consent.academicDataShared ? '✓' : ''}
                          </span>
                        </div>
                        <p className="text-[10px] text-[#888888]">
                          {consent.academicDataShared ? 'Shared (CGPA, Branch, Year)' : 'Hidden'}
                        </p>
                      </div>

                      {/* Scope 2: Skill Benchmarks */}
                      <div
                        onClick={() =>
                          isApproved &&
                          updateCampaignConsentScope(
                            campaign.id,
                            'skillBenchmarksShared',
                            !consent.skillBenchmarksShared
                          )
                        }
                        className={`p-3 border font-mono text-xs transition-all cursor-pointer ${
                          !isApproved
                            ? 'opacity-40 cursor-not-allowed bg-[#141414] border-[#222222]'
                            : consent.skillBenchmarksShared
                            ? 'bg-[#181818] border-[#CCFF00] text-white'
                            : 'bg-[#141414] border-[#333333] text-[#888888]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold uppercase text-[11px]">Coding Scores</span>
                          <span
                            className={`w-3.5 h-3.5 rounded-none flex items-center justify-center text-[10px] font-black ${
                              consent.skillBenchmarksShared ? 'bg-[#CCFF00] text-black' : 'border border-[#555555]'
                            }`}
                          >
                            {consent.skillBenchmarksShared ? '✓' : ''}
                          </span>
                        </div>
                        <p className="text-[10px] text-[#888888]">
                          {consent.skillBenchmarksShared ? 'Shared (Test Percentiles & Badges)' : 'Hidden'}
                        </p>
                      </div>

                      {/* Scope 3: Project Repositories */}
                      <div
                        onClick={() =>
                          isApproved &&
                          updateCampaignConsentScope(
                            campaign.id,
                            'projectReposShared',
                            !consent.projectReposShared
                          )
                        }
                        className={`p-3 border font-mono text-xs transition-all cursor-pointer ${
                          !isApproved
                            ? 'opacity-40 cursor-not-allowed bg-[#141414] border-[#222222]'
                            : consent.projectReposShared
                            ? 'bg-[#181818] border-[#CCFF00] text-white'
                            : 'bg-[#141414] border-[#333333] text-[#888888]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold uppercase text-[11px]">GitHub Projects</span>
                          <span
                            className={`w-3.5 h-3.5 rounded-none flex items-center justify-center text-[10px] font-black ${
                              consent.projectReposShared ? 'bg-[#CCFF00] text-black' : 'border border-[#555555]'
                            }`}
                          >
                            {consent.projectReposShared ? '✓' : ''}
                          </span>
                        </div>
                        <p className="text-[10px] text-[#888888]">
                          {consent.projectReposShared ? 'Shared (Project links & Code)' : 'Hidden'}
                        </p>
                      </div>

                      {/* Scope 4: Contact Info */}
                      <div
                        onClick={() =>
                          isApproved &&
                          updateCampaignConsentScope(
                            campaign.id,
                            'contactInfoShared',
                            !consent.contactInfoShared
                          )
                        }
                        className={`p-3 border font-mono text-xs transition-all cursor-pointer ${
                          !isApproved
                            ? 'opacity-40 cursor-not-allowed bg-[#141414] border-[#222222]'
                            : consent.contactInfoShared
                            ? 'bg-[#181818] border-[#CCFF00] text-white'
                            : 'bg-[#141414] border-[#333333] text-[#888888]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold uppercase text-[11px]">Email & Contact</span>
                          <span
                            className={`w-3.5 h-3.5 rounded-none flex items-center justify-center text-[10px] font-black ${
                              consent.contactInfoShared ? 'bg-[#CCFF00] text-black' : 'border border-[#555555]'
                            }`}
                          >
                            {consent.contactInfoShared ? '✓' : ''}
                          </span>
                        </div>
                        <p className="text-[10px] text-[#888888]">
                          {consent.contactInfoShared ? 'Shared (Email & Phone)' : 'Hidden'}
                        </p>
                      </div>
                    </div>

                    {!isApproved && (
                      <p className="text-[11px] font-mono text-amber-400">
                        💡 To customize which details are shared, first click <strong>ALLOW</strong> above.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Denial Reason Modal */}
      {denialModalCampaignId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-[#333333] max-w-lg w-full p-6 shadow-2xl space-y-4 font-mono text-xs text-[#F5F5F5]">
            <div className="flex items-center justify-between pb-3 border-b border-[#222222]">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-5 h-5 text-rose-500" />
                <h3 className="font-black text-sm uppercase text-white">
                  Hide Profile from Company
                </h3>
              </div>
              <button
                onClick={() => setDenialModalCampaignId(null)}
                className="text-[#888888] hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-[#AAAAAA] font-sans">
              You are choosing to hide your profile from{' '}
              <strong className="text-white">
                {campaigns.find((c) => c.id === denialModalCampaignId)?.employerName}
              </strong>
              . This employer will not be able to see your personal details or contact you.
            </p>

            <div className="space-y-2">
              <label className="text-[10px] uppercase text-[#888888] block">Select Reason (Optional):</label>
              <div className="space-y-1.5">
                {denialPresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setSelectedDenialPreset(preset)}
                    className={`w-full text-left p-2 border transition-all text-xs cursor-pointer ${
                      selectedDenialPreset === preset
                        ? 'bg-[#222222] border-[#CCFF00] text-white'
                        : 'bg-[#181818] border-[#333333] text-[#888888] hover:text-white'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase text-[#888888] block">Or Custom Reason:</label>
              <input
                type="text"
                value={customDenialReason}
                onChange={(e) => setCustomDenialReason(e.target.value)}
                placeholder="e.g., Looking for remote or Bangalore roles only..."
                className="w-full bg-[#181818] text-white p-2.5 border border-[#333333] focus:border-[#CCFF00] focus:outline-none"
              />
            </div>

            <div className="pt-3 border-t border-[#222222] flex items-center justify-end space-x-2">
              <button
                onClick={() => setDenialModalCampaignId(null)}
                className="px-4 py-2 bg-[#181818] text-[#888888] hover:text-white uppercase font-bold border border-[#333333] cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="confirm-denial-btn"
                onClick={handleConfirmDenial}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white uppercase font-black cursor-pointer flex items-center space-x-1.5 shadow-lg"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Hide My Profile</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
