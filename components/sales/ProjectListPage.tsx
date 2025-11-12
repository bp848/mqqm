

import React, { useState } from 'react';
import { Project, ProjectStatus } from '../../types.ts';
import { KanbanSquare, PlusCircle, Sparkles, Eye, FileText } from '../Icons.tsx';
import EmptyState from '../ui/EmptyState.tsx';
import { formatDate } from '../../utils.ts';
import ProjectDetailModal from './ProjectDetailModal.tsx';
import ProjectStatusBadge from './ProjectStatusBadge.tsx';


interface ProjectListPageProps {
    projects: Project[];
    onNavigateToCreate: () => void;
}

const ProjectListPage: React.FC<ProjectListPageProps> = ({ projects, onNavigateToCreate }) => {
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);

    if (projects.length === 0) {
        return (
            <EmptyState
                icon={KanbanSquare}
                title="案件がありません"
                message="最初の案件を登録して、関連する見積や受注を一元管理しましょう。"
                action={{ label: "新規案件を作成", onClick: onNavigateToCreate, icon: PlusCircle }}
            />
        );
    }

    return (
        <>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-base text-left">
                        <thead className="text-sm uppercase bg-slate-50 dark:bg-slate-700">
                            <tr>
                                <th className="px-6 py-3 font-medium">案件名</th>
                                <th className="px-6 py-3 font-medium">顧客名</th>
                                <th className="px-6 py-3 font-medium">作成日</th>
                                <th className="px-6 py-3 font-medium">ステータス</th>
                                <th className="px-6 py-3 font-medium text-center">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {projects.map(proj => (
                                <tr key={proj.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                    <td className="px-6 py-4 font-semibold text-slate-800 dark:text-white">{proj.projectName}</td>
                                    <td className="px-6 py-4">{proj.customerName}</td>
                                    <td className="px-6 py-4 text-sm">{formatDate(proj.createdAt)}</td>
                                    <td className="px-6 py-4"><ProjectStatusBadge status={proj.status}/></td>
                                    <td className="px-6 py-4 text-center">
                                        <button onClick={() => setSelectedProject(proj)} className="p-2 text-slate-500 hover:text-blue-600" title="詳細表示">
                                            <Eye className="w-5 h-5"/>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            {selectedProject && (
                <ProjectDetailModal 
                    project={selectedProject}
                    onClose={() => setSelectedProject(null)}
                />
            )}
        </>
    );
};

export default ProjectListPage;