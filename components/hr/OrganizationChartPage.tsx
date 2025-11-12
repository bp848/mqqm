import React, { useMemo } from 'react';
import { Employee } from '../../types.ts';
import { Users } from '../Icons.tsx';

interface OrganizationChartPageProps {
  employees: Employee[];
}

// Define a sort order for titles to establish hierarchy
const titleOrder: { [key: string]: number } = {
  '代表取締役': 1,
  '取締役': 2,
  '部長': 3,
  '工場長': 3,
  '課長': 4,
  'マネージャー': 4,
  'シニアセールス': 5,
  '社員': 6,
  'スタッフ': 6,
};

const EmployeeCard: React.FC<{ employee: Employee }> = ({ employee }) => (
  <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 min-w-[200px] text-center">
    <h4 className="font-bold text-lg text-slate-800 dark:text-white">{employee.name}</h4>
    <p className="text-sm text-slate-500 dark:text-slate-400">{employee.positionName}</p>
  </div>
);

const DepartmentSection: React.FC<{ department: string; employees: Employee[] }> = ({ department, employees }) => {
  const sortedEmployees = useMemo(() => {
    return [...employees].sort((a, b) => {
      const orderA = titleOrder[a.positionName || ''] || 99; // Use positionName
      const orderB = titleOrder[b.positionName || ''] || 99; // Use positionName
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return a.name.localeCompare(b.name);
    });
  }, [employees]);

  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-6">
      <h3 className="text-xl font-semibold text-center mb-6 pb-2 border-b-2 border-blue-500 text-slate-700 dark:text-slate-200">{department}</h3>
      <div className="flex flex-wrap justify-center gap-6">
        {sortedEmployees.map(emp => <EmployeeCard key={emp.id} employee={emp} />)}
      </div>
    </div>
  );
};

const OrganizationChartPage: React.FC<OrganizationChartPageProps> = ({ employees }) => {
  const employeesByDepartment = useMemo(() => {
    const grouped: { [key: string]: Employee[] } = {};
    employees.forEach(employee => {
      const dept = employee.departmentName || '未所属'; // Use departmentName
      if (!grouped[dept]) {
        grouped[dept] = [];
      }
      grouped[dept].push(employee);
    });
    return grouped;
  }, [employees]);

  const departments = Object.keys(employeesByDepartment).sort();

  return (
    <div className="space-y-8">
        {departments.map(dept => (
            <DepartmentSection key={dept} department={dept} employees={employeesByDepartment[dept]} />
        ))}
        {employees.length === 0 && (
             <div className="text-center py-16 text-slate-500 dark:text-slate-400">
                <Users className="w-12 h-12 mx-auto text-slate-400" />
                <p className="mt-4 font-semibold">従業員データがありません。</p>
            </div>
        )}
    </div>
  );
};

export default OrganizationChartPage;