import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Lead, LeadStatus, Toast, ConfirmationDialogProps, EmployeeUser, CustomProposalContent, LeadProposalPackage, EstimateStatus, EstimateItem, CompanyInvestigation } from '../../types.ts';
import { X, Save, Loader, Pencil, Trash2, Mail, CheckCircle, Lightbulb, Search, FileText, ArrowRight, ArrowLeft, AlertTriangle, RefreshCw, Sparkles } from '../Icons.tsx';
import LeadStatusBadge from './LeadStatusBadge.tsx';
import { INQUIRY_TYPES } from '../../constants.ts';
import LeadScoreBadge from '../ui/LeadScoreBadge.tsx';
import { createLeadProposalPackage, investigateLeadCompany, generateLeadReplyEmail } from '../../services/geminiService.ts';
import ProposalPdfContent from './ProposalPdfContent.tsx';
import { generateMultipagePdf, formatDate, formatJPY, formatDateTime, createSignature } from '../../utils.ts';
import InvestigationReportPdfContent from '../reports/InvestigationReportPdfContent.tsx';
import { safeJsonParse } from '../../services/safeJsonParse.ts';

interface LeadDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    lead: Lead | null;
    allLeads: Lead[];
    currentLeadIndex: number;
    onNavigateLead: (index: number) => void;
    onSave: (leadId: string, updatedData: Partial<Lead>) => Promise<void>;
    onDelete: (leadId: string) => Promise<void>;
    addToast: (message: string, type: Toast['type']) => void;
    requestConfirmation: (dialog: Omit<ConfirmationDialogProps, 'isOpen' | 'onClose'>) => void;
    currentUser: EmployeeUser | null;
    isAIOff: boolean;
    onAddEstimate: (estimate: any) => Promise<void>;
}

const Field: React.FC<{
    label: string;
    name: keyof Lead;
    value: string | string[] | number | null | undefined;
    isEditing: boolean;
    onChange: (e: React.ChangeEvent<any>) => void;
    type?: 'text' | 'email' | 'select' | 'textarea' | 'date' | 'number';
    options?: any[];
    className?: string;
    colSpan?: string;
}> = ({ label, name, value, isEditing, onChange, type = 'text', options = [], className = '', colSpan = 'col-span-1' }) => {
    const fieldInputClass = "w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-base text-slate-900 dark:text-white rounded-lg p-1.5 focus:ring-blue-500 focus:border-blue-500 leading-tight";
    
    let displayValue: React.ReactNode = Array.isArray(value) ? value.join(', ') : (value !== null && value !== undefined ? String(value) : '-');

    if (!isEditing && type === 'date' && value) {
        displayValue = formatDate(value as string);
    }
    if (!isEditing && name === 'score' && typeof value === 'number') {
        displayValue = <LeadScoreBadge score={value} />;
    }

    return (
        <div className={`${className} ${colSpan}`}>
            <label htmlFor={String(name)} className="text-base font-medium text-slate-500 dark:text-slate-400 leading-tight">{label}</label>
            <div className="mt-1">
                {isEditing ? (
                    <>
                        {type === 'textarea' && <textarea id={String(name)} name={String(name)} value={(value as string) || ''} onChange={onChange} className={fieldInputClass} rows={5} />}
                        {type === 'select' && <select id={String(name)} name={String(name)} value={(value as string) || ''} onChange={onChange} className={fieldInputClass}>{options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}</select>}
                        {type === 'number' && <input type="number" id={String(name)} name={String(name)} value={(value as number) || 0} onChange={onChange} className={fieldInputClass} />}
                        {type !== 'textarea' && type !== 'select' && type !== 'number' && <input type={type} id={String(name)} name={String(name)} value={(value as string) || ''} onChange={onChange} className={fieldInputClass} />}
                    </>
                ) : (
                    <div className="text-base text-slate-900 dark:text-white min-h-[32px] flex items-center whitespace-pre-wrap break-words leading-tight" style={{ overflow: 'visible' }}>
                        {displayValue}
                    </div>
                )}
            </div>
        </div>
    );
};

export const LeadDetailModal: React.FC<LeadDetailModalProps> = ({ 
    isOpen, onClose, lead, allLeads, currentLeadIndex, onNavigateLead, 
    onSave, onDelete, addToast, requestConfirmation, currentUser,
    isAIOff, onAddEstimate 
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<Partial<Lead>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [isInvestigating, setIsInvestigating] = useState(false);
    const [isGeneratingPackage, setIsGeneratingPackage] = useState(false);
    const [lastProposalPackage, setLastProposalPackage] = useState<LeadProposalPackage | null>(null);
    const [showProposalPreview, setShowProposalPreview] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [isSavingEstimate, setIsSavingEstimate] = useState(false);
    const [activeTab, setActiveTab] = useState<'companyInfo' | 'estimateDraft' | 'proposalDraft' | 'emailReplyDraft'>('companyInfo');
    const [aiReplyEmail, setAiReplyEmail] = useState<{ subject: string; bodyText: string } | null>(null);
    const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);
    const [companyInvestigation, setCompanyInvestigation] = useState<CompanyInvestigation | null>(null);

    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; };
    }, []);
    
    useEffect(() => {
        if (lead) {
            setFormData({ ...lead });
            setIsEditing(false);
            setLastProposalPackage(null);
            setShowProposalPreview(false);
            setAiReplyEmail(null);
            setCompanyInvestigation(lead.aiInvestigation || null);
            setActiveTab('companyInfo');
            try {
                if (lead.aiDraftProposal) {
                    // FIX: Cast parsed object to avoid type errors
                    const parsedPackage: Partial<LeadProposalPackage> = safeJsonParse(lead.aiDraftProposal);
                    setLastProposalPackage(parsedPackage as LeadProposalPackage);
                    if (parsedPackage.proposal || parsedPackage.estimate) {
                        setShowProposalPreview(true);
                    }
                }
            } catch (e) {
                console.error('Failed to parse aiDraftProposal:', e);
            }
        }
    }, [lead]);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft' && currentLeadIndex > 0) onNavigateLead(currentLeadIndex - 1);
            if (e.key === 'ArrowRight' && currentLeadIndex < allLeads.length - 1) onNavigateLead(currentLeadIndex + 1);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose, currentLeadIndex, allLeads.length, onNavigateLead]);

    if (!isOpen || !lead) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        const { id, createdAt, updatedAt, ...submissionData } = formData;
        await onSave(lead.id, { ...submissionData, updatedAt: new Date().toISOString() });
        setIsSaving(false);
        setIsEditing(false);
    };

    const handleInvestigateCompany = async () => {
        if (isAIOff) { addToast('AI機能は現在無効です。', 'error'); return; }
        setIsInvestigating(true);
        try {
            const result = await investigateLeadCompany(lead.company);
            await onSave(lead.id, { aiInvestigation: result, updatedAt: new Date().toISOString() });
            if (mounted.current) {
                setCompanyInvestigation(result);
                addToast('企業調査が完了しました。', 'success');
            }
        } catch (e) {
            if (mounted.current) addToast(e instanceof Error ? `企業調査エラー: ${e.message}`: '不明なエラーが発生しました。', 'error');
        } finally {
            if (mounted.current) setIsInvestigating(false);
        }
    };
    
    const handleCreateProposalPackage = async () => {
        if (isAIOff) { addToast('AI機能は現在無効です。', 'error'); return; }
        setIsGeneratingPackage(true);
        try {
            const result = await createLeadProposalPackage(lead);
            await onSave(lead.id, { aiDraftProposal: JSON.stringify(result), updatedAt: new Date().toISOString() });
            if (mounted.current) {
                setLastProposalPackage(result);
                setShowProposalPreview(true);
                addToast('AI提案パッケージが生成されました。', 'success');
            }
        } catch (e: any) {
            if (mounted.current) addToast(e instanceof Error ? `提案パッケージ生成エラー: ${e.message}`: '不明なエラーが発生しました。', 'error');
        } finally {
            if (mounted.current) setIsGeneratingPackage(false);
        }
    };

    const handleGeneratePdf = async () => {
        if (!lead || !lastProposalPackage?.proposal) return;
        setIsGeneratingPdf(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 100)); // allow content to render
            await generateMultipagePdf(
                'proposal-pdf-content',
                `提案書_${lead.company}_${lead.name}.pdf`
            );
            addToast('提案書PDFが正常に生成されました。', 'success');
        } catch (e) {
            addToast(e instanceof Error ? e.message : 'PDFの生成に失敗しました。', 'error');
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    const handleSaveEstimate = async () => {
        if (!lastProposalPackage?.estimate || isSavingEstimate) return;
        setIsSavingEstimate(true);
        try {
            const estimateBase = {
                customerName: lead.company,
                title: lastProposalPackage.proposal?.coverTitle || `${lead.company}様向けご提案見積`,
                items: lastProposalPackage.estimate,
                deliveryDate: '',
                paymentTerms: '別途相談',
                deliveryMethod: 'メール送付',
                notes: 'AI提案パッケージより生成',
                status: EstimateStatus.Draft,
                version: 1,
                userId: currentUser?.id || 'unknown',
            };
            await onAddEstimate(estimateBase);
            addToast('見積を下書きとして保存しました。', 'success');
        } catch (e) {
            addToast(e instanceof Error ? e.message : '見積の保存に失敗しました。', 'error');
        } finally {
            setIsSavingEstimate(false);
        }
    };

    const handleGenerateReplyEmail = async () => {
        if (isAIOff) { addToast('AI機能は現在無効です。', 'error'); return; }
        if (!lead.email) { addToast('返信先のメールアドレスが登録されていません。', 'error'); return; }
        setIsGeneratingEmail(true);
        try {
            const { subject, bodyText } = await generateLeadReplyEmail(lead);
            if (mounted.current) {
                setAiReplyEmail({ subject, bodyText });
                addToast('AIが返信メール文案を生成しました。', 'success');
            }
        } catch (e) {
            if (mounted.current) addToast(e instanceof Error ? e.message : 'AIによるメール作成に失敗しました。', 'error');
        } finally {
            if (mounted.current) setIsGeneratingEmail(false);
        }
    };

    const handleOpenGmail = async () => {
        if (!currentUser || !aiReplyEmail) return;
        try {
            const signature = createSignature();
            const finalBody = `${aiReplyEmail.bodyText}\n\n${signature}`.trim();
            const mailto = `https://mail.google.com/mail/?view=cm&fs=1&to=${lead.email}&su=${encodeURIComponent(aiReplyEmail.subject)}&body=${encodeURIComponent(finalBody)}`;
            window.open(mailto, '_blank');

            const timestamp = formatDateTime(new Date().toISOString());
            const logMessage = `[${timestamp}] AI返信メールをGmailで作成し、ステータスを「${LeadStatus.Contacted}」に更新しました。`;
            const updatedInfo = `${logMessage}\n${lead.infoSalesActivity || ''}`.trim();
            await onSave(lead.id, {
                status: LeadStatus.Contacted,
                infoSalesActivity: updatedInfo,
                updatedAt: new Date().toISOString(),
            });
            addToast('Gmailの下書きを作成しました。', 'success');
            setAiReplyEmail(null);
        } catch (e) {
            if (mounted.current) addToast(e instanceof Error ? e.message : 'メール作成に失敗しました', 'error');
        }
    };
    
    const isNextDisabled = currentLeadIndex >= allLeads.length - 1;
    const isPrevDisabled = currentLeadIndex <= 0;
    const currentLeadTitle = lead.company + (lead.name ? ` / ${lead.name}` : '');

    const handleDelete = () => {
        if (!lead) return;
        requestConfirmation({
            title: 'リードの削除',
            message: `本当にリード「${lead.company} / ${lead.name}」を削除しますか？この操作は元に戻せません。`,
            onConfirm: async () => {
                await onDelete(lead.id);
                onClose();
            }
        });
    };

    return (
        <>
            <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4 animate-fade-in-up">
                <div className="bg-slate-800 text-white flex flex-col overflow-hidden w-full h-full rounded-2xl border border-slate-700">
                    {/* Header */}
                    <div className="h-14 flex items-center justify-between px-4 border-b border-slate-700 flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <button onClick={() => onNavigateLead(currentLeadIndex - 1)} disabled={isPrevDisabled} className="p-2 rounded-md hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed" aria-label="前のリードへ">
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <div className="font-semibold text-lg max-w-lg truncate" title={currentLeadTitle}>
                                {currentLeadTitle}
                            </div>
                            <button onClick={() => onNavigateLead(currentLeadIndex + 1)} disabled={isNextDisabled} className="p-2 rounded-md hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed" aria-label="次のリードへ">
                                <ArrowRight className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            <LeadStatusBadge status={lead.status} />
                            <button className="p-1 rounded-full hover:bg-slate-700" onClick={onClose} aria-label="閉じる">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Main Content Area - 2 columns */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 flex-1 overflow-hidden">
                        {/* Left Column */}
                        <div className="h-full bg-slate-900 rounded-lg p-4 grid grid-cols-3 gap-x-4 gap-y-2 overflow-y-auto auto-rows-min">
                            <h3 className="col-span-3 text-lg font-semibold text-slate-100 mb-2 border-b border-slate-700 pb-2">基本情報</h3>
                            <Field label="会社名" name="company" value={formData.company} isEditing={isEditing} onChange={handleChange} colSpan="col-span-3" />
                            <Field label="担当者名" name="name" value={formData.name} isEditing={isEditing} onChange={handleChange} colSpan="col-span-3" />
                            <Field label="受信日時" name="createdAt" value={lead.createdAt} isEditing={false} onChange={handleChange} />
                            <Field label="最終更新" name="updatedAt" value={lead.updatedAt || lead.createdAt} isEditing={false} onChange={handleChange} />
                            <Field label="流入経路" name="source" value={formData.source} isEditing={isEditing} onChange={handleChange} />
                            <Field label="メール" name="email" value={formData.email} isEditing={isEditing} onChange={handleChange} type="email" />
                            <Field label="電話" name="phone" value={formData.phone} isEditing={isEditing} onChange={handleChange} type="text" />
                            <Field label="スコア" name="score" value={lead.score} isEditing={false} onChange={handleChange} type="number" />
                            <Field label="問い合わせ種別" name="inquiryTypes" value={formData.inquiryTypes} isEditing={isEditing} onChange={handleChange} type="select" options={INQUIRY_TYPES} colSpan="col-span-3" />
                            <h3 className="col-span-3 text-lg font-semibold text-slate-100 my-2 border-b border-slate-700 pb-2">問い合わせ内容</h3>
                            <Field label="" name="message" value={formData.message} isEditing={isEditing} onChange={handleChange} type="textarea" colSpan="col-span-3" />
                            <h3 className="col-span-3 text-lg font-semibold text-slate-100 my-2 border-b border-slate-700 pb-2">活動履歴</h3>
                            <Field label="" name="infoSalesActivity" value={formData.infoSalesActivity} isEditing={isEditing} onChange={handleChange} type="textarea" colSpan="col-span-3" />
                        </div>
                        {/* Right Column */}
                        <div className="h-full bg-slate-900 rounded-lg p-4 flex flex-col overflow-hidden">
                           <div className="flex-shrink-0 border-b border-slate-700 mb-2">
                                <div className="flex items-center gap-4 text-sm">
                                    {['companyInfo', 'proposalDraft', 'estimateDraft', 'emailReplyDraft'].map(tabId => {
                                        const labels = { companyInfo: '企業調査', proposalDraft: '提案書', estimateDraft: '見積', emailReplyDraft: '返信メール' };
                                        return (
                                            <button key={tabId} onClick={() => setActiveTab(tabId as any)} className={`py-2 border-b-2 ${activeTab === tabId ? 'border-blue-500 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}>
                                                {labels[tabId as keyof typeof labels]}
                                            </button>
                                        );
                                    })}
                                </div>
                           </div>
                           <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                                {/* Tab Contents */}
                           </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="h-16 flex items-center justify-between px-4 border-t border-slate-700 flex-shrink-0">
                         <div>{/* Placeholder for left footer items */}</div>
                        <div className="flex items-center gap-4">
                            {!isEditing ? (
                                <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 py-2 px-4 rounded-lg text-sm text-white"><Pencil className="w-4 h-4" /> 編集</button>
                            ) : (
                                <>
                                    <button onClick={() => setIsEditing(false)} className="bg-slate-700 hover:bg-slate-600 py-2 px-4 rounded-lg text-sm text-white">キャンセル</button>
                                    <button onClick={() => handleDelete()} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 py-2 px-4 rounded-lg text-sm text-white"><Trash2 className="w-4 h-4" /> 削除</button>
                                    <button onClick={handleSave} disabled={isSaving} className="w-32 flex items-center justify-center bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg disabled:bg-slate-400 text-sm">
                                        {isSaving ? <Loader className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5 mr-2" />保存</>}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            {lastProposalPackage?.proposal && <div style={{ position: 'absolute', left: '-9999px', top: 0 }}><ProposalPdfContent content={lastProposalPackage.proposal} lead={lead} /></div>}
            {isGeneratingPdf && companyInvestigation && <div style={{ position: 'absolute', left: '-9999px', top: 0 }}><InvestigationReportPdfContent report={{ title: `企業調査レポート: ${lead.company}`, sections: companyInvestigation }} /></div>}
        </>
    );
};