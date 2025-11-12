

export type Page =
  | 'analysis_dashboard' | 'sales_leads' | 'sales_customers' | 'sales_pipeline' | 'sales_delivery'
  | 'sales_estimates' |
  | 'sales_orders' | 'sales_billing' | 'analysis_ranking'
  | 'purchasing_orders' | 'purchasing_invoices' | 'purchasing_payments' | 'purchasing_suppliers'
  | 'inventory_management' | 'manufacturing_orders' | 'manufacturing_progress' | 'manufacturing_cost'
  | 'hr_attendance' | 'hr_man_hours' | 'hr_labor_cost' | 'hr_org_chart'
  | 'approval_list' | 'approval_form_expense' | 'approval_form_transport' | 'approval_form_leave'
  | 'approval_form_approval' | 'approval_form_daily' | 'approval_form_weekly'
  | 'report_other' // New report page
  | 'accounting_journal' | 'accounting_general_ledger' | 'accounting_trial_balance'
  | 'accounting_tax_summary'
  | 'accounting_period_closing'
  | 'accounting_business_plan'
  | 'business_support_proposal'
  | 'ai_business_consultant'
  | 'ai_market_research'
  | 'ai_live_chat'
  | 'ai_anything_analysis' // New "Analyze Anything" page
  | 'estimate_creation' |
  | 'project_list' | 'project_creation' | // New project management pages
  | 'admin_audit_log' | 'admin_journal_queue' | 'admin_user_management' | 'admin_route_management'
  | 'admin_master_management' | 'admin_bug_reports' | 'settings';

export type UUID = string;

export enum JobStatus {
  Pending = '保留',
  InProgress = '進行中',
  Completed = '完了',
  Cancelled = 'キャンセル',
}

export enum InvoiceStatus {
  Uninvoiced = '未請求',
  Invoiced = '請求済',
  Paid = '入金済',
}

export enum LeadStatus {
    Untouched = '未対応',
    New = '新規',
    Contacted = 'コンタクト済',
    Qualified = '有望',
    Disqualified = '失注',
    Converted = '商談化',
    Closed = 'クローズ',
}

export enum PurchaseOrderStatus {
    Ordered = '発注済',
    Received = '受領済',
    Cancelled = 'キャンセル',
}

export enum ManufacturingStatus {
  OrderReceived = '受注',
  DataCheck = 'データチェック',
  Prepress = '製版',
  Printing = '印刷',
  Finishing = '加工',
  AwaitingShipment = '出荷待ち',
  Delivered = '納品済',
}

export enum EstimateStatus {
  Draft = '見積中',
  Ordered = '受注',
  Lost = '失注',
}

export enum ProjectStatus {
  Draft = '下書き',
  New = '新規',
  InProgress = '進行中',
  Completed = '完了',
  Cancelled = 'キャンセル',
  Archived = 'アーカイブ済',
}

export enum BugReportStatus {
    Open = '未対応',
    InProgress = '対応中',
    Closed = '完了',
}


export interface Job {
  id: UUID;
  jobNumber: string; // Changed from number to text to match DB schema
  clientName: string; // Deprecate - use projectName/customerId for lookup
  title: string;
  status: JobStatus;
  dueDate: string;
  quantity: number;
  paperType: string;
  finishing: string;
  details: string;
  createdAt: string;
  price: number;
  variableCost: number;
  invoiceStatus: InvoiceStatus;
  invoicedAt?: string | null;
  paidAt?: string | null;
  readyToInvoice?: boolean;
  invoiceId?: string | null;
  manufacturingStatus?: ManufacturingStatus;
  projectId?: UUID; // New: Link to project
  projectName?: string; // New: Derived from project for convenience
  userId?: UUID;
  customerId?: UUID; // Added to link job to customer
}

export interface JournalEntry {
  id: UUID;
  date: string;
  account: string;
  debit: number;
  credit: number;
  description: string;
  status?: 'posted' | 'pending' | 'rejected'; // Added status
}

// NOTE: User interface primarily for public.users table (auth-linked role/permissions)
export interface User {
  id: UUID;
  name: string;
  email: string | null;
  role: 'admin' | 'user';
  createdAt: string;
  canUseAnythingAnalysis?: boolean;
}

// EmployeeUser interface for composite employee-user profile (from v_employees_active view)
export interface EmployeeUser {
  id: UUID; // user_id from employees table / auth.users table
  name: string; // From employees table
  email: string; // From auth.users table (not nullable after join)
  role: 'admin' | 'user'; // From public.users table
  createdAt: string; // From public.users table
  canUseAnythingAnalysis?: boolean; // From public.users table

  // New fields from employees table (or derived from FKs)
  employeeNumber?: string | null; // From employees table
  departmentId?: UUID | null; // From employees table
  departmentName?: string | null; // From joining departments table
  positionId?: UUID | null; // From employees table
  positionName?: string | null; // From joining employee_titles table
  startDate?: string | null; // Corresponds to start_date in employees table
  endDate?: string | null; // From employees table
}

export interface Employee {
  id: UUID; // employees table PK
  name: string;
  
  // Changed to ID references
  departmentId: UUID | null;
  departmentName: string | null; // For display, usually joined from departments table
  positionId: UUID | null;
  positionName: string | null; // For display, usually joined from employee_titles table

  employeeNumber: string | null; // New field
  startDate: string; // Renamed from hireDate
  endDate: string | null; // New field
  salary: number;
  createdAt: string;
}

export interface Customer {
  id: UUID;
  customerCode?: string;
  customerName: string;
  customerNameKana?: string;
  representative?: string;
  phoneNumber?: string;
  address1?: string;
  companyContent?: string;
  annualSales?: string;
  employeesCount?: string;
  note?: string;
  infoSalesActivity?: string;
  infoRequirements?: string;
  infoHistory?: string;
  createdAt: string;
  postNo?: string;
  address2?: string;
  companyContactInfo?: string;
  fax?: string;
  closingDay?: string;
  monthlyPlan?: string;
  payDay?: string;
  recoveryMethod?: string;
  userId?: UUID;
  name2?: string;
  websiteUrl?: string;
  zipCode?: string;
  foundationDate?: string;
  capital?: string;
  customerRank?: string;
  customerDivision?: string;
  salesType?: string;
  creditLimit?: string;
  payMoney?: string;
  bankName?: string;
  branchName?: string;
  accountNo?: string;
  salesUserCode?: string;
  startDate?: string;
  endDate?: string;
  drawingDate?: string;
  salesGoal?: string;
  infoSalesIdeas?: string;
  customerContactInfo?: string; // for mailto
  aiAnalysis?: CompanyAnalysis | null;
}

export interface SortConfig {
  key: string;
  direction: 'ascending' | 'descending';
}

export interface AISuggestions {
    title: string;
    quantity: number;
    paperType: string;
    finishing: string;
    details: string;
    price: number;
    variableCost: number;
}

export interface CompanyAnalysis {
    swot: string;
    painPointsAndNeeds: string;
    suggestedActions: string;
    proposalEmail: {
        subject: string;
        body: string;
    };
    sources?: { uri: string; title: string; }[];
}

export interface CompanyInvestigation {
    summary: string;
    sources: {
        uri: string;
        title: string;
    }[];
}

export interface InvoiceData {
    vendorName: string;
    invoiceDate: string;
    totalAmount: number;
    description: string;
    costType: 'V' | 'F';
    account: string;
    relatedCustomer?: string;
    project?: string;
    allocationDivision?: string;
}

export interface AIJournalSuggestion {
    account: string;
    description: string;
    debit: number;
    credit: number;
}

export interface MQCode {
  P?: boolean; // Price / 売上高
  V?: boolean; // Variable Cost / 変動費
  M?: boolean; // Margin / 限界利益
  Q?: boolean; // Quantity / 数量
  F?: boolean; // Fixed Cost / 固定費
  G?: boolean; // Profit / 利益
}

export interface ApplicationCode {
    id: UUID;
    code: string;
    name: string;
    description: string;
    createdAt: string;
}

export interface EstimateItem {
    division: '用紙代' | 'デザイン・DTP代' | '刷版代' | '印刷代' | '加工代' | 'その他' | '初期費用' | '月額費用';
    content: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    price: number; // calculated price
    cost: number;
    costRate: number;
    subtotal: number;
}

// NEW: Estimate creation specific types
export type PostalMethod = 'inhouse_print' | 'outsourced_label';
export type PostalStatus = 'preparing' | 'shipped' | 'delivered';
export type MailOpenStatus = 'opened' | 'unopened' | 'forwarded';

export interface TrackingInfo {
  trackId: UUID;
  mailStatus: MailOpenStatus;     // 🟢 opened / 🟡 unopened / 🔵 forwarded
  lastEventAt?: string;           // ISO8601
  firstOpenedAt?: string;         // ISO8601
  totalOpens: number;
  totalClicks: number;
}

export interface PostalInfo {
  method: PostalMethod;
  status: PostalStatus;
  toName: string;
  toCompany?: string;
  postalCode?: string;
  prefecture?: string;
  city?: string;
  address1?: string;
  address2?: string;
  phone?: string;
  labelPreviewSvg?: string;       // 宛名ラベルSVG（プレビュー用）
}

export interface EstimateLineItem {
  sku?: string;
  name: string;
  description?: string;
  qty: number;
  unit: string;
  unitPrice: number;
  taxRate?: number; // 0.1 = 10%
  subtotal?: number;
  taxAmount?: number;
  total?: number;
}

export interface ExtractedParty {
  company?: string;
  department?: string;
  title?: string;
  person?: string;
  email?: string;
  tel?: string;
  address?: string;
  domain?: string;
  confidence?: number; // 0-1
}

export interface EstimateDraft {
  draftId: UUID;
  sourceSummary?: string; // 解析要約
  customerCandidates: ExtractedParty[];
  subjectCandidates: string[];
  paymentTerms?: string;
  deliveryTerms?: string;
  deliveryMethod?: string;
  currency: 'JPY';
  taxInclusive?: boolean;
  dueDate?: string; // ISO
  items: EstimateLineItem[];
  notes?: string;
}

export interface Estimate {
    id: UUID;
    estimateNumber: number; // Auto-generated display number
    customerName: string;
    title: string; // Subject for estimate
    items: EstimateLineItem[]; // Changed from EstimateItem[]
    // total: number; // Subtotal before tax - Removed as `subtotal` field exists
    deliveryDate: string;
    paymentTerms: string;
    deliveryTerms?: string; // Added from EstimateDraft
    deliveryMethod: string;
    notes: string;
    status: EstimateStatus;
    version: number;
    userId: UUID;
    user?: User;
    createdAt: string;
    updatedAt: string;
    projectId?: UUID; 
    projectName?: string;
    // NEW: Fields for tracking and postal
    subtotal: number; // Recalculated subtotal (no tax)
    taxTotal: number; // Recalculated tax total
    grandTotal: number; // Recalculated grand total (with tax)
    taxInclusive?: boolean; // Added for tax calculation logic
    pdfUrl?: string; // URL to the generated PDF
    tracking?: TrackingInfo;
    postal?: PostalInfo;
}

export interface ProjectAttachment {
  id: UUID;
  projectId: UUID;
  fileName: string;
  filePath: string;
  fileUrl: string;
  mimeType: string;
  category: string;
  createdAt: string;
}

export interface Project {
  id: UUID;
  projectName: string;
  customerName: string;
  customerId?: UUID;
  status: ProjectStatus;
  overview: string; // AI generated summary
  extracted_details: string; // AI extracted key details
  createdAt: string;
  updatedAt: string;
  userId: UUID;
  attachments?: ProjectAttachment[];
  relatedEstimates?: Partial<Estimate>[];
  relatedJobs?: Partial<Job>[];
}

// FIX: Removed duplicate properties from the Lead interface and adjusted inquiryType to inquiryTypes
export interface Lead {
    id: UUID;
    status: LeadStatus;
    createdAt: string; // 受信日時として利用
    name: string;
    email: string | null;
    phone: string | null;
    company: string;
    source: string | null;
    tags: string[] | null;
    message: string | null;
    updatedAt: string | null;
    referrer: string | null;
    referrerUrl: string | null;
    landingPageUrl: string | null;
    searchKeywords: string | null;
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    utmTerm: string | null;
    utmContent: string | null;
    userAgent: string | null;
    ipAddress: string | null;
    deviceType: string | null;
    browserName: string | null;
    osName: string | null;
    osVersion: string | null;
    screenResolution: string | null;
    viewportSize: string | null;
    language: string | null;
    timezone: string | null;
    sessionId: string | null;
    pageLoadTime: number | null;
    timeOnPage: number | null;
    ctaSource: string | null;
    scrollDepth: string | null;
    sectionsViewed: string | null;
    printTypes: string | null;
    aiAnalysisReport?: string;
    aiDraftProposal?: string;
    aiInvestigation?: CompanyInvestigation;
    assigneeId?: UUID; // Added assigneeId
    infoSalesActivity?: string;
    // NEW fields for comprehensive lead tracking
    isFirstVisit?: boolean;
    previousVisitDate?: string;
    visitCount?: number;
    browserVersion?: string;
    country?: string | null;
    city?: string | null;
    region?: string | null;
    employees?: string | null;
    budget?: string | null;
    timeline?: string | null;
    inquiryTypes?: string[] | null;
    score?: number;
}

export interface ApprovalRoute {
    id: UUID;
    name: string;
    routeData: {
        steps: { approverId: UUID }[];
    };
    createdAt: string;
}

export interface Application {
    id: UUID;
    applicantId: UUID;
    applicationCodeId: UUID;
    formData: any;
    status: 'draft' | 'pending_approval' | 'approved' | 'rejected'; // Changed to string literal types
    submittedAt: string | null;
    approvedAt: string | null;
    rejectedAt: string | null;
    currentLevel: number;
    approverId: UUID | null; // Corrected to UUID | null
    rejectionReason: string | null;
    approvalRouteId: UUID;
    createdAt: string;
    updatedAt?: string | null;
}

export interface ApplicationWithDetails extends Application {
    applicant?: User;
    applicationCode?: ApplicationCode;
    approvalRoute?: ApprovalRoute;
}

export interface AccountItem {
    id: UUID;
    code: string;
    name: string;
    categoryCode: string | null;
    isActive: boolean;
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
    mqCode?: MQCode; // Added mqCode
    mqCodeP?: string; // Additional MQ codes
    mqCodeV?: string;
    mqCodeM?: string;
    mqCodeQ?: string;
    mqCodeF?: string;
    mqCodeG?: string;
}

export interface PurchaseOrder {
    id: UUID;
    supplierName: string;
    itemName: string;
    orderDate: string;
    quantity: number;
    unitPrice: number;
    status: PurchaseOrderStatus;
    created_at?: string; // Added created_at
}

export interface InventoryItem {
    id: UUID;
    name: string;
    category: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    created_at?: string; // Added created_at
}

export interface BusinessPlan {
    name: string;
    headers: string[];
    items: {
        name: string;
        totalValue: number | string;
        data: {
            type: '目標' | '実績' | '前年';
            monthly: (number | string)[];
            cumulative: (number | string)[];
        }[];
    }[];
}

export interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
}
  
export interface ConfirmationDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onClose: () => void;
}

export interface LeadScore {
    score: number;
    rationale: string;
}

export interface BugReport {
  id: UUID;
  reporterName: string;
  reportType: 'bug' | 'improvement';
  summary: string;
  description: string;
  status: BugReportStatus;
  createdAt: string;
}

export interface ClosingChecklistItem {
    id: string;
    description: string;
    count: number;
    status: 'ok' | 'needs_review';
    actionPage?: Page;
}

export interface InvoiceItem {
    id: UUID;
    invoiceId: UUID;
    jobId?: UUID;
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    lineTotal: number;
    sortIndex: number;
    created_at?: string; // Added created_at
}

export interface Invoice {
    id: UUID;
    invoiceNo: string;
    invoiceDate: string;
    dueDate?: string;
    customerName: string;
    subtotalAmount: number;
    taxAmount: number;
    totalAmount: number;
    status: 'draft' | 'issued' | 'paid' | 'void';
    createdAt: string;
    paidAt?: string;
    items?: InvoiceItem[];
}

export enum InboxItemStatus {
  Processing = 'processing',
  PendingReview = 'pending_review',
  Approved = 'approved',
  Error = 'error',
}

export interface InboxItem {
    id: UUID;
    fileName: string;
    filePath: string;
    fileUrl: string;
    mimeType: string;
    status: InboxItemStatus;
    extractedData: InvoiceData | null;
    errorMessage: string | null;
    createdAt: string;
    docType?: string; // Added doc_type
}

export interface MasterAccountItem {
  id: UUID;
  code: string;
  name: string;
  categoryCode: string | null;
}

export interface PaymentRecipient {
  id: UUID;
  recipientCode: string;
  companyName: string | null;
  recipientName: string | null;
  created_at?: string; // Added created_at
  updated_at?: string; // Added updated_at
  isActive?: boolean; // Added is_active
}

export interface Department {
  id: UUID;
  name: string;
  createdAt?: string; // Added created_at
}

export interface CustomProposalContent {
  coverTitle: string;
  businessUnderstanding: string;
  challenges: string;
  proposal: string;
  conclusion: string;
}

export interface LeadProposalPackage {
  isSalesLead: boolean;
  reason: string;
  proposal?: CustomProposalContent;
  estimate?: EstimateItem[];
}

export interface AllocationDivision {
  id: UUID;
  name: string;
  isActive: boolean;
  createdAt: string;
}

export interface Title {
  id: UUID;
  name: string;
  isActive: boolean;
  createdAt: string;
}

export interface MarketResearchReport {
  title: string;
  summary: string;
  trends: string[];
  competitorAnalysis: string;
  opportunities: string[];
  threats: string[];
  sources?: { uri: string; title: string; }[];
}

export interface GeneratedEmailContent {
  subject: string;
  bodyText: string;
  bodyHtml?: string;
}

export interface EmailEnvelope {
  to: { name?: string; email: string }[];
  cc?: { name?: string; email: string }[];
  bcc?: { name?: string; email: string }[];
  subject: string;
  bodyText: string;    // 開封ピクセル/追跡URL付与前の本文
  bodyHtml?: string;   // 同上
  attachments?: { filename: string; url: string }[];
}

// New types for "Anything Analysis"
export interface AnalysisResult {
    title: string;
    summary: string;
    table: {
        headers: string[];
        rows: string[][];
    };
    chart: {
        type: 'bar' | 'line';
        data: { name: string; value: number }[];
    };
}

export interface AnalysisHistory {
    id: UUID;
    userId: UUID;
    viewpoint: string;
    dataSources: {
        filenames: string[];
        urls: string[];
    };
    result: AnalysisResult;
    createdAt: string;
}
// FIX: Export AuthUser type from supabase
import type { User as SupabaseAuthUser } from '@supabase/supabase-js';
export type AuthUser = SupabaseAuthUser;