import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Estimate, SortConfig, EmployeeUser, Customer, Job, JobStatus, InvoiceStatus, Page, Toast, EstimateItem, EstimateStatus } from '../../types.ts';
import SortableHeader from '../ui/SortableHeader.tsx';
import EmptyState from '../ui/EmptyState.tsx';
import { FileText, PlusCircle, Loader, Sparkles, Trash2, Send, X, Save, Eye, Pencil } from '../Icons.tsx';
import { formatJPY, formatDate } from '../../utils.ts';
// Removed: import { createDraftEstimate } from '../../services/geminiService';
import EstimateDetailModal from './EstimateDetailModal.tsx';

declare const jspdf: any;
declare const html2canvas: any;

// Main Page Component
interface EstimateManagementPageProps { // Renamed from ProjectManagementPageProps
  estimates: Estimate[]; // Changed from projects
  customers: Customer[];
  allUsers: EmployeeUser[];
  // onAddEstimate: (estimate: Omit<Estimate, 'id' | 'createdAt' | 'updatedAt' | 'estimateNumber'>) => Promise<void>; // This is now handled by EstimateCreationPage
  addToast: (message: string, type: Toast['type']) => void;
  currentUser: EmployeeUser | null;
  searchTerm: string;
  isAIOff: boolean;
  onNavigateToCreate: (page: Page) => void; // Added for navigation to new creation page
}

const EstimateManagementPage: React.FC<EstimateManagementPageProps> = ({ estimates, customers, allUsers, addToast, currentUser, searchTerm, isAIOff, onNavigateToCreate }) => { // Renamed from ProjectManagementPage
    const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'estimateNumber', direction: 'descending' }); // Changed sort key to estimateNumber
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedEstimate, setSelectedEstimate] = useState<Estimate | null>(null); // Changed from selectedProject

    const filteredEstimates = useMemo(() => { // Changed from filteredProjects
        if (!searchTerm) return estimates; // Changed from projects
        const lower = searchTerm.toLowerCase();
        return estimates.filter(e => e.customerName.toLowerCase().includes(lower) || e.title.toLowerCase().includes(lower)); // Changed filter logic
    }, [estimates, searchTerm]); // Changed from projects

    const sortedEstimates = useMemo(() => { // Changed from sortedProjects
        let sortable = [...filteredEstimates]; // Changed from filteredProjects
        if (sortConfig) {
            sortable.sort((a, b) => {
                const aVal = a[sortConfig.key as keyof Estimate]; // Changed keyof Project to keyof Estimate
                const bVal = b[sortConfig.key as keyof Estimate]; // Changed keyof Project to keyof Estimate
                if (aVal < bVal) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return sortable;
    }, [filteredEstimates, sortConfig]); // Changed from filteredProjects

    const requestSort = (key: string) => {
        const direction = sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending' ? 'descending' : 'ascending';
        setSortConfig({ key, direction });
    };
    
    const handleOpenDetail = (estimate: Estimate) => { // Changed from project
        setSelectedEstimate(estimate); // Changed from setSelectedProject
        setIsDetailModalOpen(true);
    };

    const handleCreateNewEstimate = () => { // Changed from handleCreateNewProject
      onNavigateToCreate('estimate_creation'); // Navigate to the new creation page
    };


    return (
        <>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-6 flex justify-between items-center">
                    <h2 className="text-xl font-semibold">見積一覧</h2> {/* Changed title */}
                    <div className="flex items-center gap-4">
                        <button onClick={handleCreateNewEstimate} className="flex items-center gap-2 bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg">
                            <PlusCircle className="w-5 h-5" />
                            新規見積作成
                        </button> {/* Changed button text */}
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-base text-left">
                        <thead className="text-sm uppercase bg-slate-50 dark:bg-slate-700">
                            <tr>
                                <SortableHeader sortKey="estimateNumber" label="見積番号" sortConfig={sortConfig} requestSort={requestSort} /> {/* Changed sortKey and label */}
                                <SortableHeader sortKey="customerName" label="顧客名" sortConfig={sortConfig} requestSort={requestSort} />
                                <th scope="col" className="px-6 py-3 font-medium">件名</th> {/* Changed label */}
                                <SortableHeader sortKey="grandTotal" label="合計金額" sortConfig={sortConfig} requestSort={requestSort} /> {/* Changed sortKey and label */}
                                <SortableHeader sortKey="createdAt" label="作成日" sortConfig={sortConfig} requestSort={requestSort} />
                                <SortableHeader sortKey="status" label="ステータス" sortConfig={sortConfig} requestSort={requestSort} />
                                <th scope="col" className="px-6 py-3 font-medium text-center">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {sortedEstimates.map(est => ( // Changed from sortedProjects.map(proj =>
                                <tr key={est.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                    <td className="px-6 py-4 font-mono">{est.estimateNumber}</td> {/* Changed from proj.projectId */}
                                    <td className="px-6 py-4">{est.customerName}</td>
                                    <td className="px-6 py-4">{est.title}</td> {/* Changed from proj.name */}
                                    <td className="px-6 py-4 font-semibold">{formatJPY(est.grandTotal)}</td> {/* Changed from proj.totalAmount */}
                                    <td className="px-6 py-4">{formatDate(est.createdAt)}</td>
                                    <td className="px-6 py-4">{est.status}</td>
                                    <td className="px-6 py-4 text-center">
                                        <button onClick={() => handleOpenDetail(est)} className="p-2 text-slate-500 hover:text-blue-600"><Eye className="w-5 h-5"/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                     {sortedEstimates.length === 0 && <EmptyState icon={FileText} title="見積がありません" message="最初の見積を作成しましょう。" />} {/* Changed EmptyState message */}
                </div>
            </div>
             {isDetailModalOpen && <EstimateDetailModal // Changed from ProjectDetailModal
                estimate={selectedEstimate!} // Changed from project
                onClose={() => setIsDetailModalOpen(false)}
                // Removed addToast prop here, handle locally if needed in modal
            />}
        </>
    );
};

export default EstimateManagementPage;