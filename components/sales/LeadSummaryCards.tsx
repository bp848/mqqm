import React, { useMemo } from 'react';
import { Lead, LeadStatus } from '../../types.ts';
import StatCard from '../StatCard.tsx';
import { Users, Lightbulb, CheckCircle, TrendingUp } from '../Icons.tsx';

interface LeadSummaryCardsProps {
  leads: Lead[];
}

const LeadSummaryCards: React.FC<LeadSummaryCardsProps> = ({ leads }) => {
  const {
    totalLeads,
    untouchedLeads,
    newLeads,
    contactedLeads,
    qualifiedLeads,
    convertedLeads,
    conversionRate,
  } = useMemo(() => {
    const totalLeads = leads.length;
    const untouchedLeads = leads.filter(l => l.status === LeadStatus.Untouched).length;
    const newLeads = leads.filter(l => l.status === LeadStatus.New).length;
    const contactedLeads = leads.filter(l => l.status === LeadStatus.Contacted).length;
    const qualifiedLeads = leads.filter(l => l.status === LeadStatus.Qualified).length;
    const convertedLeads = leads.filter(l => l.status === LeadStatus.Converted).length;
    
    const convertibleLeads = leads.filter(l => 
        l.status === LeadStatus.Untouched || 
        l.status === LeadStatus.New || 
        l.status === LeadStatus.Contacted || 
        l.status === LeadStatus.Qualified
    ).length;

    const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;

    return {
      totalLeads,
      untouchedLeads,
      newLeads,
      contactedLeads,
      qualifiedLeads,
      convertedLeads,
      conversionRate,
    };
  }, [leads]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <StatCard
        title="総リード数"
        value={totalLeads.toLocaleString()}
        icon={<Users className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />}
      />
      <StatCard
        title="新規リード"
        value={newLeads.toLocaleString()}
        icon={<Lightbulb className="w-6 h-6 text-blue-600 dark:text-blue-400" />}
      />
      <StatCard
        title="有望リード"
        value={qualifiedLeads.toLocaleString()}
        icon={<TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />}
      />
      <StatCard
        title="商談化済み"
        value={`${convertedLeads.toLocaleString()} (${conversionRate.toFixed(1)}%)`}
        icon={<CheckCircle className="w-6 h-6 text-purple-600 dark:text-purple-400" />}
      />
    </div>
  );
};

export default LeadSummaryCards;