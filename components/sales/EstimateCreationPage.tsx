

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import JSZip from 'jszip';
import { Customer, EmployeeUser, Estimate, EstimateDraft, EstimateLineItem, Toast, Page, ExtractedParty, EstimateStatus, UUID } from '../../types.ts';
import { createDraftEstimate, parseLineItems } from '../../services/geminiService.ts';
import { addEstimate } from '../../services/dataService.ts';
import { Sparkles, Loader, X, PlusCircle, Trash2, ArrowLeft, Save, Upload, FileText } from '../Icons.tsx';
import { formatJPY } from '../../utils.ts';

interface EstimateCreationPageProps {
    customers: Customer[];
    allUsers: EmployeeUser[];
    addToast: (message: string, type: Toast['type']) => void;
    currentUser: EmployeeUser | null;
    isAIOff: boolean;
    onCreateEstimate: (estimate: Partial<Estimate>) => Promise<void>;
    onNavigateBack: () => void;
}

const EstimateCreationPage: React.FC<EstimateCreationPageProps> = ({ customers, currentUser, isAIOff, onCreateEstimate, onNavigateBack, addToast }) => {
    const [aiPrompt, setAiPrompt] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [isDragOver, setIsDragOver] = useState(false);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    
    const [customerName, setCustomerName] = useState('');
    const [title, setTitle] = useState('');
    const [deliveryDate, setDeliveryDate] = useState('');
    const [paymentTerms, setPaymentTerms] = useState('');
    const [notes, setNotes] = useState('');
    const [lineItems, setLineItems] = useState<EstimateLineItem[]>([]);
    
    const [lineItemPrompt, setLineItemPrompt] = useState('');
    const [isLineItemLoading, setIsLineItemLoading] = useState(false);

    const unzipAndAddFiles = async (zipFile: File) => {
        setIsAiLoading(true);
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
            setError(`${zipFile.name} の展開に失敗しました。ファイルが破損している可能性があります。`);
            addToast(`${zipFile.name} の展開に失敗しました。`, 'error');
        } finally {
            setIsAiLoading(false);
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

    const handleAiDraft = async () => {
        if (!aiPrompt.trim() && files.length === 0) {
            setError("AIへの依頼内容を入力するか、ファイルを添付してください。");
            return;
        }
        setIsAiLoading(true);
        setError('');
        try {
            const fileData = await Promise.all(
                files
                .filter(file => ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type))
                .map(file => new Promise<{ data: string, mimeType: string }>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve({
                        data: (reader.result as string).split(',')[1],
                        mimeType: file.type
                    });
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                }))
            );

            const nonImageFiles = files.filter(file => !['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type));
            if (nonImageFiles.length > 0) {
                addToast(`AIは現在画像とPDFのみをサポートしています。${nonImageFiles.length}個の非対応ファイルはスキップされました。`, 'info');
            }

            const draft = await createDraftEstimate(aiPrompt, fileData);
            setCustomerName(draft.customerCandidates?.[0]?.company || '');
            setTitle(draft.subjectCandidates?.[0] || '');
            setDeliveryDate(draft.dueDate?.split('T')[0] || '');
            setPaymentTerms(draft.paymentTerms || '');
            setNotes(draft.notes || '');
            setLineItems(draft.items || []);
            addToast('AIが見積下書きを作成しました。', 'success');
        } catch (e: any) {
            setError(e.message || 'AIによる下書き生成に失敗しました。');
            addToast('AIによる下書き生成に失敗しました。', 'error');
        } finally {
            setIsAiLoading(false);
        }
    };
    
    const handleAddLineItemFromAI = async () => {
        if (!lineItemPrompt.trim()) return;
        setIsLineItemLoading(true);
        try {
            const newItems = await parseLineItems(lineItemPrompt);
            setLineItems(prev => [...prev, ...newItems]);
            setLineItemPrompt('');
        } catch (e) {
            addToast('明細の解析に失敗しました。', 'error');
        } finally {
            setIsLineItemLoading(false);
        }
    };

    const handleLineItemChange = (index: number, field: keyof EstimateLineItem, value: any) => {
        const updatedItems = [...lineItems];
        updatedItems[index] = { ...updatedItems[index], [field]: value };
        setLineItems(updatedItems);
    };

    const addNewLineItem = () => {
        setLineItems([...lineItems, { name: '', qty: 1, unit: '式', unitPrice: 0 }]);
    };
    
    const removeLineItem = (index: number) => {
        setLineItems(lineItems.filter((_, i) => i !== index));
    };

    const { subtotal, tax, total } = useMemo(() => {
        const sub = lineItems.reduce((acc, item) => acc + (item.qty * item.unitPrice), 0);
        const taxAmount = sub * 0.1; // 10% tax
        return { subtotal: sub, tax: taxAmount, total: sub + taxAmount };
    }, [lineItems]);
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!customerName || !title || lineItems.length === 0) {
            setError("顧客名、件名、および少なくとも1つの明細は必須です。");
            return;
        }
        if (!currentUser) {
            setError("ユーザー情報が見つかりません。再ログインしてください。");
            addToast("ユーザー情報が見つかりません。", "error");
            return;
        }
        setIsSubmitting(true);
        setError('');
        try {
            const estimateData: Omit<Estimate, 'id' | 'createdAt' | 'updatedAt' | 'estimateNumber' | 'subtotal' | 'taxTotal' | 'grandTotal'> = {
                customerName,
                title,
                items: lineItems,
                deliveryDate,
                paymentTerms,
                deliveryMethod: 'メール送付',
                notes,
                status: EstimateStatus.Draft,
                version: 1,
                userId: currentUser.id,
            };
            await onCreateEstimate(estimateData);
            addToast('新規見積を作成しました。', 'success');
            onNavigateBack();
        } catch(err) {
            setError(err instanceof Error ? err.message : '保存に失敗しました。');
            addToast('見積の作成に失敗しました。', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const inputClass = "w-full bg-slate-50 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50";
    const labelClass = "text-sm font-medium text-slate-700 dark:text-slate-300";

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex items-center gap-4">
                <button type="button" onClick={onNavigateBack} className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white">
                    <ArrowLeft className="w-4 h-4" />
                    見積一覧に戻る
                </button>
            </div>
            
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 space-y-4">
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2"><Sparkles className="w-5 h-5 text-purple-500"/>AIアシスタント</h3>
                <p className="text-sm text-slate-500">メールや仕様書（テキストやファイル）をインポートすると、AIが以下のフォームに下書きを自動入力します。</p>
                <textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    rows={4}
                    placeholder="ここにメール本文などを貼り付け..."
                    className={inputClass}
                    disabled={isAiLoading || isAIOff}
                />
                 <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">関連ファイル (ZIP可)</label>
                    <div
                        onDrop={handleDrop}
                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
                        onDragLeave={() => setIsDragOver(false)}
                        className={`relative border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-6 text-center transition-colors ${isDragOver ? 'bg-blue-50 dark:bg-blue-900/50 border-blue-400' : ''}`}
                    >
                        <input type="file" id="estimate-file-upload" multiple className="sr-only" onChange={(e) => handleFileChange(e.target.files)} disabled={isAiLoading || isAIOff} />
                        <label htmlFor="estimate-file-upload" className="cursor-pointer">
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
                                        <span className="text-slate-500 flex-shrink-0">({(file.size / 1024).toFixed(1)} KB)</span>
                                    </div>
                                    <button onClick={() => removeFile(index)} disabled={isAiLoading} className="p-1 text-slate-400 hover:text-red-500 flex-shrink-0"><X className="w-4 h-4"/></button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="mt-4 flex justify-end">
                    <button type="button" onClick={handleAiDraft} disabled={isAiLoading || (!aiPrompt.trim() && files.length === 0) || isAIOff} className="flex items-center gap-2 bg-purple-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-purple-700 disabled:bg-slate-400">
                        {isAiLoading ? <Loader className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                        AIで下書きを作成
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="customerName" className={labelClass}>顧客名 *</label>
                        <input type="text" id="customerName" value={customerName} onChange={e => setCustomerName(e.target.value)} list="customer-list" required className={inputClass} />
                        <datalist id="customer-list">
                            {customers.map(c => <option key={c.id} value={c.customerName} />)}
                        </datalist>
                    </div>
                    <div>
                        <label htmlFor="title" className={labelClass}>件名 *</label>
                        <input type="text" id="title" value={title} onChange={e => setTitle(e.target.value)} required className={inputClass}/>
                    </div>
                </div>

                <div className="space-y-2 pt-4">
                     <div className="flex items-center justify-between">
                         <h3 className="text-lg font-semibold">明細 *</h3>
                         <div className="flex items-center gap-2">
                             <input type="text" value={lineItemPrompt} onChange={e => setLineItemPrompt(e.target.value)} placeholder="例: A4チラシ 1000部" className={`${inputClass} text-sm`} disabled={isLineItemLoading || isAIOff} />
                             <button type="button" onClick={handleAddLineItemFromAI} disabled={isLineItemLoading || !lineItemPrompt || isAIOff} className="flex items-center gap-2 bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 font-semibold py-2 px-3 rounded-lg text-sm disabled:opacity-50">
                                {isLineItemLoading ? <Loader className="w-4 h-4 animate-spin"/> : <Sparkles className="w-4 h-4"/>}
                                AIで追加
                            </button>
                         </div>
                     </div>
                     <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-700/50">
                                <tr>
                                    {['品名', '数量', '単位', '単価', '小計', ''].map(h => <th key={h} className={`px-3 py-2 text-left font-medium ${h.includes('計') ? 'text-right' : ''}`}>{h}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {lineItems.map((item, index) => (
                                    <tr key={index}>
                                        <td className="p-1"><input type="text" value={item.name} onChange={e => handleLineItemChange(index, 'name', e.target.value)} className={inputClass} /></td>
                                        <td className="p-1 w-24"><input type="number" value={item.qty} onChange={e => handleLineItemChange(index, 'qty', parseInt(e.target.value))} className={`${inputClass} text-right`} /></td>
                                        <td className="p-1 w-20"><input type="text" value={item.unit} onChange={e => handleLineItemChange(index, 'unit', e.target.value)} className={inputClass} /></td>
                                        <td className="p-1 w-32"><input type="number" value={item.unitPrice} onChange={e => handleLineItemChange(index, 'unitPrice', parseInt(e.target.value))} className={`${inputClass} text-right`} /></td>
                                        <td className="p-1 w-32 text-right pr-3">{formatJPY(item.qty * item.unitPrice)}</td>
                                        <td className="p-1 w-12 text-center"><button type="button" onClick={() => removeLineItem(index)} className="p-1 text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4"/></button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                     </div>
                     <div className="flex items-center justify-between mt-2">
                        <button type="button" onClick={addNewLineItem} className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700">
                            <PlusCircle className="w-4 h-4"/> 行を追加
                        </button>
                        <div className="w-64 space-y-1 text-right">
                             <div className="flex justify-between"><span className="text-slate-500">小計</span><span>{formatJPY(subtotal)}</span></div>
                             <div className="flex justify-between"><span className="text-slate-500">消費税 (10%)</span><span>{formatJPY(tax)}</span></div>
                             <div className="flex justify-between font-bold text-lg border-t pt-1 mt-1"><span >合計</span><span>{formatJPY(total)}</span></div>
                        </div>
                     </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                    <div>
                        <label htmlFor="deliveryDate" className={labelClass}>希望納期</label>
                        <input type="date" id="deliveryDate" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} className={inputClass}/>
                    </div>
                    <div>
                        <label htmlFor="paymentTerms" className={labelClass}>支払条件</label>
                        <input type="text" id="paymentTerms" value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} className={inputClass} placeholder="例: 月末締め翌月末払い"/>
                    </div>
                </div>
                 <div>
                    <label htmlFor="notes" className={labelClass}>備考</label>
                    <textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} rows={3} className={inputClass} placeholder="見積の有効期限など補足事項があれば入力してください。"/>
                </div>
            </div>

            {error && <p className="text-red-500 bg-red-100 dark:bg-red-900/50 p-3 rounded-lg">{error}</p>}
            
            <div className="flex justify-end gap-4">
                <button type="button" onClick={onNavigateBack} className="bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold py-2 px-4 rounded-lg">キャンセル</button>
                <button type="submit" disabled={isSubmitting} className="w-40 flex items-center justify-center bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-blue-700 disabled:bg-slate-400">
                    {isSubmitting ? <Loader className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5 mr-2"/>見積を保存</>}
                </button>
            </div>
        </form>
    );
};

export default EstimateCreationPage;