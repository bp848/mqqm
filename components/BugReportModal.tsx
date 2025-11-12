import React, { useState } from 'react';
import { User } from '../types';
import { Loader, X, Save, Bug } from './Icons';

interface BugReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentUser: User | null;
    onReportSubmit: (report: {
        reporterName: string;
        reportType: 'bug' | 'improvement';
        summary: string;
        description: string;
    }) => Promise<void>;
}

const BugReportModal: React.FC<BugReportModalProps> = ({ isOpen, onClose, currentUser, onReportSubmit }) => {
    const [reportType, setReportType] = useState<'bug' | 'improvement'>('bug');
    const [summary, setSummary] = useState('');
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!summary.trim() || !description.trim() || !currentUser) return;
        
        setIsSubmitting(true);
        try {
            await onReportSubmit({
                reporterName: currentUser.name,
                reportType,
                summary,
                description,
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[150] p-4 font-sans">
            <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg">
                <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Bug className="w-6 h-6 text-purple-500" />
                        改善要望・バグ報告
                    </h2>
                    <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">報告の種類</label>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2">
                                <input type="radio" name="reportType" value="bug" checked={reportType === 'bug'} onChange={() => setReportType('bug')} className="h-4 w-4" />
                                バグ報告
                            </label>
                            <label className="flex items-center gap-2">
                                <input type="radio" name="reportType" value="improvement" checked={reportType === 'improvement'} onChange={() => setReportType('improvement')} className="h-4 w-4" />
                                改善要望
                            </label>
                        </div>
                    </div>
                    <div>
                        <label htmlFor="summary" className="block text-sm font-medium mb-1">件名</label>
                        <input id="summary" type="text" value={summary} onChange={e => setSummary(e.target.value)} required className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg p-2.5" />
                    </div>
                     <div>
                        <label htmlFor="description" className="block text-sm font-medium mb-1">詳細</label>
                        <textarea id="description" value={description} onChange={e => setDescription(e.target.value)} required rows={5} className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg p-2.5" />
                    </div>
                </div>
                <div className="flex justify-end gap-4 p-6 border-t border-slate-200 dark:border-slate-700">
                    <button type="button" onClick={onClose} disabled={isSubmitting} className="bg-slate-200 dark:bg-slate-600 font-semibold py-2 px-4 rounded-lg">キャンセル</button>
                    <button type="submit" disabled={isSubmitting || !summary.trim() || !description.trim()} className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 disabled:bg-slate-400">
                        {isSubmitting ? <Loader className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        {isSubmitting ? '送信中...' : '送信'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default BugReportModal;
