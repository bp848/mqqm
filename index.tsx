import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { supabase, hasSupabaseCredentials } from './services/supabaseClient';
// FIX: Import all necessary functions from dataService. Many of these were missing.
import { 
    resolveUserSession, getJobs, getCustomers, getJournalEntries, getAccountItems, getLeads, 
    getApprovalRoutes, getPurchaseOrders, getInventoryItems, getEmployees, getUsers, getBugReports, 
    getEstimates, getApplications, getApplicationCodes, getInvoices, getInboxItems, getDepartments, 
    getPaymentRecipients, getTitles, addJob, updateJob, deleteJob, addCustomer, updateCustomer, 
    deleteCustomer, addJournalEntry, addLead, updateLead, deleteLead, addBugReport, addEstimate,
    addProject,
} from './services/dataService';
import type { Page, EmployeeUser, Job, Customer, JournalEntry, AccountItem, Lead, ApprovalRoute, PurchaseOrder, InventoryItem, Employee, BugReport, Estimate, ApplicationWithDetails, ApplicationCode, Invoice, InboxItem, Department, PaymentRecipient, Title, Toast, ConfirmationDialogProps } from './types';

// Page Components
import Sidebar from './components/Sidebar';
import LoginPage from './components/LoginPage';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import JobList from './components/JobList';
import CustomerList from './components/CustomerList';
import LeadManagementPage from './components/sales/LeadManagementPage';
import SalesPipelinePage from './components/sales/SalesPipelinePage';
import EstimateManagementPage from './components/sales/EstimateManagementPage';
import BusinessSupportPage from './components/BusinessSupportPage';
import SalesRanking from './components/accounting/SalesRanking';
import PurchasingManagementPage from './components/purchasing/PurchasingManagementPage';
import InventoryManagementPage from './components/inventory/InventoryManagementPage';
import ManufacturingOrdersPage from './components/manufacturing/ManufacturingOrdersPage';
import ManufacturingPipelinePage from './components/manufacturing/ManufacturingPipelinePage';
import ManufacturingCostManagement from './components/accounting/ManufacturingCostManagement';
import OrganizationChartPage from './components/hr/OrganizationChartPage';
import ApprovalWorkflowPage from './components/accounting/ApprovalWorkflowPage';
import AccountingPage from './components/accounting/Accounting';
import BusinessPlanPage from './components/accounting/BusinessPlanPage';
import AIChatPage from './components/AIChatPage';
import LiveChatPage from './components/LiveChatPage';
import MarketResearchPage from './components/MarketResearchPage';
import AnythingAnalysisPage from './components/AnythingAnalysisPage';
import EstimateCreationPage from './components/sales/EstimateCreationPage';
import ProjectListPage from './components/sales/ProjectListPage';
import ProjectCreationPage from './components/sales/ProjectCreationPage';
import UserManagementPage from './components/admin/UserManagementPage';
import ApprovalRouteManagementPage from './components/admin/ApprovalRouteManagementPage';
import MasterManagementPage from './components/admin/MasterManagementPage';
import AuditLogPage from './components/admin/AuditLogPage';
import JournalQueuePage from './components/admin/JournalQueuePage';
import BugReportList from './components/admin/BugReportList';
import SettingsPage from './components/SettingsPage';
import PlaceholderPage from './components/PlaceholderPage';
// FIX: Import missing icons 'PlusCircle' and 'Bug'.
import { Loader, PlusCircle, Bug } from './components/Icons';
import { ToastContainer } from './components/Toast';
import ConfirmationDialog from './components/ConfirmationDialog';
import DemoModeBanner from './components/DemoModeBanner';
import DatabaseSetupInstructionsModal from './components/DatabaseSetupInstructionsModal';
import BugReportChatModal from './components/BugReportChatModal';


const App: React.FC = () => {
    const [isDemoMode, setIsDemoMode] = useState(!hasSupabaseCredentials());
    const [showDbSetup, setShowDbSetup] = useState(false);
    const [session, setSession] = useState<any | null>(null);
    const [currentUser, setCurrentUser] = useState<EmployeeUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState<Page>('analysis_dashboard');
    const [data, setData] = useState<any>({
        jobs: [], customers: [], journalEntries: [], accountItems: [], leads: [], approvalRoutes: [],
        purchaseOrders: [], inventoryItems: [], employees: [], allUsers: [], bugReports: [],
        estimates: [], applications: [], applicationCodes: [], invoices: [], inboxItems: [],
        departments: [], paymentRecipients: [], titles: [],
    });
    const [dataError, setDataError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [confirmationDialog, setConfirmationDialog] = useState<ConfirmationDialogProps | null>(null);
    const [isBugReportModalOpen, setIsBugReportModalOpen] = useState(false);
    
    const addToast = useCallback((message: string, type: Toast['type']) => {
        setToasts(prev => [...prev, { id: Date.now(), message, type }]);
    }, []);
    
    const requestConfirmation = useCallback((dialog: Omit<ConfirmationDialogProps, 'isOpen' | 'onClose'>) => {
        setConfirmationDialog({ ...dialog, isOpen: true, onClose: () => setConfirmationDialog(null) });
    }, []);
    
    const fetchData = useCallback(async () => {
        setDataError(null);
        try {
            const [
                jobs, customers, journalEntries, accountItems, leads, approvalRoutes,
                purchaseOrders, inventoryItems, employees, allUsers, bugReports,
                estimates, applications, applicationCodes, invoices, inboxItems,
                departments, paymentRecipients, titles
            ] = await Promise.all([
                getJobs(), getCustomers(), getJournalEntries(), getAccountItems(), getLeads(), getApprovalRoutes(),
                getPurchaseOrders(), getInventoryItems(), getEmployees(), getUsers(), getBugReports(),
                getEstimates(), getApplications(currentUser!), getApplicationCodes(), getInvoices(), getInboxItems(),
                getDepartments(), getPaymentRecipients(), getTitles()
            ]);
            setData({
                jobs, customers, journalEntries, accountItems, leads, approvalRoutes,
                purchaseOrders, inventoryItems, employees, allUsers, bugReports,
                estimates, applications, applicationCodes, invoices, inboxItems,
                departments, paymentRecipients, titles,
            });
        } catch (error: any) {
            console.error("Data fetching error:", error);
            setDataError(error.message || 'データの読み込みに失敗しました。');
            setIsDemoMode(true);
        }
    }, [currentUser]);

    useEffect(() => {
        if (!isDemoMode && currentUser) {
            fetchData();
        }
    }, [isDemoMode, currentUser, fetchData]);
    
    useEffect(() => {
        if (isDemoMode) return;

        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session?.user) {
                resolveUserSession(session.user).then(setCurrentUser).catch(e => {
                    console.error("Failed to resolve user session", e);
                    setDataError(e.message);
                    setIsDemoMode(true);
                });
            }
            setIsLoading(false);
        }).catch(e => {
            setIsLoading(false);
            setDataError(e.message);
            setIsDemoMode(true);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session?.user) {
                resolveUserSession(session.user).then(setCurrentUser).catch(console.error);
            } else {
                setCurrentUser(null);
            }
        });

        return () => subscription.unsubscribe();
    }, [isDemoMode]);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        setCurrentUser(null);
    };

    const handleRetryConnection = () => {
        setIsLoading(true);
        setDataError(null);
        setIsDemoMode(!hasSupabaseCredentials());
        // This will trigger the useEffect to re-attempt session check
    };
    
    const handleAddBugReport = async (report: any) => {
        await addBugReport(report);
        addToast('ご報告ありがとうございます！', 'success');
        setIsBugReportModalOpen(false);
        fetchData();
    };

    const getPageTitle = (page: Page): string => {
        const titleMap: Record<string, string> = {
            'analysis_dashboard': 'ホーム',
            'sales_leads': '問い合わせ管理',
            'sales_customers': '取引先',
            'sales_pipeline': '進捗管理',
            'sales_estimates': '見積管理',
            'estimate_creation': '新規見積作成',
            'project_list': '案件一覧',
            'project_creation': '新規案件作成',
        };
        return titleMap[page] || page.replace(/_/g, ' ');
    };
    
    const renderPage = () => {
        const commonProps = {
            ...data,
            currentUser,
            addToast,
            requestConfirmation,
            isAIOff: isDemoMode,
            onRefreshData: fetchData,
            onNavigate: setCurrentPage,
        };

        switch (currentPage) {
            case 'analysis_dashboard': return <Dashboard {...commonProps} pendingApprovalCount={data.applications.filter((a: any) => a.approverId === currentUser?.id && a.status === 'pending_approval').length} onNavigateToApprovals={() => setCurrentPage('approval_list')} />;
            case 'sales_leads': return <LeadManagementPage {...commonProps} searchTerm={searchTerm} onRefresh={fetchData} onUpdateLead={updateLead} onDeleteLead={deleteLead} onAddEstimate={addEstimate} />;
            case 'sales_customers': return <CustomerList {...commonProps} searchTerm={searchTerm} onSelectCustomer={() => {}} onUpdateCustomer={updateCustomer} onAnalyzeCustomer={() => {}} onNewCustomer={() => {}} />;
            case 'sales_pipeline': return <SalesPipelinePage {...commonProps} onUpdateJob={updateJob} onCardClick={() => {}} />;
            case 'sales_estimates': return <EstimateManagementPage {...commonProps} searchTerm={searchTerm} onNavigateToCreate={() => setCurrentPage('estimate_creation')} />;
            case 'estimate_creation': return <EstimateCreationPage {...commonProps} onCreateEstimate={addEstimate} onNavigateBack={() => setCurrentPage('sales_estimates')} />;
            case 'analysis_ranking': return <SalesRanking {...commonProps} />;
            case 'business_support_proposal': return <BusinessSupportPage {...commonProps} />;
            
            case 'project_list': return <ProjectListPage {...commonProps} onNavigateToCreate={() => setCurrentPage('project_creation')} />;
            case 'project_creation': return <ProjectCreationPage {...commonProps} onNavigateBack={() => setCurrentPage('project_list')} onProjectCreated={fetchData} />;
            
            case 'purchasing_orders': return <PurchasingManagementPage {...commonProps} />;
            case 'inventory_management': return <InventoryManagementPage {...commonProps} onSelectItem={() => {}} />;
            case 'manufacturing_orders': return <ManufacturingOrdersPage {...commonProps} onSelectJob={() => {}} />;
            case 'manufacturing_progress': return <ManufacturingPipelinePage {...commonProps} onUpdateJob={updateJob} onCardClick={() => {}} />;
            case 'manufacturing_cost': return <ManufacturingCostManagement {...commonProps} />;
            case 'hr_org_chart': return <OrganizationChartPage {...commonProps} />;
            
            case 'approval_list': return <ApprovalWorkflowPage {...commonProps} view="list" searchTerm={searchTerm} />;
            case 'approval_form_expense':
            case 'approval_form_transport':
            case 'approval_form_leave':
            case 'approval_form_approval':
            case 'approval_form_daily':
            case 'approval_form_weekly':
                const formCode = currentPage.split('_').pop()?.toUpperCase();
                return <ApprovalWorkflowPage {...commonProps} view="form" formCode={formCode} onSuccess={fetchData} />;

            case 'accounting_business_plan': return <BusinessPlanPage {...commonProps} />;
            case 'ai_business_consultant': return <AIChatPage {...commonProps} />;
            case 'ai_market_research': return <MarketResearchPage {...commonProps} />;
            case 'ai_live_chat': return <LiveChatPage {...commonProps} />;
            case 'ai_anything_analysis': return currentUser?.canUseAnythingAnalysis ? <AnythingAnalysisPage {...commonProps} /> : <PlaceholderPage title="なんでも分析 (権限がありません)" />;

            case 'admin_audit_log': return <AuditLogPage />;
            case 'admin_journal_queue': return <JournalQueuePage />;
            case 'admin_user_management': return <UserManagementPage {...commonProps} />;
            case 'admin_route_management': return <ApprovalRouteManagementPage {...commonProps} />;
            case 'admin_master_management': return <MasterManagementPage {...commonProps} onSaveAccountItem={() => Promise.resolve()} onDeleteAccountItem={() => Promise.resolve()} onSavePaymentRecipient={() => Promise.resolve()} onDeletePaymentRecipient={() => Promise.resolve()} onSaveAllocationDivision={() => Promise.resolve()} onDeleteAllocationDivision={() => Promise.resolve()} onSaveDepartment={() => Promise.resolve()} onDeleteDepartment={() => Promise.resolve()} onSaveTitle={() => Promise.resolve()} onDeleteTitle={() => Promise.resolve()} />;
            case 'admin_bug_reports': return <BugReportList {...commonProps} reports={data.bugReports} onUpdateReport={() => Promise.resolve()} searchTerm={searchTerm} />;
            case 'settings': return <SettingsPage {...commonProps} />;
            
            default:
                if (currentPage.startsWith('accounting_') || ['sales_billing', 'purchasing_invoices', 'purchasing_payments', 'hr_labor_cost'].includes(currentPage)) {
                    return <AccountingPage {...commonProps} page={currentPage} onAddEntry={addJournalEntry} />;
                }
                return <PlaceholderPage title={currentPage} />;
        }
    };
    
    if (isLoading && !isDemoMode) {
        return <div className="flex items-center justify-center h-screen bg-slate-100 dark:bg-slate-900"><Loader className="w-12 h-12 animate-spin text-blue-500" /></div>;
    }
    
    if (!currentUser && !isDemoMode) {
        return <LoginPage />;
    }

    return (
        <>
            <div className="flex h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} currentUser={currentUser} onSignOut={handleSignOut} />
                <div className="flex-1 flex flex-col overflow-hidden">
                    {isDemoMode && <DemoModeBanner error={dataError} onRetry={handleRetryConnection} onShowSetup={() => setShowDbSetup(true)} />}
                    <main className="flex-1 overflow-y-auto p-8 space-y-6">
                        <Header title={getPageTitle(currentPage)} search={{ value: searchTerm, onChange: setSearchTerm, placeholder: '検索...' }} primaryAction={{ label: '新規案件作成', onClick: () => {}, icon: PlusCircle }} />
                        {renderPage()}
                    </main>
                </div>
            </div>
            <ToastContainer toasts={toasts} onDismiss={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />
            {confirmationDialog && <ConfirmationDialog {...confirmationDialog} />}
            {showDbSetup && <DatabaseSetupInstructionsModal onRetry={handleRetryConnection} />}
            <button onClick={() => setIsBugReportModalOpen(true)} className="fixed bottom-8 right-8 bg-purple-600 text-white rounded-full p-4 shadow-lg hover:bg-purple-700 z-[100]">
                <Bug className="w-6 h-6"/>
                <span className="sr-only">バグ報告・改善要望</span>
            </button>
            {isBugReportModalOpen && <BugReportChatModal isOpen={isBugReportModalOpen} onClose={() => setIsBugReportModalOpen(false)} onReportSubmit={handleAddBugReport} isAIOff={isDemoMode} />}
        </>
    );
};

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
} else {
    console.error("Root element not found");
}