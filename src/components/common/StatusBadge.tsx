import React from 'react';
import { CallStatus, RecruitmentStage } from '../../types';

export const CallStatusBadge: React.FC<{ status: CallStatus }> = ({ status }) => {
  switch (status) {
    case 'accepted':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 text-[11px] font-mono font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
          Accepted
        </span>
      );
    case 'partial':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 text-[11px] font-mono font-bold uppercase tracking-wider bg-sky-50 text-sky-700 border border-sky-200 rounded-md">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-500 mr-1.5"></span>
          Partial Supply
        </span>
      );
    case 'counter':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 text-[11px] font-mono font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 rounded-md">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 animate-pulse"></span>
          Counter Proposed
        </span>
      );
    case 'declined':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 text-[11px] font-mono font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 rounded-md">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5"></span>
          Declined
        </span>
      );
    case 'pending':
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 text-[11px] font-mono font-bold uppercase tracking-wider bg-slate-50 text-slate-600 border border-slate-200 rounded-md">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5 animate-pulse"></span>
          Awaiting Response
        </span>
      );
  }
};

export const StageBadge: React.FC<{ stage: RecruitmentStage }> = ({ stage }) => {
  switch (stage) {
    case 'invited':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 text-[11px] font-mono font-bold uppercase tracking-wider bg-slate-50 text-slate-500 border border-slate-200 rounded-md">
          Invited (Pending Approval)
        </span>
      );
    case 'consented':
    case 'assessment_pending':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 text-[11px] font-mono font-bold uppercase tracking-wider bg-sky-50 text-sky-700 border border-sky-200 rounded-md">
          Applied & Profile Shared
        </span>
      );
    case 'assessment_completed':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 text-[11px] font-mono font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200 rounded-md">
          Test Completed
        </span>
      );
    case 'shortlisted':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 text-[11px] font-mono font-bold uppercase tracking-wider bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-md">
          Shortlisted
        </span>
      );
    case 'interviewing':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 text-[11px] font-mono font-bold uppercase tracking-wider bg-orange-50 text-orange-700 border border-orange-200 rounded-md">
          Interview Scheduled
        </span>
      );
    case 'offered':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 text-[11px] font-mono font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md shadow-sm">
          Offer Letter Issued
        </span>
      );
    case 'accepted':
    case 'joined':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 text-[11px] font-mono font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md">
          ★ Offer Accepted & Placed
        </span>
      );
    case 'declined':
    case 'rejected':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 text-[11px] font-mono font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 rounded-md">
          {stage === 'declined' ? 'Declined / Passed' : 'Not Selected'}
        </span>
      );
    default:
      return null;
  }
};
