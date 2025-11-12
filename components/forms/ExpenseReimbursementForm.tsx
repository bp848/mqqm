import React, { useState, useMemo, useRef, useEffect } from 'react';
// FIX: Add missing import for submitApplication.
import { submitApplication } from '../../services/dataService.ts';
import { extractInvoiceDetails } from '../../services/geminiService.ts';
import ApprovalRouteSelector from './ApprovalRouteSelector.tsx';
import AccountItemSelect from './AccountItemSelect.tsx';
import PaymentRecipientSelect from './PaymentRecipientSelect.tsx';
import DepartmentSelect from './DepartmentSelect.tsx';
import { Loader, Upload, PlusCircle, Trash2, AlertTriangle } from '../Icons.tsx';
import { User, InvoiceData, Customer, AccountItem, Job, PurchaseOrder, Department, AllocationDivision } from '../../types.ts';

interface ExpenseReimbursementFormProps {
    onSuccess: () => void;
    applicationCodeId: string;
    currentUser: User | null;
    customers: Customer[];
    accountItems: AccountItem[];
    jobs: Job[];
    purchaseOrders: PurchaseOrder[];
    departments: Department[];
    isAIOff: boolean;
    isLoading: boolean;
    error: string;
    allocationDivisions: AllocationDivision[];
}

interface ExpenseDetail {
    id: string;
    paymentDate: string;
    paymentRecipientId: string;
    description: string;
    allocationTarget: string;
    costType: 'V' | 'F';
    accountItemId: string;
    allocationDivisionId: string;
    amount: number;
    p: number; // Price
    v: number; // Variable Cost
    q: number; // Quantity
}

const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result.split(',')[1]) : reject("Read failed");
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
};

const ExpenseReimbursementForm: React.FC<ExpenseReimbursementFormProps> = ({ onSuccess, applicationCodeId, currentUser, customers, accountItems, jobs, purchaseOrders, departments, isAIOff, isLoading, error: formLoadError, allocationDivisions }) => {
    const [departmentId, setDepartmentId] = useState<string>('');
    // TODO: Implement the full form logic here
    // For now, return a placeholder to resolve the error.
    return (
        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm text-center">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-4">経費精算フォーム</h2>
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
            <p className="mt-4 text-slate-600 dark:text-slate-400">経費精算フォームは現在開発中です。</p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-500">お手数ですが、手動での入力をお待ちください。</p>
        </div>
    );
};

export default ExpenseReimbursementForm;