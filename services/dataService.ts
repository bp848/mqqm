import { v4 as uuidv4 } from 'uuid';
import type { User as AuthUser } from '@supabase/supabase-js';
import { supabase, hasSupabaseCredentials } from './supabaseClient.ts';
import {
  EmployeeUser,
  Job,
  Customer,
  JournalEntry,
  AccountItem,
  Lead,
  AllocationDivision,
  AnalysisHistory,
  Application,
  ApplicationCode,
  ApplicationWithDetails,
  ApprovalRoute,
  BugReport,
  BugReportStatus,
  Department,
  Employee,
  Estimate,
  EstimateLineItem,
  EstimateStatus,
  InboxItem,
  InboxItemStatus,
  InventoryItem,
  Invoice,
  InvoiceData,
  InvoiceItem,
  InvoiceStatus,
  JobStatus,
  LeadStatus,
  MailOpenStatus,
  ManufacturingStatus,
  PaymentRecipient,
  PostalInfo,
  PostalStatus,
  Project,
  ProjectAttachment,
  ProjectStatus,
  PurchaseOrder,
  PurchaseOrderStatus,
  Title,
  UUID,
  TrackingInfo,
} from '../types.ts';

type MinimalAuthUser = Pick<AuthUser, 'id'> & {
  email?: string | null;
  user_metadata?: { [key: string]: any; full_name?: string | null } | null;
};

// FIX: Add missing signInWithGoogle function.
export const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin,
        },
    });
    if (error) {
        throw error;
    }
};

const deepClone = <T>(value: T): T => {
  // In a real Supabase implementation, data would come directly from the DB,
  // so deep cloning wouldn't be strictly necessary for persistence.
  // Keeping this for consistency where objects might be modified locally before saving.
  return JSON.parse(JSON.stringify(value));
};

const findById = <T extends { id: UUID }>(
  collection: T[],
  id: UUID,
  entityName: string
): T => {
  const item = collection.find((it) => it.id === id);
  if (!item) {
    throw new Error(`${entityName} with ID ${id} not found`);
  }
  return item;
};

function calculateEstimateTotals(items: EstimateLineItem[], taxInclusive: boolean) {
  let subtotal = 0;
  let taxTotal = 0;
  const normalized = items.map((it) => {
    const rowSubtotal = it.qty * it.unitPrice;
    const rate = it.taxRate ?? 0.1;
    const rowTax = taxInclusive ? Math.round(rowSubtotal - rowSubtotal / (1 + rate)) : Math.round(rowSubtotal * rate);
    const rowTotal = taxInclusive ? rowSubtotal : rowSubtotal + rowTax;
    subtotal += rowSubtotal;
    taxTotal += rowTax;
    return {
      ...it,
      subtotal: Math.round(rowSubtotal),
      taxAmount: rowTax,
      total: rowTotal,
    };
  });
  const grandTotal = taxInclusive ? Math.round(subtotal) : Math.round(subtotal + taxTotal);
  return { items: normalized, subtotal: Math.round(subtotal), taxTotal, grandTotal };
}

const mapApplicationDetails = (app: Application, allUsers: EmployeeUser[], appCodes: ApplicationCode[], approvalRoutes: ApprovalRoute[]): ApplicationWithDetails => ({
    ...app,
    applicant: allUsers.find(u => u.id === app.applicantId),
    applicationCode: appCodes.find(code => code.id === app.applicationCodeId),
    approvalRoute: approvalRoutes.find(route => route.id === app.approvalRouteId),
});


export const isSupabaseUnavailableError = (error: any): boolean => {
  if (!error) return false;
  const message = typeof error === 'string' ? error : error.message || error.details || error.error_description;
  if (!message) return false;
  return /fetch failed/i.test(message) || /failed to fetch/i.test(message) || /network/i.test(message) || /supabase/i.test(message);
};

export const resolveUserSession = async (authUser: MinimalAuthUser): Promise<EmployeeUser> => {
    const { data: existingUser, error: fetchError } = await supabase
        .from('v_employees_active')
        .select('*')
        .eq('user_id', authUser.id)
        .single();
    
    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116: "exact one row was not found"
        console.error('Error fetching user profile:', fetchError);
        throw fetchError;
    }

    if (existingUser) {
        return {
            id: existingUser.user_id,
            employeeNumber: existingUser.employee_number, // NEW
            name: existingUser.name || '', // Added fallback for 'name'
            departmentId: existingUser.department_id, // NEW
            departmentName: existingUser.department_name, // NEW
            positionId: existingUser.position_id, // NEW
            positionName: existingUser.position_name, // NEW
            email: existingUser.email,
            role: existingUser.role,
            canUseAnythingAnalysis: existingUser.can_use_anything_analysis,
            startDate: existingUser.start_date, // NEW (renamed from hire_date in DB)
            endDate: existingUser.end_date, // NEW
            createdAt: existingUser.created_at,
        };
    }

    // User does not exist, create profile
    const now = new Date().toISOString();
    const newUserProfileData = {
        id: authUser.id,
        name: authUser.user_metadata?.full_name || authUser.email || '新規ユーザー',
        email: authUser.email,
        role: 'user' as const,
        can_use_anything_analysis: true,
        created_at: now,
    };

    // Attempt to insert into public.users. If it already exists (e.g. from a previous auth, but no employee), ignore the conflict.
    const { error: usersInsertError } = await supabase.from('users').insert(newUserProfileData);
    if (usersInsertError && usersInsertError.code !== '23505') { // 23505 is unique violation, meaning it already exists
        console.error('Error creating user profile in users table:', usersInsertError);
        throw usersInsertError;
    }

    const newEmployeeData = {
        user_id: authUser.id,
        name: newUserProfileData.name,
        start_date: now, // Default to now (renamed from hire_date)
        created_at: now,
    };
    // Attempt to insert into public.employees. If it already exists, ignore the conflict.
    const { error: employeesInsertError } = await supabase.from('employees').insert(newEmployeeData);
    if (employeesInsertError && employeesInsertError.code !== '23505') {
        console.error('Error creating user profile in employees table:', employeesInsertError);
        throw employeesInsertError;
    }
    
    return {
        id: newUserProfileData.id,
        name: newUserProfileData.name || '', // Added fallback for 'name'
        employeeNumber: null, // Default null for new employees
        departmentId: null,
        departmentName: null,
        positionId: null,
        positionName: null,
        email: newUserProfileData.email || null,
        role: newUserProfileData.role,
        canUseAnythingAnalysis: newUserProfileData.can_use_anything_analysis,
        startDate: newEmployeeData.start_date,
        endDate: null,
        createdAt: newUserProfileData.created_at,
    };
};

export const getUsers = async (): Promise<EmployeeUser[]> => {
    const { data, error } = await supabase
        .from('v_employees_active')
        .select('user_id, employee_number, name, department_id, department_name, position_id, position_name, email, role, can_use_anything_analysis, start_date, end_date, created_at'); // UPDATED select clause

    if (error) {
        console.error('Error fetching users:', error);
        throw error;
    }

    return data.map((item: any) => ({
        id: item.user_id,
        employeeNumber: item.employee_number, // NEW
        name: item.name || '', // Added fallback for 'name'
        departmentId: item.department_id, // NEW
        departmentName: item.department_name, // NEW
        positionId: item.position_id, // NEW
        positionName: item.position_name, // NEW
        email: item.email,
        role: item.role,
        canUseAnythingAnalysis: item.can_use_anything_analysis,
        startDate: item.start_date, // NEW
        endDate: item.end_date, // NEW
        createdAt: item.created_at,
    }));
};

export const addUser = async (input: {
  name: string;
  email: string | null;
  role: 'admin' | 'user';
  canUseAnythingAnalysis?: boolean;
  departmentId?: UUID | null; // Changed to ID
  positionId?: UUID | null; // Changed to ID
  employeeNumber?: string | null; // NEW
  startDate?: string | null; // NEW
  endDate?: string | null; // NEW
}): Promise<EmployeeUser> => {
  throw new Error("ユーザーの新規作成はSupabaseダッシュボードから招待を行ってください。この画面では既存ユーザーの権限編集のみ可能です。");
  return {} as EmployeeUser; // FIX: Added return statement to satisfy linter
};

export const updateUser = async (id: UUID, updates: Partial<EmployeeUser>): Promise<EmployeeUser> => {
  const { role, canUseAnythingAnalysis, name, email, employeeNumber, departmentId, positionId, startDate, endDate } = updates; // UPDATED destructured fields

  if (role || canUseAnythingAnalysis !== undefined || email) {
      const userProfileUpdates: any = {};
      if (role) userProfileUpdates.role = role;
      if (canUseAnythingAnalysis !== undefined) userProfileUpdates.can_use_anything_analysis = canUseAnythingAnalysis;
      if (email) userProfileUpdates.email = email;
      
      const { error: usersError } = await supabase.from('users').update(userProfileUpdates).eq('id', id);
      if (usersError) throw usersError;
  }

  const employeeProfileUpdates: any = {};
  if (name) employeeProfileUpdates.name = name;
  if (employeeNumber !== undefined) employeeProfileUpdates.employee_number = employeeNumber; // NEW
  if (departmentId !== undefined) employeeProfileUpdates.department_id = departmentId; // CHANGED
  if (positionId !== undefined) employeeProfileUpdates.position_id = positionId; // CHANGED
  if (startDate !== undefined) employeeProfileUpdates.start_date = startDate; // NEW (renamed from hire_date in DB)
  if (endDate !== undefined) employeeProfileUpdates.end_date = endDate; // NEW
  
  if (Object.keys(employeeProfileUpdates).length > 0) {
      const { error: employeesError } = await supabase
        .from('employees')
        .update(employeeProfileUpdates)
        .eq('user_id', id);
      if (employeesError) throw employeesError;
  }
  
  const { data, error } = await supabase.from('v_employees_active').select('*').eq('user_id', id).single(); // UPDATED select *
  if (error) throw error;
  
  return {
      id: data.user_id,
      employeeNumber: data.employee_number, // NEW
      name: data.name || '', // Added fallback for 'name'
      departmentId: data.department_id, // NEW
      departmentName: data.department_name, // NEW
      positionId: data.position_id, // NEW
      positionName: data.position_name, // NEW
      email: data.email,
      role: data.role,
      canUseAnythingAnalysis: data.can_use_anything_analysis,
      startDate: data.start_date, // NEW
      endDate: data.end_date, // NEW
      createdAt: data.created_at,
  };
};

export const deleteUser = async (id: UUID): Promise<void> => {
    const { error } = await supabase.from('employees').update({ active: false }).eq('user_id', id);
    if (error) throw error;
};

export const getJobs = async (): Promise<Job[]> => {
    const { data, error } = await supabase
        .from('jobs')
        .select('*, customers(customer_name)'); // Join to get customer name

    if (error) {
        console.error('Error fetching jobs:', error);
        throw error;
    }

    return data.map((item: any) => ({
        id: item.id,
        jobNumber: item.job_number,
        clientName: item.customers?.customer_name || '不明', // Use joined customer name
        title: item.title,
        status: item.status as JobStatus,
        dueDate: item.due_date,
        quantity: item.quantity,
        paperType: item.paper_type,
        finishing: item.finishing,
        details: item.details,
        createdAt: item.created_at,
        price: item.price,
        variableCost: item.variable_cost,
        invoiceStatus: item.invoice_status as InvoiceStatus,
        invoicedAt: item.invoiced_at,
        paidAt: item.paid_at,
        readyToInvoice: item.ready_to_invoice,
        invoiceId: item.invoice_id,
        manufacturingStatus: item.manufacturing_status as ManufacturingStatus,
        projectId: item.project_id,
        projectName: item.project_name,
        userId: item.user_id,
        customerId: item.customer_id,
    }));
};

export const addJob = async (job: Partial<Job>): Promise<Job> => {
    const { data, error } = await supabase
        .from('jobs')
        .insert({
            customer_id: job.customerId,
            title: job.title,
            status: job.status,
            due_date: job.dueDate,
            quantity: job.quantity,
            paper_type: job.paperType,
            finishing: job.finishing,
            details: job.details,
            price: job.price,
            variable_cost: job.variableCost,
            invoice_status: job.invoiceStatus,
            manufacturing_status: job.manufacturingStatus,
            project_id: job.projectId,
            user_id: job.userId,
            // job_number will be generated by DB trigger/sequence
        })
        .select('*')
        .single();

    if (error) throw error;
    return data as Job; // Cast to Job
};

export const updateJob = async (id: UUID, updates: Partial<Job>): Promise<Job> => {
    const { data, error } = await supabase
        .from('jobs')
        .update({
            customer_id: updates.customerId,
            title: updates.title,
            status: updates.status,
            due_date: updates.dueDate,
            quantity: updates.quantity,
            paper_type: updates.paperType,
            finishing: updates.finishing,
            details: updates.details,
            price: updates.price,
            variable_cost: updates.variableCost,
            invoice_status: updates.invoiceStatus,
            invoiced_at: updates.invoicedAt,
            paid_at: updates.paidAt,
            ready_to_invoice: updates.readyToInvoice,
            invoice_id: updates.invoiceId,
            manufacturing_status: updates.manufacturingStatus,
            project_id: updates.projectId,
            user_id: updates.userId,
        })
        .eq('id', id)
        .select('*')
        .single();

    if (error) throw error;
    return data as Job;
};

export const deleteJob = async (id: UUID): Promise<void> => {
    const { error } = await supabase
        .from('jobs')
        .delete()
        .eq('id', id);

    if (error) throw error;
};

export const getCustomers = async (): Promise<Customer[]> => {
    const { data, error } = await supabase
        .from('customers')
        .select('*');

    if (error) throw error;
    return data as Customer[];
};

export const addCustomer = async (customer: Partial<Customer>): Promise<Customer> => {
    const { data, error } = await supabase
        .from('customers')
        .insert({
            customer_name: customer.customerName,
            customer_code: customer.customerCode,
            representative: customer.representative,
            phone_number: customer.phoneNumber,
            address1: customer.address1,
            company_content: customer.companyContent,
            annual_sales: customer.annualSales,
            employees_count: customer.employeesCount,
            note: customer.note,
            info_sales_activity: customer.infoSalesActivity,
            info_requirements: customer.infoRequirements,
            info_history: customer.infoHistory,
            website_url: customer.websiteUrl,
            customer_rank: customer.customerRank,
            sales_type: customer.salesType,
            credit_limit: customer.creditLimit,
            customer_contact_info: customer.customerContactInfo,
            ai_analysis: customer.aiAnalysis,
            user_id: customer.userId,
            // Add other fields as necessary
        })
        .select('*')
        .single();

    if (error) throw error;
    return data as Customer;
};

export const updateCustomer = async (id: UUID, updates: Partial<Customer>): Promise<Customer> => {
    const { data, error } = await supabase
        .from('customers')
        .update({
            customer_name: updates.customerName,
            customer_code: updates.customerCode,
            representative: updates.representative,
            phone_number: updates.phoneNumber,
            address1: updates.address1,
            company_content: updates.companyContent,
            annual_sales: updates.annualSales,
            employees_count: updates.employeesCount,
            note: updates.note,
            info_sales_activity: updates.infoSalesActivity,
            info_requirements: updates.infoRequirements,
            info_history: updates.infoHistory,
            website_url: updates.websiteUrl,
            customer_rank: updates.customerRank,
            sales_type: updates.salesType,
            credit_limit: updates.creditLimit,
            customer_contact_info: updates.customerContactInfo,
            ai_analysis: updates.aiAnalysis,
            user_id: updates.userId,
            customer_name_kana: updates.customerNameKana,
            post_no: updates.postNo,
            address_2: updates.address2,
            fax: updates.fax,
            closing_day: updates.closingDay,
            monthly_plan: updates.monthlyPlan,
            pay_day: updates.payDay,
            recovery_method: updates.recoveryMethod,
            name2: updates.name2,
            zip_code: updates.zipCode,
            foundation_date: updates.foundationDate,
            capital: updates.capital,
            customer_division: updates.customerDivision,
            pay_money: updates.payMoney,
            bank_name: updates.bankName,
            branch_name: updates.branchName,
            account_no: updates.accountNo,
            sales_user_code: updates.salesUserCode,
            start_date: updates.startDate,
            end_date: updates.endDate,
            drawing_date: updates.drawingDate,
            sales_goal: updates.salesGoal,
            info_sales_ideas: updates.infoSalesIdeas,
        })
        .eq('id', id)
        .select('*')
        .single();

    if (error) throw error;
    return data as Customer;
};

export const deleteCustomer = async (id: UUID): Promise<void> => {
    const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id);

    if (error) throw error;
};

export const getJournalEntries = async (): Promise<JournalEntry[]> => {
    const { data, error } = await supabase
        .from('journal_entries') // Assuming 'journal_entries' is the table name
        .select('*');

    if (error) throw error;
    return data as JournalEntry[];
};

export const addJournalEntry = async (entry: Omit<JournalEntry, 'id'>): Promise<JournalEntry> => {
    const { data, error } = await supabase
        .from('journal_entries')
        .insert({
            date: entry.date || new Date().toISOString(),
            account: entry.account,
            debit: entry.debit,
            credit: entry.credit,
            description: entry.description,
            status: entry.status || 'posted',
        })
        .select('*')
        .single();

    if (error) throw error;
    return data as JournalEntry;
};


export const getAccountItems = async (): Promise<AccountItem[]> => {
    const { data, error } = await supabase
        .from('account_items')
        .select('*');

    if (error) throw error;
    return data as AccountItem[];
};

export const getActiveAccountItems = async (): Promise<AccountItem[]> => {
    const { data, error } = await supabase
        .from('account_items')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

    if (error) throw error;
    return data as AccountItem[];
};

export const addAccountItem = async (item: Partial<AccountItem>): Promise<AccountItem> => {
    const { data, error } = await supabase
        .from('account_items')
        .insert({
            code: item.code,
            name: item.name,
            category_code: item.categoryCode,
            is_active: item.isActive,
            sort_order: item.sortOrder,
            mq_code: item.mqCode,
            mq_code_p: item.mqCodeP,
            mq_code_v: item.mqCodeV,
            mq_code_m: item.mqCodeM,
            mq_code_q: item.mqCodeQ,
            mq_code_f: item.mqCodeF,
            mq_code_g: item.mqCodeG,
        })
        .select('*')
        .single();
    if (error) throw error;
    return data as AccountItem;
};

export const updateAccountItem = async (id: UUID, updates: Partial<AccountItem>): Promise<AccountItem> => {
    const { data, error } = await supabase
        .from('account_items')
        .update({
            code: updates.code,
            name: updates.name,
            category_code: updates.categoryCode,
            is_active: updates.isActive,
            sort_order: updates.sortOrder,
            mq_code: updates.mqCode,
            mq_code_p: updates.mqCodeP,
            mq_code_v: updates.mqCodeV,
            mq_code_m: updates.mqCodeM,
            mq_code_q: updates.mqCodeQ,
            mq_code_f: updates.mqCodeF,
            mq_code_g: updates.mqCodeG,
        })
        .eq('id', id)
        .select('*')
        .single();
    if (error) throw error;
    return data as AccountItem;
};

export const deleteAccountItem = async (id: UUID): Promise<void> => {
    const { error } = await supabase
        .from('account_items')
        .update({ is_active: false }) // Soft delete
        .eq('id', id);
    if (error) throw error;
};


export const getLeads = async (): Promise<Lead[]> => {
    const { data, error } = await supabase
        .from('leads')
        .select('*');

    if (error) throw error;
    return data as Lead[];
};

export const addLead = async (lead: Partial<Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Lead> => {
    const { data, error } = await supabase
        .from('leads')
        .insert({
            company: lead.company,
            name: lead.name,
            email: lead.email,
            phone: lead.phone,
            status: lead.status || LeadStatus.New,
            source: lead.source,
            message: lead.message,
            tags: lead.tags,
            inquiry_types: lead.inquiryTypes,
            info_sales_activity: lead.infoSalesActivity,
            // Map other fields
        })
        .select('*')
        .single();

    if (error) throw error;
    return data as Lead;
};

export const updateLead = async (id: UUID, updates: Partial<Lead>): Promise<Lead> => {
    const { data, error } = await supabase
        .from('leads')
        .update({
            company: updates.company,
            name: updates.name,
            email: updates.email,
            phone: updates.phone,
            status: updates.status,
            source: updates.source,
            message: updates.message,
            tags: updates.tags,
            inquiry_types: updates.inquiryTypes,
            info_sales_activity: updates.infoSalesActivity,
            ai_investigation: updates.aiInvestigation,
            ai_draft_proposal: updates.aiDraftProposal,
            updated_at: new Date().toISOString(),
            score: updates.score,
            // Map other fields
        })
        .eq('id', id)
        .select('*')
        .single();

    if (error) throw error;
    return data as Lead;
};

export const deleteLead = async (id: UUID): Promise<void> => {
    const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', id);

    if (error) throw error;
};

export const getApprovalRoutes = async (): Promise<ApprovalRoute[]> => {
    const { data, error } = await supabase
        .from('approval_routes')
        .select('*');

    if (error) throw error;
    return data as ApprovalRoute[];
};

export const addApprovalRoute = async (route: Omit<ApprovalRoute, 'id' | 'createdAt'>): Promise<ApprovalRoute> => {
    const { data, error } = await supabase
        .from('approval_routes')
        .insert({
            name: route.name,
            route_data: route.routeData,
        })
        .select('*')
        .single();

    if (error) throw error;
    return data as ApprovalRoute;
};

export const updateApprovalRoute = async (id: UUID, updates: Partial<ApprovalRoute>): Promise<ApprovalRoute> => {
    const { data, error } = await supabase
        .from('approval_routes')
        .update({
            name: updates.name,
            route_data: updates.routeData,
        })
        .eq('id', id)
        .select('*')
        .single();

    if (error) throw error;
    return data as ApprovalRoute;
};

export const deleteApprovalRoute = async (id: UUID): Promise<void> => {
    const { error } = await supabase
        .from('approval_routes')
        .delete()
        .eq('id', id);

    if (error) throw error;
};

export const getPurchaseOrders = async (): Promise<PurchaseOrder[]> => {
    const { data, error } = await supabase
        .from('purchase_orders') // Assuming 'purchase_orders' is the table name
        .select('*');

    if (error) throw error;
    return data as PurchaseOrder[];
};

export const addPurchaseOrder = async (order: Omit<PurchaseOrder, 'id'>): Promise<PurchaseOrder> => {
    const { data, error } = await supabase
        .from('purchase_orders')
        .insert({
            supplier_name: order.supplierName,
            item_name: order.itemName,
            order_date: order.orderDate,
            quantity: order.quantity,
            unit_price: order.unitPrice,
            status: order.status,
        })
        .select('*')
        .single();

    if (error) throw error;
    return data as PurchaseOrder;
};

export const getInventoryItems = async (): Promise<InventoryItem[]> => {
    const { data, error } = await supabase
        .from('inventory_items') // Assuming 'inventory_items' is the table name
        .select('*');

    if (error) throw error;
    return data as InventoryItem[];
};

export const addInventoryItem = async (item: Omit<InventoryItem, 'id'>): Promise<InventoryItem> => {
    const { data, error } = await supabase
        .from('inventory_items')
        .insert({
            name: item.name,
            category: item.category,
            quantity: item.quantity,
            unit: item.unit,
            unit_price: item.unitPrice,
        })
        .select('*')
        .single();

    if (error) throw error;
    return data as InventoryItem;
};

export const updateInventoryItem = async (id: UUID, updates: Partial<InventoryItem>): Promise<InventoryItem> => {
    const { data, error } = await supabase
        .from('inventory_items')
        .update({
            name: updates.name,
            category: updates.category,
            quantity: updates.quantity,
            unit: updates.unit,
            unit_price: updates.unitPrice,
        })
        .eq('id', id)
        .select('*')
        .single();

    if (error) throw error;
    return data as InventoryItem;
};


export const getEmployees = async (): Promise<Employee[]> => {
    const { data, error } = await supabase
        .from('employees')
        .select('*, departments(name), employee_titles(name)'); // Join to get department and position names

    if (error) throw error;
    return data.map((item: any) => ({
        id: item.id,
        employeeNumber: item.employee_number,
        name: item.name,
        departmentId: item.department_id,
        departmentName: item.departments?.name || null,
        positionId: item.position_id,
        positionName: item.employee_titles?.name || null,
        startDate: item.start_date,
        endDate: item.end_date,
        salary: item.salary,
        createdAt: item.created_at,
    }));
};


export const getBugReports = async (): Promise<BugReport[]> => {
    const { data, error } = await supabase
        .from('bug_reports') // Assuming 'bug_reports' is the table name
        .select('*');

    if (error) throw error;
    return data as BugReport[];
};

export const addBugReport = async (report: Omit<BugReport, 'id' | 'createdAt' | 'status'> & { reporterName: string }): Promise<BugReport> => {
    const { data, error } = await supabase
        .from('bug_reports')
        .insert({
            reporter_name: report.reporterName,
            report_type: report.reportType,
            summary: report.summary,
            description: report.description,
            status: BugReportStatus.Open, // Default status for new reports
        })
        .select('*')
        .single();

    if (error) throw error;
    return data as BugReport;
};

export const updateBugReport = async (id: UUID, updates: Partial<BugReport>): Promise<BugReport> => {
    const { data, error } = await supabase
        .from('bug_reports')
        .update({
            status: updates.status,
            // Add other updatable fields as needed
        })
        .eq('id', id)
        .select('*')
        .single();

    if (ifError) throw error;
    return data as BugReport;
};


export const getEstimates = async (): Promise<Estimate[]> => {
    const { data, error } = await supabase
        .from('estimates')
        .select('*, users(name)'); // Assuming 'users' table has name

    if (error) throw error;
    return data.map((item: any) => ({
        id: item.id,
        estimateNumber: item.estimate_number,
        customerName: item.customer_name,
        title: item.title,
        items: item.items, // JSONB field
        subtotal: item.subtotal,
        taxTotal: item.tax_total,
        grandTotal: item.grand_total,
        deliveryDate: item.delivery_date,
        paymentTerms: item.payment_terms,
        deliveryTerms: item.delivery_terms,
        deliveryMethod: item.delivery_method,
        notes: item.notes,
        status: item.status as EstimateStatus,
        version: item.version,
        userId: item.user_id,
        user: item.users,
        projectId: item.project_id,
        projectName: item.project_name,
        taxInclusive: item.tax_inclusive,
        pdfUrl: item.pdf_url,
        tracking: item.tracking,
        postal: item.postal,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
    }));
};

export const addEstimate = async (estimate: Partial<Estimate>): Promise<Estimate> => {
    const { items, subtotal, taxTotal, grandTotal } = calculateEstimateTotals(estimate.items || [], estimate.taxInclusive || false);

    const { data, error } = await supabase
        .from('estimates')
        .insert({
            customer_name: estimate.customerName,
            title: estimate.title,
            items: items,
            subtotal: subtotal,
            tax_total: taxTotal,
            grand_total: grandTotal,
            delivery_date: estimate.deliveryDate,
            payment_terms: estimate.paymentTerms,
            delivery_terms: estimate.deliveryTerms,
            delivery_method: estimate.deliveryMethod,
            notes: estimate.notes,
            status: estimate.status,
            version: estimate.version,
            user_id: estimate.userId,
            project_id: estimate.projectId,
            project_name: estimate.projectName,
            tax_inclusive: estimate.taxInclusive,
            pdf_url: estimate.pdfUrl,
            tracking: estimate.tracking,
            postal: estimate.postal,
        })
        .select('*')
        .single();

    if (error) throw error;
    return data as Estimate;
};

export const updateEstimate = async (id: UUID, updates: Partial<Estimate>): Promise<Estimate> => {
    const { items, subtotal, taxTotal, grandTotal } = updates.items ? calculateEstimateTotals(updates.items, updates.taxInclusive || false) : {} as any;

    const { data, error } = await supabase
        .from('estimates')
        .update({
            customer_name: updates.customerName,
            title: updates.title,
            items: items || updates.items,
            subtotal: subtotal || updates.subtotal,
            tax_total: taxTotal || updates.taxTotal,
            grand_total: grandTotal || updates.grandTotal,
            delivery_date: updates.deliveryDate,
            payment_terms: updates.paymentTerms,
            delivery_terms: updates.deliveryTerms,
            delivery_method: updates.deliveryMethod,
            notes: updates.notes,
            status: updates.status,
            version: (updates.version !== undefined) ? updates.version + 1 : undefined,
            user_id: updates.userId,
            project_id: updates.projectId,
            project_name: updates.projectName,
            tax_inclusive: updates.taxInclusive,
            pdf_url: updates.pdfUrl,
            tracking: updates.tracking,
            postal: updates.postal,
            updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('*')
        .single();

    if (error) throw error;
    return data as Estimate;
};

export const deleteEstimate = async (id: UUID): Promise<void> => {
    const { error } = await supabase
        .from('estimates')
        .delete()
        .eq('id', id);

    if (error) throw error;
};

export const savePostal = async (estimateId: UUID, postalInfo: Partial<PostalInfo>): Promise<Estimate> => {
    return updateEstimate(estimateId, { postal: postalInfo as PostalInfo });
};

export const saveTracking = async (estimateId: UUID, trackingInfo: Partial<TrackingInfo>): Promise<Estimate> => {
    return updateEstimate(estimateId, { tracking: trackingInfo as TrackingInfo });
};


export const getApplications = async (currentUser: EmployeeUser): Promise<ApplicationWithDetails[]> => {
    const { data, error } = await supabase
        .from('applications')
        .select('*, application_codes(*), approval_routes(*), users!applicant_id(id, name, email, role, can_use_anything_analysis)'); // Adjust join for applicant details

    if (error) {
        console.error('Error fetching applications:', error);
        throw error;
    }

    const allUsers = (await getUsers()) || []; // Fetch all users for approver resolution
    const appCodes = (await getApplicationCodes()) || [];
    const approvalRoutes = (await getApprovalRoutes()) || [];

    const mappedApplications = data.map((item: any) => ({
        id: item.id,
        applicantId: item.applicant_id,
        applicationCodeId: item.application_code_id,
        formData: item.form_data,
        status: item.status,
        submittedAt: item.submitted_at,
        approvedAt: item.approved_at,
        rejectedAt: item.rejected_at,
        currentLevel: item.current_level,
        approverId: item.approver_id,
        rejectionReason: item.rejection_reason,
        approvalRouteId: item.approval_route_id,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        applicant: {
            id: item.users.id,
            name: item.users.name,
            email: item.users.email,
            role: item.users.role,
            canUseAnythingAnalysis: item.users.can_use_anything_analysis,
            createdAt: item.users.created_at, // Assuming created_at is also in the joined users table
        },
        applicationCode: item.application_codes,
        approvalRoute: item.approval_routes,
    }));

    return mappedApplications;
};

export const getApplicationCodes = async (): Promise<ApplicationCode[]> => {
    const { data, error } = await supabase
        .from('application_codes')
        .select('*');

    if (error) throw error;
    return data as ApplicationCode[];
};

export const submitApplication = async (
    applicationData: { applicationCodeId: UUID; formData: any; approvalRouteId: UUID },
    applicantId: UUID,
): Promise<Application> => {
    const { data: route, error: routeError } = await supabase
        .from('approval_routes')
        .select('route_data')
        .eq('id', applicationData.approvalRouteId)
        .single();

    if (routeError) throw routeError;
    if (!route || !route.route_data || !route.route_data.steps || route.route_data.steps.length === 0) {
        throw new Error('承認ルートが正しく設定されていません。');
    }

    const firstApproverId = route.route_data.steps[0].approver_id;

    const { data, error } = await supabase
        .from('applications')
        .insert({
            applicant_id: applicantId,
            application_code_id: applicationData.applicationCodeId,
            form_data: applicationData.formData,
            status: 'pending_approval',
            submitted_at: new Date().toISOString(),
            current_level: 1,
            approver_id: firstApproverId,
            approval_route_id: applicationData.approvalRouteId,
        })
        .select('*')
        .single();

    if (error) throw error;
    return data as Application;
};


export const approveApplication = async (application: ApplicationWithDetails, approver: EmployeeUser): Promise<ApplicationWithDetails> => {
    if (application.status !== 'pending_approval' || application.approverId !== approver.id) {
        throw new Error('この申請は承認できません。');
    }

    const route = application.approvalRoute;
    if (!route || !route.routeData || !route.routeData.steps) {
        throw new Error('承認ルート情報が見つかりません。');
    }

    const nextLevel = application.currentLevel + 1;
    const nextApproverStep = route.routeData.steps[nextLevel - 1];

    if (nextApproverStep) {
        // Move to next approver
        const { data, error } = await supabase
            .from('applications')
            .update({
                current_level: nextLevel,
                approver_id: nextApproverStep.approverId,
                updated_at: new Date().toISOString(),
            })
            .eq('id', application.id)
            .select('*, application_codes(*), approval_routes(*), users!applicant_id(id, name, email, role, can_use_anything_analysis)')
            .single();

        if (error) throw error;
        const allUsers = (await getUsers()) || [];
        return mapApplicationDetails(data as Application, allUsers, (await getApplicationCodes()), (await getApprovalRoutes()));
    } else {
        // Final approval
        const { data, error } = await supabase
            .from('applications')
            .update({
                status: 'approved',
                approved_at: new Date().toISOString(),
                approver_id: null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', application.id)
            .select('*, application_codes(*), approval_routes(*), users!applicant_id(id, name, email, role, can_use_anything_analysis)')
            .single();

        if (error) throw error;
        const allUsers = (await getUsers()) || [];
        return mapApplicationDetails(data as Application, allUsers, (await getApplicationCodes()), (await getApprovalRoutes()));
    }
};

export const rejectApplication = async (application: ApplicationWithDetails, reason: string, approver: EmployeeUser): Promise<ApplicationWithDetails> => {
    if (application.status !== 'pending_approval' || application.approverId !== approver.id) {
        throw new Error('この申請は差し戻しできません。');
    }

    const { data, error } = await supabase
        .from('applications')
        .update({
            status: 'rejected',
            rejected_at: new Date().toISOString(),
            rejection_reason: reason,
            approver_id: null,
            updated_at: new Date().toISOString(),
        })
        .eq('id', application.id)
        .select('*, application_codes(*), approval_routes(*), users!applicant_id(id, name, email, role, can_use_anything_analysis)')
        .single();

    if (error) throw error;
    const allUsers = (await getUsers()) || [];
    return mapApplicationDetails(data as Application, allUsers, (await getApplicationCodes()), (await getApprovalRoutes()));
};


export const getInvoices = async (): Promise<Invoice[]> => {
    const { data, error } = await supabase
        .from('invoices')
        .select('*, invoice_items(*)');

    if (error) throw error;
    return data as Invoice[];
};

export const createInvoiceFromJobs = async (jobIds: UUID[]): Promise<Invoice> => {
    const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select('*')
        .in('id', jobIds);

    if (jobsError) throw jobsError;
    if (!jobs || jobs.length === 0) throw new Error('請求対象の案件が見つかりません。');

    const customerName = jobs[0].clientName; // Assuming all jobs are for the same customer
    const invoiceNo = `INV-${Date.now().toString().slice(-8)}`; // Simple invoice number generation

    let subtotalAmount = 0;
    const invoiceItems: Omit<InvoiceItem, 'id' | 'invoiceId' | 'created_at'>[] = [];

    jobs.forEach((job, index) => {
        subtotalAmount += job.price;
        invoiceItems.push({
            jobId: job.id,
            description: job.title,
            quantity: 1, // Assuming 1 unit for the job itself, adjust if needed
            unit: '式',
            unitPrice: job.price,
            lineTotal: job.price,
            sortIndex: index,
        });
    });

    const taxAmount = Math.round(subtotalAmount * 0.1); // 10% tax
    const totalAmount = subtotalAmount + taxAmount;

    const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
            invoice_no: invoiceNo,
            invoice_date: new Date().toISOString().split('T')[0],
            customer_name: customerName,
            subtotal_amount: subtotalAmount,
            tax_amount: taxAmount,
            total_amount: totalAmount,
            status: 'issued',
        })
        .select('*')
        .single();

    if (invoiceError) throw invoiceError;

    // Insert invoice items
    const itemsToInsert = invoiceItems.map(item => ({
        ...item,
        invoice_id: invoice.id,
    }));
    const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(itemsToInsert);

    if (itemsError) throw itemsError;

    // Update jobs to mark them as invoiced
    const { error: updateJobsError } = await supabase
        .from('jobs')
        .update({ invoice_status: InvoiceStatus.Invoiced, invoice_id: invoice.id })
        .in('id', jobIds);

    if (updateJobsError) throw updateJobsError;

    return invoice as Invoice;
};

export const updateJobReadyToInvoice = async (jobId: UUID, ready: boolean): Promise<Job> => {
    const { data, error } = await supabase
        .from('jobs')
        .update({ ready_to_invoice: ready })
        .eq('id', jobId)
        .select('*')
        .single();

    if (error) throw error;
    return data as Job;
};


export const getInboxItems = async (): Promise<InboxItem[]> => {
    const { data, error } = await supabase
        .from('inbox_items')
        .select('*');

    if (error) throw error;
    return data as InboxItem[];
};

export const addInboxItem = async (item: Omit<InboxItem, 'id' | 'createdAt'>): Promise<InboxItem> => {
    const { data, error } = await supabase
        .from('inbox_items')
        .insert({
            file_name: item.fileName,
            file_path: item.filePath,
            mime_type: item.mimeType,
            status: item.status,
            extracted_data: item.extractedData,
            error_message: item.errorMessage,
        })
        .select('*')
        .single();

    if (error) throw error;
    return data as InboxItem;
};

export const updateInboxItem = async (id: UUID, updates: Partial<InboxItem>): Promise<InboxItem> => {
    const { data, error } = await supabase
        .from('inbox_items')
        .update({
            status: updates.status,
            extracted_data: updates.extractedData,
            error_message: updates.errorMessage,
        })
        .eq('id', id)
        .select('*')
        .single();

    if (error) throw error;
    return data as InboxItem;
};

export const deleteInboxItem = async (item: InboxItem): Promise<void> => {
    // Delete file from storage first
    const { error: storageError } = await supabase
        .storage
        .from('inbox')
        .remove([item.filePath]);

    if (storageError) {
        console.error("Error deleting file from storage:", storageError);
        throw storageError;
    }

    // Then delete record from database
    const { error: dbError } = await supabase
        .from('inbox_items')
        .delete()
        .eq('id', item.id);

    if (dbError) throw dbError;
};

export const uploadFile = async (file: File, bucketName: string): Promise<{ path: string }> => {
    const fileName = `${uuidv4()}-${file.name}`;
    const { data, error } = await supabase
        .storage
        .from(bucketName)
        .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false,
        });

    if (error) throw error;
    return { path: data.path };
};

export const getDepartments = async (): Promise<Department[]> => {
    const { data, error } = await supabase
        .from('departments')
        .select('*');
    if (error) throw error;
    return data as Department[];
};

export const addDepartment = async (department: Omit<Department, 'id' | 'createdAt'>): Promise<Department> => {
    const { data, error } = await supabase
        .from('departments')
        .insert({ name: department.name })
        .select('*')
        .single();
    if (error) throw error;
    return data as Department;
};

export const updateDepartment = async (id: UUID, updates: Partial<Department>): Promise<Department> => {
    const { data, error } = await supabase
        .from('departments')
        .update({ name: updates.name })
        .eq('id', id)
        .select('*')
        .single();
    if (error) throw error;
    return data as Department;
};

export const deleteDepartment = async (id: UUID): Promise<void> => {
    const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', id);
    if (error) throw error;
};

export const getPaymentRecipients = async (): Promise<PaymentRecipient[]> => {
    const { data, error } = await supabase
        .from('payment_recipients')
        .select('*');
    if (error) throw error;
    return data as PaymentRecipient[];
};

export const addPaymentRecipient = async (recipient: Omit<PaymentRecipient, 'id' | 'created_at' | 'updated_at'>): Promise<PaymentRecipient> => {
    const { data, error } = await supabase
        .from('payment_recipients')
        .insert({
            recipient_code: recipient.recipientCode,
            company_name: recipient.companyName,
            recipient_name: recipient.recipientName,
        })
        .select('*')
        .single();
    if (error) throw error;
    return data as PaymentRecipient;
};

export const updatePaymentRecipient = async (id: UUID, updates: Partial<PaymentRecipient>): Promise<PaymentRecipient> => {
    const { data, error } = await supabase
        .from('payment_recipients')
        .update({
            recipient_code: updates.recipientCode,
            company_name: updates.companyName,
            recipient_name: updates.recipientName,
        })
        .eq('id', id)
        .select('*')
        .single();
    if (error) throw error;
    return data as PaymentRecipient;
};

export const deletePaymentRecipient = async (id: UUID): Promise<void> => {
    const { error } = await supabase
        .from('payment_recipients')
        .delete()
        .eq('id', id);
    if (error) throw error;
};

export const getTitles = async (): Promise<Title[]> => {
    const { data, error } = await supabase
        .from('employee_titles')
        .select('*');
    if (error) throw error;
    return data as Title[];
};

export const addTitle = async (title: Omit<Title, 'id' | 'createdAt'>): Promise<Title> => {
    const { data, error } = await supabase
        .from('employee_titles')
        .insert({ name: title.name, is_active: title.isActive })
        .select('*')
        .single();
    if (error) throw error;
    return data as Title;
};

export const updateTitle = async (id: UUID, updates: Partial<Title>): Promise<Title> => {
    const { data, error } = await supabase
        .from('employee_titles')
        .update({ name: updates.name, is_active: updates.isActive })
        .eq('id', id)
        .select('*')
        .single();
    if (error) throw error;
    return data as Title;
};

export const deleteTitle = async (id: UUID): Promise<void> => {
    const { error } = await supabase
        .from('employee_titles')
        .delete()
        .eq('id', id);
    if (error) throw error;
};

export const getAllocationDivisions = async (): Promise<AllocationDivision[]> => {
    const { data, error } = await supabase
        .from('allocation_divisions')
        .select('*');
    if (error) throw error;
    return data as AllocationDivision[];
};

export const addAllocationDivision = async (division: Omit<AllocationDivision, 'id' | 'createdAt'>): Promise<AllocationDivision> => {
    const { data, error } = await supabase
        .from('allocation_divisions')
        .insert({ name: division.name, is_active: division.isActive })
        .select('*')
        .single();
    if (error) throw error;
    return data as AllocationDivision;
};

export const updateAllocationDivision = async (id: UUID, updates: Partial<AllocationDivision>): Promise<AllocationDivision> => {
    const { data, error } = await supabase
        .from('allocation_divisions')
        .update({ name: updates.name, is_active: updates.isActive })
        .eq('id', id)
        .select('*')
        .single();
    if (error) throw error;
    return data as AllocationDivision;
};

export const deleteAllocationDivision = async (id: UUID): Promise<void> => {
    const { error } = await supabase
        .from('allocation_divisions')
        .delete()
        .eq('id', id);
    if (error) throw error;
};

export const addProject = async (projectData: Partial<Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'attachments'>>, filesToUpload: { file: File, category: string }[]): Promise<Project> => {
    const { data: newProject, error: projectError } = await supabase
        .from('projects')
        .insert({
            project_name: projectData.projectName,
            customer_name: projectData.customerName,
            customer_id: projectData.customerId,
            status: projectData.status,
            overview: projectData.overview,
            extracted_details: projectData.extracted_details,
            user_id: projectData.userId,
        })
        .select('*')
        .single();

    if (projectError) throw projectError;

    if (filesToUpload && filesToUpload.length > 0) {
        for (const { file, category } of filesToUpload) {
            const { path, error: uploadError } = await uploadFile(file, 'project_attachments');
            if (uploadError) {
                console.error("Error uploading project attachment:", uploadError);
                // Decide whether to throw or just log and continue
                // For now, let's log and continue to allow project creation even if some files fail
            } else {
                const { error: attachmentError } = await supabase
                    .from('project_attachments')
                    .insert({
                        project_id: newProject.id,
                        file_name: file.name,
                        file_path: path,
                        mime_type: file.type,
                        category: category,
                        file_url: supabase.storage.from('project_attachments').getPublicUrl(path).data?.publicUrl || '' // Public URL
                    });
                if (attachmentError) console.error("Error inserting project attachment record:", attachmentError);
            }
        }
    }

    return newProject as Project;
};


export const getAnalysisHistory = async (): Promise<AnalysisHistory[]> => {
    const { data, error } = await supabase
        .from('analysis_history')
        .select('*');

    if (error) throw error;
    return data as AnalysisHistory[];
};

export const addAnalysisHistory = async (historyEntry: Omit<AnalysisHistory, 'id' | 'createdAt'>): Promise<AnalysisHistory> => {
    const { data, error } = await supabase
        .from('analysis_history')
        .insert({
            user_id: historyEntry.userId,
            viewpoint: historyEntry.viewpoint,
            data_sources: historyEntry.dataSources,
            result: historyEntry.result,
        })
        .select('*')
        .single();

    if (error) throw error;
    return data as AnalysisHistory;
};