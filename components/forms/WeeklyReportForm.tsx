import React, { useState, useMemo, useRef } from 'react';
import { submitApplication } from '../../services/dataService.ts';
import { generateWeeklyReportSummary } from '../../services/geminiService.ts';
import ApprovalRouteSelector from './ApprovalRouteSelector.tsx';
import { Loader, Sparkles, AlertTriangle } from '../Icons.tsx';
import { User, Toast } from '../../types.ts';
import ChatApplicationModal from '../ChatApplicationModal.tsx';

interface WeeklyReportFormProps {
    onSuccess: () => void;
    applicationCodeId: string;
    currentUser: User | null;
    addToast: (message: string, type: Toast['type']) => void;
    isAIOff: boolean;
    isLoading: boolean;
    error: string;
}

const WeeklyReportForm: React.FC<WeeklyReportFormProps> = ({ onSuccess, applicationCodeId, currentUser, addToast, isAIOff, isLoading, error: formLoadError }) => {
    const [formData, setFormData] = useState({ title: `週報 ${new Date().toLocaleDateString('ja-JP')}`, details: '' });
    const [approvalRouteId, setApprovalRouteId] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSummaryLoading, setIsSummaryLoading] = useState(false);
    const [error, setError] = useState('');
    const [isChatModalOpen, setIsChatModalOpen] = useState(false);
    const firstInvalidRef = useRef<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null>(null);
    
    const isDisabled = isSubmitting || isLoading || !!formLoadError;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    const handleGenerateSummary = async () => {
        if (isAIOff) {
            addToast('AI機能は現在無効です。', 'error');
            return;
        }
        if (!formData.details.trim()) {
            addToast('AIが下書きを作成するために、報告内容のキーワードを入力してください。', 'info');
            return;
        }
        setIsSummaryLoading(true);
        try {
            const summary = await generateWeeklyReportSummary(formData.details);
            setFormData(prev => ({ ...prev, details: summary }));
            addToast('AIが報告内容の下書きを作成しました。', 'success');
        } catch (e: any) {
            if (e.name === 'AbortError') return; // Request was aborted, do nothing
            const errorMessage = e instanceof Error ? e.message : '不明なエラーが発生しました。';
            addToast(errorMessage, 'error');
        } finally {
            setIsSummaryLoading(false);
        }
    };

    // Form validation for submit button activation
    const isFormValid = useMemo(() => {
        return !!formData.title.trim() && !!formData.details.trim() && !!approvalRouteId;
    }, [formData, approvalRouteId]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        firstInvalidRef.current = null;
        setError('');
        
        if (!approvalRouteId) {
            setError('承認ルートは必須です。');
            firstInvalidRef.current = document.getElementById('approval-route-selector') as HTMLSelectElement;
            firstInvalidRef.current?.focus();
            return;
        }
        if (!currentUser) {
            setError('ユーザー情報が見つかりません。再度ログインしてください。');
            return;
        }
        if (!formData.title.trim()) {
            setError('件名は必須です。');
            firstInvalidRef.current = document.getElementById('title') as HTMLInputElement;
            firstInvalidRef.current?.focus();
            return;
        }
        if (!formData.details.trim()) {
            setError('報告内容は必須です。');
            firstInvalidRef.current = document.getElementById('details') as HTMLTextAreaElement;
            firstInvalidRef.current?.focus();
            return;
        }

        setIsSubmitting(true);
        setError('');
        try {
            await submitApplication({
                applicationCodeId: applicationCodeId,
                formData,
                approvalRouteId
            }, currentUser.id);
            onSuccess();
        } catch (err: any) {
            setError('週報の提出に失敗しました。');
        } finally {
            setIsSubmitting(false);
        }
    };

    const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1";
    const inputClass = "w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed";

    return (
        <>
            <div className="relative">
                {(isLoading || formLoadError) && (
                    <div className="absolute inset-0 bg-white/50 dark:bg-slate-800/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-2xl p-8" aria-live="polite" aria-busy={isLoading}>
                        {isLoading && <Loader className="w-12 h-12 animate-spin text-blue-500" aria-hidden="true" />}
                    </div>
                )}
                <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm space-y-6" aria-labelledby="form-title">
                    <div className="flex justify-between items-center">
                        <h2 id="form-title" className="text-2xl font-bold text-slate-800 dark:text-white">週報作成</h2>
                        <button 
                            type="button" 
                            onClick={() => setIsChatModalOpen(true)} 
                            className="flex items-center gap-2 bg-purple-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={isAIOff || isDisabled}
                            aria-label="AIチャットで申請"
                        >
                            <Sparkles className="w-5 h-5" aria-hidden="true" />
                            <span>AIチャットで申請</span>
                        </button>
                    </div>
                    {isAIOff && <p className="text-sm text-red-500 dark:text-red-400">AI機能無効のため、AIチャットは利用できません。</p>}
                    
                     {formLoadError && (
                        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert">
                            <p className="font-bold">フォーム読み込みエラー</p>
                            <p>{formLoadError}</p>
                        </div>
                    )}

                    <div>
                        <label htmlFor="title" className={labelClass}>件名 *</label>
                        <input type="text" id="title" name="title" value={formData.title} onChange={handleChange} className={inputClass} required disabled={isDisabled} aria-required="true" />
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label htmlFor="details" className={labelClass}>報告内容 *</label>
                            <button
                                type="button"
                                onClick={handleGenerateSummary}
                                disabled={isSummaryLoading || isDisabled || isAIOff}
                                className="flex items-center gap-1.5 text-sm font-semibold text-purple-600 hover:text-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                aria-label="AIで報告内容の下書きを作成"
                            >
                                {isSummaryLoading ? <Loader className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Sparkles className="w-4 h-4" aria-hidden="true" />}
                                AIで下書きを作成
                            </button>
                        </div>
                        <textarea id="details" name="details" rows={10} value={formData.details} onChange={handleChange} className={inputClass} required disabled={isDisabled} placeholder="今週の業務内容、成果、課題、来週の予定などを記述してください。または、キーワードを入力してAIに下書き作成を依頼してください。" aria-required="true" />
                        {isAIOff && <p className="text-sm text-red-500 dark:text-red-400 mt-1">AI機能無効のため、AI下書き作成は利用できません。</p>}
                    </div>
                
                    <ApprovalRouteSelector onChange={setApprovalRouteId} isSubmitting={isDisabled} requiredRouteName="社長決裁ルート" />

                    {error && <p className="text-red-500 text-sm bg-red-100 dark:bg-red-900/50 p-3 rounded-lg" role="alert">{error}</p>}

                    <div className="flex justify-end gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                        <button type="button" className="bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold py-2 px-4 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600" disabled={isDisabled} aria-label="下書き保存">下書き保存</button>
                        <button type="submit" className="w-40 flex justify-center items-center bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-blue-700 disabled:bg-slate-400" disabled={isDisabled || !isFormValid} aria-label="報告を提出する">
                            {isSubmitting ? <Loader className="w-5 h-5 animate-spin" aria-hidden="true" /> : '報告を提出する'}
                        </button>
                    </div>
                </form>
            </div>
             {isChatModalOpen && (
                <ChatApplicationModal
                    isOpen={isChatModalOpen}
                    onClose={() => setIsChatModalOpen(false)}
                    onSuccess={() => {
                        setIsChatModalOpen(false);
                        onSuccess();
                    }}
                    currentUser={currentUser}
                    initialMessage="週報を提出したいです。"
                    isAIOff={isAIOff}
                />
            )}
        </>
    );
};

export default WeeklyReportForm;