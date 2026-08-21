import React, { useState } from 'react';
import { useTalentNetwork } from '../../context/TalentNetworkContext';
import { 
  Building2, 
  GraduationCap, 
  Briefcase, 
  FileText, 
  BarChart3, 
  Activity, 
  Search,
  ShieldAlert
} from 'lucide-react';

export const SuperAdminPortal: React.FC = () => {
  const { 
    employers, 
    institutions, 
    students, 
    requirements, 
    callsForTalent, 
    campaigns,
    studentOpportunities
  } = useTalentNetwork();

  const [activeTab, setActiveTab] = useState<'overview' | 'employers' | 'institutions' | 'students'>('overview');
  
  const totalOffersMade = studentOpportunities.filter(o => ['offered', 'accepted', 'joined'].includes(o.stage)).length;
  const totalOffersAccepted = studentOpportunities.filter(o => ['accepted', 'joined'].includes(o.stage)).length;

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="bg-[#111111] p-6 border border-[#222222]">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-[#CCFF00] text-black shrink-0">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-black uppercase italic tracking-tight text-white mb-1">
              Global Network Command
            </h1>
            <p className="text-sm font-mono text-[#888888]">
              Super Administrator Dashboard • System Overview & Telemetry
            </p>
          </div>
        </div>
      </div>

      {/* METRICS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Registered Employers', value: employers.length, icon: <Briefcase className="w-4 h-4" /> },
          { label: 'Partner Colleges', value: institutions.length, icon: <Building2 className="w-4 h-4" /> },
          { label: 'Verified Students', value: students.length, icon: <GraduationCap className="w-4 h-4" /> },
          { label: 'Active Demands', value: requirements.length, icon: <FileText className="w-4 h-4" /> }
        ].map((metric, idx) => (
          <div key={idx} className="bg-[#111111] border border-[#222222] p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[#888888] mb-4">
              <span className="text-xs font-mono font-bold uppercase">{metric.label}</span>
              {metric.icon}
            </div>
            <div className="text-3xl font-black text-white">{metric.value}</div>
          </div>
        ))}
      </div>

      {/* NETWORK TELEMETRY */}
      <div className="bg-[#111111] border border-[#222222] p-6">
        <h2 className="text-xl font-bold uppercase tracking-tight text-white mb-6 flex items-center gap-2">
          <Activity className="w-5 h-5 text-[#CCFF00]" />
          Platform Telemetry & Match Velocity
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 bg-[#181818] border border-[#333333]">
            <div className="text-sm font-mono text-[#AAAAAA] mb-2">Total Institutional Calls</div>
            <div className="text-2xl font-black text-white">{callsForTalent.length}</div>
            <div className="text-xs text-[#888888] mt-2">Employer to College Gateway</div>
          </div>
          
          <div className="p-4 bg-[#181818] border border-[#333333]">
            <div className="text-sm font-mono text-[#AAAAAA] mb-2">Student Opportunities Sent</div>
            <div className="text-2xl font-black text-[#CCFF00]">{studentOpportunities.length}</div>
            <div className="text-xs text-[#888888] mt-2">Candidate Evaluation Layer</div>
          </div>
          
          <div className="p-4 bg-[#181818] border border-[#333333]">
            <div className="text-sm font-mono text-[#AAAAAA] mb-2">Offers Accepted</div>
            <div className="text-2xl font-black text-white">{totalOffersAccepted} <span className="text-sm text-[#888888] font-medium ml-1">/ {totalOffersMade} Made</span></div>
            <div className="text-xs text-[#888888] mt-2">Conversion Metric</div>
          </div>
        </div>
      </div>
    </div>
  );
};
