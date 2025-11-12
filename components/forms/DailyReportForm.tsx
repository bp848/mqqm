import React, { useState, useMemo, useRef } from 'react';
import { submitApplication } from '../../services/dataService.ts';
import { generateDailyReportSummary } from '../../services/geminiService.ts';
import ApprovalRouteSelector from './ApprovalRouteSelector.tsx';
import { Loader, Sparkles, AlertTriangle } from '../Icons.tsx';
import { User, Toast } from '../../types.ts';
import ChatApplicationModal from '../ChatApplicationModal.tsx';

interface DailyReportFormProps {
    onSuccess: () => void;
    applicationCodeId: string;
    currentUser: User | null;
    addToast: (message: string, type: Toast['type']) => void;
    isAIOff: boolean;
    isLoading: boolean;
    error: string;
}

interface DailyReportData {
    reportDate: string;
    startTime: string;
    endTime: string;
    customerName: string;
    activityContent: string;
    nextDayPlan: string;
}

const DailyReportForm: React.FC<DailyReportFormProps> = ({ onSuccess, applicationCodeId, currentUser, addToast, isAIOff, isLoading, error: formLoadError }) => {
    const [formData, setFormData] = useState<DailyReportData>({
        reportDate: new Date().toISOString().split('T')[0],
        startTime: '09:00',
        endTime: '18:00',
        customerName: '',
        activityContent: '',
        nextDayPlan: '',
    });
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
        if (!formData.customerName && !formData.activityContent.trim()) {
            addToast('AIが下書きを作成するために、顧客名または活動内容のキーワードを入力してください。', 'info');
            return;
        }
        setIsSummaryLoading(true);
        try {
            const summary = await generateDailyReportSummary(formData.customerName, formData.activityContent);
            setFormData(prev => ({ ...prev, activityContent: summary }));
            addToast('AIが活動内容の下書きを作成しました。', 'success');
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
        return !!formData.reportDate && !!formData.activityContent.trim() && !!approvalRouteId;
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
        if (!formData.reportDate) {
            setError('報告日は必須です。');
            firstInvalidRef.current = document.getElementById('reportDate') as HTMLInputElement;
            firstInvalidRef.current?.focus();
            return;
        }
        if (!formData.activityContent.trim()) {
            setError('活動内容は必須です。');
            firstInvalidRef.current = document.getElementById('activityContent') as HTMLTextAreaElement;
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
            setError('日報の提出に失敗しました。');
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
                        <h2 id="form-title" className="text-2xl font-bold text-slate-800 dark:text-white">日報作成</h2>
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

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label htmlFor="reportDate" className={labelClass}>報告日 *</label>
                            <input type="date" id="reportDate" name="reportDate" value={formData.reportDate} onChange={handleChange} className={inputClass} required disabled={isDisabled} autoComplete="on" aria-required="true" />
                        </div>
                        <div>
                            <label htmlFor="startTime" className={labelClass}>業務開始</label>
                            <input type="time" id="startTime" name="startTime" value={formData.startTime} onChange={handleChange} className={inputClass} disabled={isDisabled} autoComplete="on" aria-label="業務開始時間" />
                        </div>
                        <div>
                            <label htmlFor="endTime" className={labelClass}>業務終了</label>
                            <input type="time" id="endTime" name="endTime" value={formData.endTime} onChange={handleChange} className={inputClass} disabled={isDisabled} autoComplete="on" aria-label="業務終了時間" />
                        </div>
                    </div>
                    
                    <div>
                        <label htmlFor="customerName" className={labelClass}>訪問先・顧客名</label>
                        <input type="text" id="customerName" name="customerName" value={formData.customerName} onChange={handleChange} className={inputClass} disabled={isDisabled} placeholder="例: 株式会社〇〇" autoComplete="organization" aria-label="訪問先または顧客名" />
                    </div>


                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label htmlFor="activityContent" className={labelClass}>活動内容 *</label>
                            <button
                                type="button"
                                onClick={handleGenerateSummary}
                                disabled={isSummaryLoading || isDisabled || isAIOff}
                                className="flex items-center gap-1.5 text-sm font-semibold text-purple-600 hover:text-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                aria-label="AIで活動内容の下書きを作成"
                            >
                                {isSummaryLoading ? <Loader className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Sparkles className="w-4 h-4" aria-hidden="true" />}
                                AIで下書きを作成
                            </button>
                        </div>
                        <textarea id="activityContent" name="activityContent" rows={8} value={formData.activityContent} onChange={handleChange} className={inputClass} required disabled={isDisabled} placeholder="本日の業務内容、進捗、課題などを具体的に記述してください。または、キーワードを入力してAIに下書き作成を依頼してください。" autoComplete="on" aria-required="true" />
                        {isAIOff && <p className="text-sm text-red-500 dark:text-red-400 mt-1">AI機能無効のため、AI下書き作成は利用できません。</p>}
                    </div>
                    
                    <div>
                        <label htmlFor="nextDayPlan" className={labelClass}>翌日予定</label>
                        <textarea id="nextDayPlan" name="nextDayPlan" rows={3} value={formData.nextDayPlan} onChange={handleChange} className={inputClass} disabled={isDisabled} placeholder="明日のタスクやアポイントなどを記述してください。" autoComplete="on" aria-label="翌日予定" />
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
                    initialMessage="日報を提出したいです。"
                    isAIOff={isAIOff}
                />
            )}
        </>
    );
};

export default DailyReportForm;