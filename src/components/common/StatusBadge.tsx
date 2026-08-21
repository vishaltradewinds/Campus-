import React from 'react';
import { CallStatus, RecruitmentStage } from '../../types';

export const CallStatusBadge: React.FC<{ status: CallStatus }> = ({ status }) => {
  switch (status) {
    case 'accepted':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 text-[11px] font-mono font-bold uppercase tracking-wider bg-[#0F2912] text-[#4ADE80] border border-[#22C55E]/40">
          <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80] mr-1.5 shadow-[0_0_6px_#4ADE80]"></span>
          Accepted
        </span>
      );
    case 'partial':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 text-[11px] font-mono font-bold uppercase tracking-wider bg-[#102A43] text-[#38BDF8] border border-[#0284C7]/40">
          <span className="w-1.5 h-1.5 rounded-full bg-[#38BDF8] mr-1.5"></span>
          Partial Supply
        </span>
      );
    case 'counter':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 text-[11px] font-mono font-bold uppercase tracking-wider bg-[#2D1B00] text-[#FBBF24] border border-[#D97706]/40">
          <span className="w-1.5 h-1.5 rounded-full bg-[#FBBF24] mr-1.5 animate-pulse"></span>
          Counter Proposed
        </span>
      );
    case 'declined':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 text-[11px] font-mono font-bold uppercase tracking-wider bg-[#2A0808] text-[#F87171] border border-[#DC2626]/40">
          <span className="w-1.5 h-1.5 rounded-full bg-[#F87171] mr-1.5"></span>
          Declined
        </span>
      );
    case 'pending':
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 text-[11px] font-mono font-bold uppercase tracking-wider bg-[#181818] text-[#A3A3A3] border border-[#333]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#737373] mr-1.5 animate-pulse"></span>
          Awaiting Response
        </span>
      );
  }
};

export const StageBadge: React.FC<{ stage: RecruitmentStage }> = ({ stage }) => {
  switch (stage) {
    case 'invited':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 text-[11px] font-mono font-bold uppercase tracking-wider bg-[#181818] text-[#A3A3A3] border border-[#333]">
          Invited (Pending Approval)
        </span>
      );
    case 'consented':
    case 'assessment_pending':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 text-[11px] font-mono font-bold uppercase tracking-wider bg-[#1E293B] text-[#38BDF8] border border-[#0284C7]/40">
          Applied & Profile Shared
        </span>
      );
    case 'assessment_completed':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 text-[11px] font-mono font-bold uppercase tracking-wider bg-[#251336] text-[#C084FC] border border-[#9333EA]/40">
          Test Completed
        </span>
      );
    case 'shortlisted':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 text-[11px] font-mono font-bold uppercase tracking-wider bg-[#281E08] text-[#FDE047] border border-[#EAB308]/40">
          Shortlisted
        </span>
      );
    case 'interviewing':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 text-[11px] font-mono font-bold uppercase tracking-wider bg-[#2B1705] text-[#FB923C] border border-[#EA580C]/40">
          Interview Scheduled
        </span>
      );
    case 'offered':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 text-[11px] font-mono font-bold uppercase tracking-wider bg-[#112900] text-[#CCFF00] border border-[#CCFF00]/50 shadow-[0_0_8px_rgba(204,255,0,0.2)]">
          Offer Letter Issued
        </span>
      );
    case 'accepted':
    case 'joined':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 text-[11px] font-mono font-bold uppercase tracking-wider bg-[#064E3B] text-[#34D399] border border-[#059669]">
          ★ Offer Accepted & Placed
        </span>
      );
    case 'declined':
    case 'rejected':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 text-[11px] font-mono font-bold uppercase tracking-wider bg-[#2A0808] text-[#F87171] border border-[#DC2626]/40">
          {stage === 'declined' ? 'Declined / Passed' : 'Not Selected'}
        </span>
      );
    default:
      return null;
  }
};
