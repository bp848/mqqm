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
      paper_type: job