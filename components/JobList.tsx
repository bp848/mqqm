import React, { useState, useMemo } from 'react';
import { Job, SortConfig } from '../types.ts';
import JobStatusBadge from './JobStatusBadge.tsx';
import { formatJPY, formatDate } from '../utils.ts';
import EmptyState from './ui/EmptyState.tsx';
import { Briefcase, PlusCircle } from './Icons.tsx';
import SortableHeader from './ui/SortableHeader.tsx';

interface JobListProps {
  jobs: Job[];
  searchTerm: string;
  onSelectJob: (job: Job) => void;
  onNewJob: () => void;
}

const JobList: React.FC<JobListProps> = ({ jobs, searchTerm, onSelectJob, onNewJob }) => {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'jobNumber', direction: 'descending' });

  const filteredJobs = useMemo(() => {
    if (!searchTerm) return jobs;
    const lowercasedTerm = searchTerm.toLowerCase();
    return jobs.filter(job => 
      job.clientName.toLowerCase().includes(lowercasedTerm) ||
      job.title.toLowerCase().includes(lowercasedTerm) ||
      job.jobNumber.includes(lowercasedTerm) // Changed to string includes
    );
  }, [jobs, searchTerm]);

  const requestSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const sortedJobs = useMemo(() => {
    let sortableItems = [...filteredJobs];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key as keyof Job] as any;
        const bValue = b[sortConfig.key as keyof Job] as any;

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortConfig.direction === 'ascending' ? aValue - bValue : bValue - aValue;
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [filteredJobs, sortConfig]);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
      <div className="p-6">
        <h2 className="text-xl font-semibold text-slate-800 dark:text-white">案件一覧</h2>
        <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
          すべての印刷案件とそのステータスを管理します。見出しをクリックしてソートできます。
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-base text-left text-slate-500 dark:text-slate-400">
          <thead className="text-sm text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-300">
            <tr>
              <SortableHeader sortKey="jobNumber" label="案件番号" sortConfig={sortConfig} requestSort={requestSort} />
              <SortableHeader sortKey="clientName" label="クライアント名" sortConfig={sortConfig} requestSort={requestSort} />
              <SortableHeader sortKey="title" label="案件名" sortConfig={sortConfig} requestSort={requestSort} />
              <SortableHeader sortKey="dueDate" label="納期" sortConfig={sortConfig} requestSort={requestSort} />
              <SortableHeader sortKey="status" label="ステータス" sortConfig={sortConfig} requestSort={requestSort} />
              <th scope="col" className="px-6 py-3 text-right">売上高 (P)</th>
              <th scope="col" className="px-6 py-3 text-right">限界利益 (M)</th>
            </tr>
          </thead>
          <tbody>
            {sortedJobs.map((job) => (
              <tr key={job.id} onClick={() => onSelectJob(job)} className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 cursor-pointer">
                <td className="px-6 py-4 font-mono text-sm">{job.jobNumber}</td>
                <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">{job.clientName}</td>
                <td className="px-6 py-4">{job.title}</td>
                <td className="px-6 py-4 whitespace-nowrap">{formatDate(job.dueDate)}</td>
                <td className="px-6 py-4"><JobStatusBadge status={job.status} /></td>
                <td className="px-6 py-4 text-right">¥{job.price.toLocaleString()}</td>
                <td className="px-6 py-4 text-right font-semibold text-blue-600 dark:text-blue-400">¥{(job.price - job.variableCost).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sortedJobs.length === 0 && (
        <EmptyState 
            icon={Briefcase}
            title="案件がありません"
            message="「新規案件作成」ボタンから最初の案件を登録してください。"
            action={{ label: "新規案件作成", onClick: onNewJob, icon: PlusCircle }}
        />
      )}
    </div>
  );
};

export default React.memo(JobList);