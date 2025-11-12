import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Customer, SortConfig, Toast, EmployeeUser } from '../types.ts';
import { Pencil, Eye, Mail, Lightbulb, Users, PlusCircle, Loader, Save, X, Search } from './Icons.tsx';
import EmptyState from './ui/EmptyState.tsx';
import SortableHeader from './ui/SortableHeader.tsx';
import { generateSalesEmail, enrichCustomerData } from '../services/geminiService.ts';
import { createSignature } from '../utils.ts';

interface CustomerListProps {
  customers: Customer[];
  searchTerm: string;
  onSelectCustomer: (customer: Customer) => void;
  onUpdateCustomer: (customerId: string, customerData: Partial<Customer>) => Promise<void>;
  onAnalyzeCustomer: (customer: Customer) => void;
  addToast: (message: string, type: Toast['type']) => void;
  currentUser: EmployeeUser | null;
  onNewCustomer: () => void;
  isAIOff: boolean;
}

const CustomerList: React.FC<CustomerListProps> = ({ customers, searchTerm, onSelectCustomer, onUpdateCustomer, onAnalyzeCustomer, addToast, currentUser, onNewCustomer, isAIOff }) => {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'customerName', direction: 'ascending' });
  const [isGeneratingEmail, setIsGeneratingEmail] = useState<string | null>(null);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editedData, setEditedData] = useState<Partial<Customer>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
        mounted.current = false;
    };
  }, []);

  const handleEditClick = (e: React.MouseEvent, customer: Customer) => {
    e.stopPropagation();
    setEditingRowId(customer.id);
    setEditedData(customer);
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingRowId(null);
    setEditedData({});
  };

  const handleSaveEdit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editingRowId) return;
    setIsSaving(true);
    try {
        await onUpdateCustomer(editingRowId, editedData);
    } finally {
        if (mounted.current) {
            setIsSaving(false);
            setEditingRowId(null);
        }
    }
  };

  const handleFieldChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditedData(prev => ({ ...prev, [name]: value }));
  };

  const handleGenerateProposal = async (e: React.MouseEvent, customer: Customer) => {
    e.stopPropagation();
    if (isAIOff) {
        addToast('AI機能は現在無効です。', 'error');
        return;
    }
    if (!currentUser) {
      addToast('ログインユーザー情報が見つかりません。', 'error');
      return;
    }
    setIsGeneratingEmail(customer.id);
    try {
      const { subject, body } = await generateSalesEmail(customer, currentUser.name);
      const signature = createSignature();
      const