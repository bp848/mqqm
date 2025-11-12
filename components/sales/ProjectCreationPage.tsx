import React, { useState, useCallback } from 'react';
import JSZip from 'jszip';
import { Project, Customer, EmployeeUser, ProjectStatus, Toast } from '../../types.ts';
import { ArrowLeft, Sparkles, Loader, Upload, FileText, X } from '../Icons.tsx';
import { createProjectFromInputs } from '../../services/geminiService.ts';
import { addProject } from '../../services/dataService.ts';

interface ProjectCreationPageProps {
    onNavigateBack: () => void;
    onProjectCreated: () => void;
    customers: Customer[];
    currentUser: EmployeeUser | null;
    isAIOff: boolean;
    addToast: (message: string, type: Toast['type']) => void;
}

const ProjectCreationPage: React.FC<ProjectCreationPageProps> = ({ onNavigateBack, onProjectCreated, currentUser, isAIOff, addToast }) => {
    const [inputText, setInputText] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [isDragOver, setIsDragOver] = useState(false);

    const unzipAndAddFiles = async (zipFile: File) => {
        setIsLoading(true);
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
            setIsLoading(false);
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

    const handleCreateProject = async () => {
        if (!inputText.trim() && files.length === 0) {
            setError('テキストまたはファイルを少なくとも1つは入力・添付してください。');
            return;
        }
        if (!currentUser) {
            setError('ユーザー情報が見つかりません。');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const fileData = await Promise.all(
                files.map(file => new Promise<{ name: string, data: string, mimeType: string }>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve({
                        name: file.name,
                        data: (reader.result as string).split(',')[1],
                        mimeType: file.type
                    });
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                }))
            );
            
            const aiResult = await createProjectFromInputs(inputText, fileData);

            const projectData: Partial<Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'attachments'>> = {
                projectName: aiResult.projectName,
                customerName: aiResult.customerName,
                overview: aiResult.overview,
                extracted_details: aiResult.extracted_details,
                status: ProjectStatus.New,
                userId: currentUser.id,
            };

            const filesToUpload = files.map(file => {
                const categorization = aiResult.file_categorization.find(c => c.fileName === file.name);
                return {
                    file: file,
                    category: categorization?.category || 'その他'
                };
            });
            
            await addProject(projectData, filesToUpload);
            
            onProjectCreated();

        } catch (err) {
            const message = err instanceof Error ? err.message : '案件の作成中に不明なエラーが発生しました。';
            setError(message);
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };


  return (
    <div>
        <button onClick={onNavigateBack} className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white mb-4">
            <ArrowLeft className="w-4 h-4" />
            案件一覧に戻る
        </button>
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 space-y-6">
            <h2 className="text-xl font-semibold flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-purple-500" />
                AIによる新規案件作成
            </h2>
            
            <div>
                <label htmlFor="project-text" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">テキスト情報</label>
                <textarea
                    id="project-text"
                    rows={8}
                    className="w-full bg-slate-50 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg p-2.5 focus:ring-blue-500"
                    placeholder="顧客からのメール本文、仕様に関するメモなどを貼り付けてください。"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    disabled={isLoading || isAIOff}
                />
            </div>

            <div>
                 <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">関連ファイル (ZIP可)</label>
                 <div
                    onDrop={handleDrop}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
                    onDragLeave={() => setIsDragOver(false)}
                    className={`relative border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-6 text-center transition-colors ${isDragOver ? 'bg-blue-50 dark:bg-blue-900/50 border-blue-400' : ''}`}
                >
                    <input type="file" id="file-upload" multiple className="sr-only" onChange={(e) => handleFileChange(e.target.files)} disabled={isLoading || isAIOff} />
                    <label htmlFor="file-upload" className="cursor-pointer">
                        <Upload className="w-10 h-10 mx-auto text-slate-400" />
                        <p className="mt-2 text-slate-500">ここにファイルをドラッグ＆ドロップ</p>
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
                                <button onClick={() => removeFile(index)} disabled={isLoading} className="p-1 text-slate-400 hover:text-red-500 flex-shrink-0"><X className="w-4 h-4"/></button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            
            {error && <p className="text-red-500 bg-red-100 dark:bg-red-900/50 p-3 rounded-lg text-sm">{error}</p>}
            {isAIOff && <p className="text-red-500 bg-red-100 dark:bg-red-900/50 p-3 rounded-lg text-sm">AI機能が無効のため、案件を作成できません。</p>}

            <div className="flex justify-end">
                <button
                    onClick={handleCreateProject}
                    disabled={isLoading || isAIOff || (!inputText.trim() && files.length === 0)}
                    className="w-48 flex items-center justify-center bg-blue-600 text-white font-semibold py-2.5 px-4 rounded-lg shadow-md hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed"
                >
                    {isLoading ? <Loader className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5 mr-2" />}
                    {isLoading ? '作成中...' : 'AIで案件を作成'}
                </button>
            </div>
        </div>
    </div>
  );
};
export default ProjectCreationPage;