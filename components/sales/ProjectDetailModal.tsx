

import React from 'react';
import { Project } from '../../types.ts';
import { X, Sparkles, FileText } from '../Icons.tsx';
import ProjectStatusBadge from './ProjectStatusBadge.tsx';
import { formatDate } from '../../utils.ts';

interface ProjectDetailModalProps {
    project: Project;
    onClose: () => void;
}

const ProjectDetailModal: React.FC<ProjectDetailModalProps> = ({ project, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{project.projectName}</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{project.customerName}</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <ProjectStatusBadge status={project.status} />
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                <div className="p-6 overflow-y-auto space-y-6">
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/50 rounded-lg border border-blue-200 dark:border-blue-800">
                        <h3 className="text-lg font-semibold flex items-center gap-2 text-blue-800 dark:text-blue-200">
                            <Sparkles className="w-5 h-5"/>
                            AIによる案件概要
                        </h3>
                        <p className="mt-2 text-base text-blue-700 dark:text-blue-300 whitespace-pre-wrap">{project.overview}</p>
                    </div>

                    <div>
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">抽出された情報</h3>
                        <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg text-base text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                            {project.extracted_details}
                        </div>
                    </div>
                    
                    {project.attachments && project.attachments.length > 0 && (
                        <div>
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">添付ファイル</h3>
                            <div className="space-y-2">
                                {project.attachments.map(file => (
                                    <a 
                                        key={file.id} 
                                        href={file.fileUrl} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-between p-3 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600"
                                    >
                                        <div className="flex items-center gap-3">
                                            <FileText className="w-5 h-5 text-slate-500"/>
                                            <span className="font-medium text-sm">{file.fileName}</span>
                                        </div>
                                        <span className="px-2 py-0.5 text-xs rounded-full bg-slate-200 dark:bg-slate-600">{file.category}</span>
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-end items-center gap-4 p-6 border-t border-slate-200 dark:border-slate-700">
                    <button className="flex items-center gap-2 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 font-semibold py-2 px-4 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-800/50 disabled:opacity-50">
                        <Sparkles className="w-4 h-4"/> AIで提案書を作成
                    </button>
                    <button className="flex items-center gap-2 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 font-semibold py-2 px-4 rounded-lg hover:bg-green-200 dark:hover:bg-green-800/50 disabled:opacity-50">
                        <FileText className="w-4 h-4"/> AIで見積書を作成
                    </button>
                    <button onClick={onClose} className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700">閉じる</button>
                </div>
            </div>
        </div>
    );
};

export default ProjectDetailModal;