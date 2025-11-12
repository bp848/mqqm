import React, { useState, useMemo, useRef } from 'react';
import JSZip from 'jszip';
import { submitApplication } from '../../services/dataService.ts';
import { parseApprovalDocument } from '../../services/geminiService.ts';
import ApprovalRouteSelector from './ApprovalRouteSelector.tsx';
import { Loader, Sparkles, AlertTriangle, Upload, FileText, X } from '../Icons.tsx';
import { User, Toast } from '../../types.ts';
import ChatApplicationModal from '../ChatApplicationModal.tsx';

interface ApprovalFormProps {
    onSuccess: () => void;
    applicationCodeId: string;
    currentUser: User | null;
    isAIOff: boolean;
    isLoading: boolean;
    error: string;
    addToast: (message: string, type: Toast['type']) => void;
}

const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result.split(',')[1]) : reject("Read failed");
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
};

const ApprovalForm: React.FC<ApprovalFormProps> = ({ onSuccess, applicationCodeId, currentUser, isAIOff, isLoading, error: formLoadError, addToast }) => {
    const [formData, setFormData] = useState({ title: '', details: '' });
    const [approvalRouteId, setApprovalRouteId] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [isChatModalOpen, setIsChatModalOpen] = useState(false);
    const firstInvalidRef = useRef<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null>(null);

    const [files, setFiles] = useState<File[]>([]);
    const [isOcrLoading, setIsOcrLoading] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    
    const isDisabled = isSubmitting || isLoading || !!formLoadError;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const unzipAndAddFiles = async (zipFile: File) => {
        setIsOcrLoading(true);
        try {
            const zip = await JSZip.loadAsync(zipFile);
            const newFiles: File[] = [];
            for (const filename in zip.files) {
                const zipEntry = zip.files[filename];
                if (!zipEntry.dir) {
                    const blob = await zipEntry.async('blob');
                    const file = new File([blob], filename, { type: blob.type });
                    newFiles.push(file);
                }
            }
            setFiles(prev => [...prev, ...newFiles]);
            addToast(`${zipFile.name}から${newFiles.length}個のファイルを展開しました。`, 'success');
        } catch (e) {
            console.error('Failed to unzip file:', e);
            setError(`${zipFile.name} の展開に失敗しました。`);
            addToast(`${zipFile.name} の展開に失敗しました。`, 'error');
        } finally {
            setIsOcrLoading(false);
        }
    };

    const handleFileChange = (selectedFiles: FileList | null) => {
        if (selectedFiles) {
            const regularFiles: File[] = [];
            const zipFiles: File[] = [];
            Array.from(selectedFiles).forEach(file => {
                if (file.type === 'application/zip' || file.type === 'application/x-zip-compressed' || file.name.endsWith('.zip')) {
                    zipFiles.push(file);
                } else {
                    regularFiles.push(file);
                }
            });
            setFiles(prev => [...prev, ...regularFiles]);
            zipFiles.forEach(unzipAndAddFiles);
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        handleFileChange(e.dataTransfer.files);
    };

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleOcr = async () => {
        const supportedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
        const fileToProcess = files.find(f => supportedMimeTypes.includes(f.type));

        if (!fileToProcess) {
            setError('読み取り可能なファイル（PDF, JPG, PNG, WebP）が見つかりません。');
            return;
        }

        setIsOcrLoading(true);
        setError('');
        try {
            const base64String = await readFileAsBase64(fileToProcess);
            const ocrData = await parseApprovalDocument(base64String, fileToProcess.type);
            
            setFormData(prev => ({ ...prev, title: ocrData.title, details: ocrData.details }));
            addToast('ファイルから内容を読み取りました。', 'success');
        } catch (err: any) {
            if (err.name === 'AbortError') return;
            setError(err.message || 'AI-OCR処理中にエラーが発生しました。');
        } finally {
            setIsOcrLoading(false);
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
            setError('目的・概要は必須です。');
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
            setError('申請の提出に失敗しました。');
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
                        <h2 id="form-title" className="text-2xl font-bold text-slate-800 dark:text-white">稟議（金額なし決裁）フォーム</h2>
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

                    <div className="space-y-4">
                        <label className="block text-base font-semibold text-slate-700 dark:text-slate-200">
                            稟議書ファイルから読み込み (PDF/ZIP対応)
                        </label>
                        <div 
                            onDrop={handleDrop} 
                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }} 
                            onDragLeave={() => setIsDragOver(false)}
                            className={`relative border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-6 text-center transition-colors ${isDragOver ? 'bg-blue-50 dark:bg-blue-900/50 border-blue-400' : ''}`}
                        >
                            <input type="file" id="approval-file-upload" multiple className="sr-only" onChange={(e) => handleFileChange(e.target.files)} disabled={isOcrLoading || isAIOff || isDisabled} />
                            <label htmlFor="approval-file-upload" className="cursor-pointer">
                                <Upload className="w-8 h-8 mx-auto text-slate-400" />
                                <p className="mt-2 text-sm text-slate-500">ここにファイルをドラッグ＆ドロップ</p>
                                <p className="text-xs text-slate-400">またはクリックしてファイルを選択</p>
                            </label>
                        </div>
                        {files.length > 0 && (
                            <div className="mt-4 space-y-2">
                                {files.map((file, index) => (
                                    <div key={index} className="flex items-center justify-between p-2 bg-slate-100 dark:bg-slate-700 rounded-md text-sm">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <FileText className="w-5 h-5 text-slate-500 flex-shrink-0" />
                                            <span className="font-medium truncate" title={file.name}>{file.name}</span>
                                        </div>
                                        <button onClick={() => removeFile(index)} disabled={isOcrLoading || isDisabled} className="p-1 text-slate-400 hover:text-red-500 flex-shrink-0"><X className="w-4 h-4"/></button>
                                    </div>
                                ))}
                            </div>
                        )}
                        {files.length > 0 && (
                            <div className="mt-4 flex justify-end">
                                <button type="button" onClick={handleOcr} disabled={isOcrLoading || isAIOff || isDisabled} className="flex items-center gap-2 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold py-2 px-4 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors cursor-pointer disabled:opacity-50">
                                    {isOcrLoading ? <Loader className="w-5 h-5 animate-spin"/> : <Sparkles className="w-5 h-5"/>}
                                    ファイルから読み取り
                                </button>
                            </div>
                        )}
                    </div>

                    <div>
                        <label htmlFor="title" className={labelClass}>件名 *</label>
                        <input type="text" id="title" name="title" value={formData.title} onChange={handleChange} className={inputClass} required disabled={isDisabled} placeholder="例: 新規取引先との契約締結について" autoComplete="on" aria-required="true" />
                    </div>

                    <div>
                        <label htmlFor="details" className={labelClass}>目的・概要 *</label>
                        <textarea id="details" name="details" rows={6} value={formData.details} onChange={handleChange} className={inputClass} required disabled={isDisabled} placeholder="申請する決裁の目的、背景、具体的な内容などを記述してください。" autoComplete="on" aria-required="true" />
                    </div>
                    
                    <ApprovalRouteSelector onChange={setApprovalRouteId} isSubmitting={isDisabled} requiredRouteName="社長決裁ルート" />

                    {error && <p className="text-red-500 text-sm bg-red-100 dark:bg-red-900/50 p-3 rounded-lg" role="alert">{error}</p>}
                    
                    <div className="flex justify-end gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                        <button type="button" className="bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold py-2 px-4 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600" disabled={isDisabled} aria-label="下書き保存">下書き保存</button>
                        <button type="submit" className="w-40 flex justify-center items-center bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-blue-700 disabled:bg-slate-400" disabled={isDisabled || !isFormValid} aria-label="申請を送信する">
                            {isSubmitting ? <Loader className="w-5 h-5 animate-spin" aria-hidden="true" /> : '申請を送信する'}
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
                    initialMessage="稟議を申請したいです。"
                    isAIOff={isAIOff}
                />
            )}
        </>
    );
};

export default ApprovalForm;