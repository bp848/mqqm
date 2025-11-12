import React, { useState, useMemo } from 'react';
import { Lead, LeadStatus, SortConfig, Toast, ConfirmationDialogProps, EmployeeUser } from '../../types.ts';
import { Loader, Pencil, Trash2, Mail, Eye, CheckCircle, Lightbulb, List, KanbanSquare } from '../Icons.tsx';
import { LeadDetailModal } from './LeadDetailModal.tsx';
import LeadStatusBadge from './LeadStatusBadge.tsx';
import LeadKanbanView from './LeadKanbanView.tsx';
import { generateLeadReplyEmail } from '../../services/geminiService.ts';
import { formatDate, formatDateTime, createSignature } from '../../utils.ts';
import EmptyState from '../ui/EmptyState.tsx';
import SortableHeader from '../ui/SortableHeader.tsx';
import LeadSummaryCards from './LeadSummaryCards.tsx';

interface LeadManagementPageProps {
  leads: Lead[];
  searchTerm: string;
  onRefresh: () => void;
  onUpdateLead: (leadId: string, updatedData: Partial<Lead>) => Promise<void>;
  onDeleteLead: (leadId: string) => Promise<void>;
  addToast: (message: string, type: Toast['type']) => void;
  requestConfirmation: (dialog: Omit<ConfirmationDialogProps, 'isOpen' | 'onClose'>) => void;
  currentUser: EmployeeUser | null;
  isAIOff: boolean;
  onAddEstimate: (estimate: any) => Promise<void>;
}

const LeadManagementPage: React.FC<LeadManagementPageProps> = ({ leads, searchTerm, onRefresh, onUpdateLead, onDeleteLead, addToast, requestConfirmation, currentUser, isAIOff, onAddEstimate }) => {
    const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'updatedAt', direction: 'descending' }); // Changed default sort key to updatedAt
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [selectedLeadIndex, setSelectedLeadIndex] = useState<number>(0);
    const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
    const [editingStatusLeadId, setEditingStatusLeadId] = useState<string | null>(null);
    const [isMarkingContacted, setIsMarkingContacted] = useState<string | null>(null);

    const handleRowClick = (lead: Lead) => {
        setSelectedLead(lead);
        const index = sortedLeads.findIndex(l => l.id === lead.id);
        setSelectedLeadIndex(index);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedLead(null);
        setSelectedLeadIndex(0);
    };
    
    const handleNavigateLead = (index: number) => {
        if (index >= 0 && index < sortedLeads.length) {
            setSelectedLeadIndex(index);
            setSelectedLead(sortedLeads[index]);
        }
    };

    const handleSaveLead = async (leadId: string, updatedData: Partial<Lead>) => {
        await onUpdateLead(leadId, updatedData);
        if (selectedLead && selectedLead.id === leadId) {
            setSelectedLead(prev => prev ? { ...prev, ...updatedData } as Lead : null);
        }
    };
    
    const handleDeleteClick = (e: React.MouseEvent, lead: Lead) => {
        e.stopPropagation();
        requestConfirmation({
            title: 'リードの削除',
            message: `本当にリード「${lead.company} / ${lead.name}」を削除しますか？この操作は元に戻せません。`,
            onConfirm: async () => {
                await onDeleteLead(lead.id);
                if (selectedLead && selectedLead.id === lead.id) {
                    handleCloseModal();
                }
            }
        });
    };
    
    const handleGenerateReplyFromList = async (lead: Lead) => {
        if (!lead.email) {
            addToast('返信先のメールアドレスが登録されていません。', 'error');
            return;
        }
        if (!currentUser) {
            addToast('ログインユーザー情報が見つかりません。', 'error');
            return;
        }
        try {
            const { subject, bodyText } = await generateLeadReplyEmail(lead);
            const signature = createSignature();
            const finalBody = `${bodyText}\n\n${signature}`.trim();

            const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${lead.email}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(finalBody)}`;
            window.open(gmailUrl, '_blank');
            
            const timestamp = formatDateTime(new Date().toISOString());
            const logMessage = `[${timestamp}] AI返信メールを作成しました。`;
            const updatedInfo = `${logMessage}\n${lead.infoSalesActivity || ''}`.trim();
            
            await onUpdateLead(lead.id, { 
                infoSalesActivity: updatedInfo, 
                status: LeadStatus.Contacted,
                updatedAt: new Date().toISOString(),
            });
            addToast('Gmailの下書きを作成しました。', 'success');
        } catch (error) {
            addToast(error instanceof Error ? error.message : 'AIによるメール作成に失敗しました。', 'error');
        }
    };


    const handleMarkContacted = async (e: React.MouseEvent, lead: Lead) => {
        e.stopPropagation();
        setIsMarkingContacted(lead.id);
        try {
            const timestamp = formatDateTime(new Date().toISOString());
            const logMessage = `[${timestamp}] ステータスを「${lead.status}」から「${LeadStatus.Contacted}」に変更しました。`;
            const updatedInfo = `${logMessage}\n${lead.infoSalesActivity || ''}`.trim();

            await onUpdateLead(lead.id, {
                status: LeadStatus.Contacted,
                infoSalesActivity: updatedInfo,
                updatedAt: new Date().toISOString(),
            });
            addToast('ステータスを「コンタクト済」に更新しました。', 'success');
        } catch (error) {
            addToast(error instanceof Error ? error.message : 'ステータスの更新に失敗しました。', 'error');
        } finally {
            setIsMarkingContacted(null);
        }
    };

    const filteredLeads = useMemo(() => {
        if (!searchTerm) return leads;
        const lower = searchTerm.toLowerCase();
        return leads.filter(l => 
            l.name.toLowerCase().includes(lower) ||
            l.company.toLowerCase().includes(lower) ||
            l.status.toLowerCase().includes(lower) ||
            (l.source && l.source.toLowerCase().includes(lower))
        );
    }, [leads, searchTerm]);

    const sortedLeads = useMemo(() => {
        let sortableItems = [...filteredLeads];
        if (sortConfig) {
            sortableItems.sort((a, b) => {
                let aVal: any = a[sortConfig.key as keyof Lead];
                let bVal: any = b[sortConfig.key as keyof Lead];

                if (sortConfig.key === 'inquiryTypes') {
                    aVal = a.inquiryTypes ? a.inquiryTypes.join(', ') : (a.inquiryType || '');
                    bVal = b.inquiryTypes ? b.inquiryTypes.join(', ') : (b.inquiryType || '');
                }
                
                if (sortConfig.key === 'updatedAt') {
                    aVal = a.updatedAt || a.createdAt;
                    bVal = b.updatedAt || b.createdAt;
                }
                if (sortConfig.key === 'createdAt') {
                    aVal = a.createdAt;
                    bVal = b.createdAt;
                }

                if (aVal === null || aVal === undefined) return 1;
                if (bVal === null || bVal === undefined) return -1;
                
                if (String(aVal).toLowerCase() < String(bVal).toLowerCase()) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (String(aVal).toLowerCase() > String(bVal).toLowerCase()) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [filteredLeads, sortConfig]);

    const requestSort = (key: string) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    return (
        <>
            <LeadSummaryCards leads={leads} />

            <div className="flex justify-end mb-4">
                <div className="flex items-center p-1 bg-slate-200 dark:bg-slate-700 rounded-lg">
                    <button onClick={() => setViewMode('list')} className={`px-3 py-1 rounded-md text-sm font-semibold flex items-center gap-2 ${viewMode === 'list' ? 'bg-white dark:bg-slate-800 shadow text-slate-800 dark:text-white' : 'text-slate-500 dark:text-slate-300'}`}>
                        <List className="w-4 h-4" /> リスト
                    </button>
                    <button onClick={() => setViewMode('kanban')} className={`px-3 py-1 rounded-md text-sm font-semibold flex items-center gap-2 ${viewMode === 'kanban' ? 'bg-white dark:bg-slate-800 shadow text-slate-800 dark:text-white' : 'text-slate-500 dark:text-slate-300'}`}>
                        <KanbanSquare className="w-4 h-4" /> カンバン
                    </button>
                </div>
            </div>

            {viewMode === 'list' ? (
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-base text-left text-slate-500 dark:text-slate-400">
                            <thead className="text-sm text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-300">
                                <tr>
                                    <SortableHeader sortKey="createdAt" label="受信日時" sortConfig={sortConfig} requestSort={requestSort} />
                                    <SortableHeader sortKey="updatedAt" label="最終更新日時" sortConfig={sortConfig} requestSort={requestSort} />
                                    <SortableHeader sortKey="company" label="会社名 / 担当者" sortConfig={sortConfig} requestSort={requestSort} />
                                    <SortableHeader sortKey="status" label="ステータス" sortConfig={sortConfig} requestSort={requestSort} />
                                    <SortableHeader sortKey="inquiryTypes" label="問い合わせ種別" sortConfig={sortConfig} requestSort={requestSort} />
                                    <SortableHeader sortKey="email" label="メール" sortConfig={sortConfig} requestSort={requestSort} />
                                    <th scope="col" className="px-6 py-3 font-medium text-center">操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedLeads.map((lead) => (
                                    <tr 
                                      key={lead.id} 
                                      className="group bg-white dark:bg-slate-800 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 cursor-pointer odd:bg-slate-50 dark:odd:bg-slate-800/50"
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap text-sm" onClick={() => handleRowClick(lead)}>{formatDateTime(lead.createdAt)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm" onClick={() => handleRowClick(lead)}>{formatDateTime(lead.updatedAt || lead.createdAt)}</td>
                                        <td className="px-6 py-4" onClick={() => handleRowClick(lead)}>
                                            <div className="font-semibold text-slate-800 dark:text-slate-200">
                                                {lead.company} <span className="font-normal text-slate-500">/ {lead.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                            {editingStatusLeadId === lead.id ? (
                                                <select
                                                    value={lead.status}
                                                    onChange={(e) => {
                                                        const newStatus = e.target.value as LeadStatus;
                                                        onUpdateLead(lead.id, { status: newStatus, updatedAt: new Date().toISOString() });
                                                        setEditingStatusLeadId(null);
                                                    }}
                                                    onBlur={() => setEditingStatusLeadId(null)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    autoFocus
                                                    className="bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg p-1 text-xs focus:ring-blue-500 focus:border-blue-500"
                                                >
                                                    {Object.values(LeadStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                            ) : (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setEditingStatusLeadId(lead.id) }}
                                                    className="w-full text-left relative group/status p-1 flex items-center gap-2"
                                                >
                                                    <LeadStatusBadge status={lead.status} />
                                                    <Pencil className="w-3 h-3 text-slate-400 opacity-0 group-hover/status:opacity-100 transition-opacity" aria-hidden="true" />
                                                </button>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap" onClick={() => handleRowClick(lead)}>
                                            {lead.inquiryTypes && lead.inquiryTypes.length > 0
                                                ? <div className="flex flex-wrap gap-1">{lead.inquiryTypes.slice(0, 2).map((type, index) => <span key={index} className="px-2 py-0.5 text-xs rounded-full bg-slate-200 dark:bg-slate-600">{type}</span>)}</div>
                                                : (lead.inquiryType || '-')
                                            }
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm" onClick={() => handleRowClick(lead)}>{lead.email || '-'}</td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex justify-center items-center gap-2" onClick={e => e.stopPropagation()}>
                                                <button onClick={() => handleRowClick(lead)} className="p-2 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700" title="詳細表示" aria-label={`リード「${lead.company}」の詳細を表示`}>
                                                    <Eye className="w-5 h-5"/>
                                                </button>
                                                {lead.status === LeadStatus.Untouched && (
                                                    <button onClick={(e) => handleMarkContacted(e, lead)} disabled={isMarkingContacted === lead.id} className="p-2 rounded-full text-green-600 hover:bg-green-100 dark:hover:bg-green-900/50 disabled:opacity-50" title="コンタクト済にする" aria-label={`リード「${lead.company}」をコンタクト済みにする`}>
                                                        {isMarkingContacted === lead.id ? <Loader className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                                                    </button>
                                                )}
                                                <button onClick={(e) => { e.stopPropagation(); handleGenerateReplyFromList(lead); }} disabled={isAIOff} className="p-2 rounded-full text-purple-600 hover:bg-purple-100 dark:hover:bg-purple-900/50 disabled:opacity-50" title="AIで返信作成" aria-label={`リード「${lead.company}」へAIで返信を作成`}>
                                                    <Mail className="w-5 h-5" />
                                                </button>
                                                <button onClick={(e) => handleDeleteClick(e, lead)} className="p-2 rounded-full text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50" title="削除" aria-label={`リード「${lead.company}」を削除`}>
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                 {sortedLeads.length === 0 && (
                                    <tr>
                                        <td colSpan={7}>
                                            <EmptyState 
                                                icon={Lightbulb}
                                                title={searchTerm ? '検索結果がありません' : 'リードがありません'}
                                                message={searchTerm ? '検索条件を変更してください。' : '「新規作成」から最初のリードを登録してください。'}
                                            />
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <LeadKanbanView leads={filteredLeads} onUpdateLead={onUpdateLead} onCardClick={handleRowClick} />
            )}
            <LeadDetailModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                lead={selectedLead}
                allLeads={sortedLeads}
                currentLeadIndex={selectedLeadIndex}
                onNavigateLead={handleNavigateLead}
                onSave={handleSaveLead}
                onDelete={onDeleteLead}
                addToast={addToast}
                requestConfirmation={requestConfirmation}
                currentUser={currentUser}
                isAIOff={isAIOff}
                onAddEstimate={onAddEstimate}
            />
        </>
    );
};

export default LeadManagementPage;