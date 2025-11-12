import React from 'react';
import { signInWithGoogle } from '../services/dataService';
import { Package, GoogleIcon } from './Icons.tsx';

const LoginPage: React.FC = () => {
  const handleLoginWithGoogle = async () => {
    try {
        await signInWithGoogle();
    } catch (error: any) {
        alert(`ログインエラー: ${error.message}`);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-900 font-sans">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-2xl shadow-xl dark:bg-slate-800">
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2 text-slate-800 dark:text-white">
            <Package className="w-10 h-10 text-blue-600" />
            <h2 className="text-3xl font-bold">MQ会計ERP</h2>
          </div>
          <p className="mt-2 text-center text-slate-600 dark:text-slate-400">
            Googleアカウントでログインしてください
          </p>
        </div>
        <div>
          <button
            onClick={handleLoginWithGoogle}
            className="w-full flex justify-center items-center gap-3 px-4 py-3 font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-800 focus:ring-blue-500 dark:bg-slate-700 dark:text-white dark:border-slate-600 dark:hover:bg-slate-600 transition-colors"
          >
            <GoogleIcon className="w-5 h-5" />
            Googleでログイン
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
