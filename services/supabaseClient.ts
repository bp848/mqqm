import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getEnvValue } from '../utils.ts';

// Supabase URL and Key are now exclusively obtained from environment variables or localStorage.
// They should NOT be hardcoded here.
const SUPABASE_URL = getEnvValue('VITE_SUPABASE_URL') || localStorage.getItem('supabaseUrl');
const SUPABASE_KEY = getEnvValue('VITE_SUPABASE_ANON_KEY') || localStorage.getItem('supabaseAnonKey');

// Supabaseクライアントを一度だけ初期化してエクスポート
export const supabase: SupabaseClient = createClient(
  SUPABASE_URL || 'http://localhost', // Fallback to avoid crash, but will be caught by hasSupabaseCredentials
  SUPABASE_KEY || 'dummy_key',        // Fallback to avoid crash
  {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true, // Essential for OAuth callback
        flowType: 'pkce',         // Recommended for OAuth
    },
});

// 既存コードとの互換性のためにgetSupabaseもエクスポート
export const getSupabase = (): SupabaseClient => {
    if (!SUPABASE_URL || !SUPABASE_KEY || SUPABASE_URL === 'http://localhost' || SUPABASE_KEY === 'dummy_key') {
        throw new Error("Supabase client is not properly configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables or configure via settings.");
    }
    return supabase;
};

// 接続情報が設定されているか確認する関数
export const hasSupabaseCredentials = (): boolean => {
    // 環境変数またはlocalStorageに有効な値が設定されているかを確認
    return !!(SUPABASE_URL && SUPABASE_KEY && 
              SUPABASE_URL !== 'http://localhost' && SUPABASE_KEY !== 'dummy_key' &&
              !SUPABASE_URL.includes('ここにURLを貼り付け') && !SUPABASE_KEY.includes('ここにキーを貼り付け'));
};