import React from 'react';
import { ProjectStatus } from '../../types.ts';

interface ProjectStatusBadgeProps {
  status: ProjectStatus | string;
}

const ProjectStatusBadge: React.FC<ProjectStatusBadgeProps> = ({ status }) => {
    const statusMap: Record<ProjectStatus, string> = {
        [ProjectStatus.Draft]: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300',
        [ProjectStatus.New]: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
        [ProjectStatus.InProgress]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
        [ProjectStatus.Completed]: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
        [ProjectStatus.Cancelled]: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
        [ProjectStatus.Archived]: 'bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200',
    };
    
    const style = statusMap[status as ProjectStatus] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    
    return (
        <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${style}`}>
            {status}
        </span>
    );
};

export default ProjectStatusBadge;