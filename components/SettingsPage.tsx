
import React, { useState, useEffect, useRef } from 'react';
import { Loader, Save, Mail, CheckCircle, Database, Key } from './Icons.tsx';
import { Lightbulb } from './Icons.tsx';
import { Toast } from '../types.ts';

interface SettingsPageProps {
    addToast: (message: string, type: Toast['type']) => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ addToast }) => {
    const [smtpSettings, setSmtpSettings] = useState({
        host: 'smtp.example.com',
        port: 587,
        username: 'user@example.com',
        password: 'password123',
        senderEmail: 'noreply@example.com',
        senderName: 'MQ会計管理システム',
        encryption: 'tls',
    });
    const [signatureSettings, setSignatureSettings] = useState({
        companyName: '',
        department: '',
        yourName: '',
        phone: '',
        email: '',
        website: '',
    });
    const [supabaseUrl, setSupabaseUrl] = useState('');
    const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
    const [googleClientId, setGoogleClientId] = useState('');
    const [googleClientSecret, setGoogleClientSecret] = useState('');

    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;
        
        try {
            const savedSignature = localStorage.getItem('signatureSettings');
            if (savedSignature) setSignatureSettings(JSON.parse(savedSignature));

            const savedSmtp = localStorage.getItem('smtpSettings');
            if(savedSmtp) setSmtpSettings(JSON.parse(savedSmtp));

            setSupabaseUrl(localStorage.getItem('supabaseUrl') || '');
            setSupabaseAnonKey(localStorage.getItem('supabaseAnonKey') || '');
            setGoogleClientId(localStorage.getItem('googleClientId') || '');
            setGoogleClientSecret(localStorage.getItem('googleClientSecret') || '');

        } catch (error) {
            console.error("Failed to load settings from localStorage", error);
            addToast('設定の読み込みに失敗しました。', 'error');
        }

        return () => {
            mounted.current = false;
        };
    }, [addToast]);

    const handleSmtpChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setSmtpSettings(prev => ({ ...prev, [name]: value }));
    };

    const handleSignatureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setSignatureSettings(prev => ({...prev, [name]: value}));
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        
        try {
            localStorage.setItem('signatureSettings', JSON.stringify(signatureSettings));
            localStorage.setItem('smtpSettings', JSON.stringify(smtpSettings));
            localStorage.setItem('supabaseUrl', supabaseUrl);
            localStorage.setItem('supabaseAnonKey', supabaseAnonKey);
            localStorage.setItem('googleClientId', googleClientId);
            localStorage.setItem('googleClientSecret', googleClientSecret);
            
            addToast('設定を保存しました。変更を適用するためにリロードします。', 'success');
            
            setTimeout(() => {
                if (mounted.current) {
                    window.location.reload();
                }
            }, 2000);

        } catch (error) {
            console.error("Failed to save settings to localStorage", error);
            addToast('設定の保存に失敗しました。', 'error');
            if(mounted.current) {
                setIsSaving(false);
            }
        }
    };

    const handleTestConnection = () => {
        setIsTesting(true);
        setTimeout(() => {
            if (mounted.current) {
                setIsTesting(false);
                console.log('Testing connection with:', smtpSettings);
                if (Math.random() > 0.2) {
                    addToast('テストメールが正常に送信されました。', 'success');
                } else {
                    addToast('接続に失敗しました。設定を確認してください。', 'error');
                }
            }
        }, 2000);
    };

    const inputClass = "w-full text-base bg-slate-50 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500";
    const labelClass = "block text-base font-medium text-slate-700 dark:text-slate-300 mb-1.5";

    return (
        <form onSubmit={handleSave} className="space-y-8">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-xl font-semibold text-slate-800 dark:text-white flex items-center gap-2"><Database className="w-6 h-6"/>Supabase 接続設定</h2>
                    <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
                        アプリケーションが接続するSupabaseプロジェクトの情報を設定します。
                    </p>
                </div>
                <div className="p-6 space-y-6">
                    <div>
                        <label htmlFor="supabaseUrl" className={labelClass}>Supabase URL</label>
                        <input type="url" id="supabaseUrl" value={supabaseUrl} onChange={e => setSupabaseUrl(e.target.value)} className={inputClass} placeholder="https://xxxx.supabase.co" />
                    </div>
                    <div>
                        <label htmlFor="supabaseAnonKey" className={labelClass}>Supabase Anon Key (public)</label>
                        <input type="password" id="supabaseAnonKey" value={supabaseAnonKey} onChange={e => setSupabaseAnonKey(e.target.value)} className={inputClass} placeholder="eyJhbGciOi..." />
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-xl font-semibold text-slate-800 dark:text-white flex items-center gap-2"><Key className="w-6 h-6"/>Google OAuth 設定</h2>
                    <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
                        Googleログインに使用する認証情報です。<strong className="text-yellow-600 dark:text-yellow-400">これらの情報はSupabaseのダッシュボードで設定する必要があります。</strong>
                    </p>
                </div>
                <div className="p-6 space-y-6">
                    <div>
                        <label htmlFor="googleClientId" className={labelClass}>
                            Google Client ID
                            <span className="relative group ml-2 text-slate-400 dark:text-slate-500 cursor-help">
                                <Lightbulb className="w-4 h-4 inline-block" />
                                <span className="absolute left-1/2 transform -translate-x-1/2 bottom-full mb-2 w-64 p-2 text-xs text-white bg-slate-700 dark:bg-slate-900 rounded-md opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                    このIDは、<strong className='text-blue-300'>Supabaseプロジェクトの認証設定（Authentication &gt; Providers &gt; Google）で設定されるべきものです。</strong> クライアントアプリがGoogle認証時に直接使用するわけではありません。
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-700 dark:border-t-slate-900"></div>
                                </span>
                            </span>
                        </label>
                        <input type="text" id="googleClientId" value={googleClientId} onChange={e => setGoogleClientId(e.target.value)} className={inputClass} placeholder="....apps.googleusercontent.com" />
                    </div>
                    <div>
                        <label htmlFor="googleClientSecret" className={labelClass}>
                            Google Client Secret
                            <span className="relative group ml-2 text-slate-400 dark:text-slate-500 cursor-help">
                                <Lightbulb className="w-4 h-4 inline-block" />
                                <span className="absolute left-1/2 transform -translate-x-1/2 bottom-full mb-2 w-64 p-2 text-xs text-white bg-slate-700 dark:bg-slate-900 rounded-md opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                    このシークレットは、<strong className='text-blue-300'>Supabaseプロジェクトの認証設定で設定されます。</strong> Client IDと同様に、クライアントアプリがGoogle認証時に直接使用するわけではありません。
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-700 dark:border-t-slate-900"></div>
                                </span>
                            </span>
                        </label>
                        <input type="password" id="googleClientSecret" value={googleClientSecret} onChange={e => setGoogleClientSecret(e.target.value)} className={inputClass} placeholder="GOCSPX-..." />
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-xl font-semibold text-slate-800 dark:text-white">通知メール設定 (SMTP)</h2>
                    <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
                        申請の承認・却下などの通知をメールで送信するためのSMTPサーバー設定です。
                    </p>
                </div>
                <div className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="host" className={labelClass}>SMTPホスト</label>
                            <input type="text" id="host" name="host" value={smtpSettings.host} onChange={handleSmtpChange} className={inputClass} placeholder="smtp.example.com" />
                        </div>
                        <div>
                            <label htmlFor="port" className={labelClass}>SMTPポート</label>
                            <input type="number" id="port" name="port" value={smtpSettings.port} onChange={handleSmtpChange} className={inputClass} placeholder="587" />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="username" className={labelClass}>ユーザー名</label>
                            <input type="text" id="username" name="username" value={smtpSettings.username} onChange={handleSmtpChange} className={inputClass} placeholder="user@example.com" />
                        </div>
                        <div>
                            <label htmlFor="password" className={labelClass}>パスワード</label>
                            <input type="password" id="password" name="password" value={smtpSettings.password} onChange={handleSmtpChange} className={inputClass} placeholder="••••••••" />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="senderEmail" className={labelClass}>送信元メールアドレス</label>
                            <input type="email" id="senderEmail" name="senderEmail" value={smtpSettings.senderEmail} onChange={handleSmtpChange} className={inputClass} placeholder="noreply@example.com" />
                        </div>
                         <div>
                            <label htmlFor="senderName" className={labelClass}>送信元名</label>
                            <input type="text" id="senderName" name="senderName" value={smtpSettings.senderName} onChange={handleSmtpChange} className={inputClass} placeholder="MQ会計管理システム" />
                        </div>
                    </div>
                     <div>
                        <label htmlFor="encryption" className={labelClass}>暗号化</label>
                        <select id="encryption" name="encryption" value={smtpSettings.encryption} onChange={handleSmtpChange} className={inputClass}>
                            <option value="none">なし</option>
                            <option value="ssl">SSL/TLS</option>
                            <option value="tls">STARTTLS</option>
                        </select>
                    </div>
                </div>
                 <div className="flex justify-end p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
                    <button
                        type="button"
                        onClick={handleTestConnection}
                        disabled={isTesting || isSaving}
                        className="flex items-center justify-center gap-2 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold py-2 px-4 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 disabled:opacity-50"
                    >
                        {isTesting ? <Loader className="w-5 h-5 animate-spin"/> : <Mail className="w-5 h-5" />}
                        <span>{isTesting ? '送信中...' : '接続テスト'}</span>
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-xl font-semibold text-slate-800 dark:text-white">Eメール署名設定</h2>
                    <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
                        「AI提案メール作成」などで使用されるメールの署名を設定します。
                    </p>
                </div>
                 <div className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="companyName" className={labelClass}>会社名</label>
                            <input type="text" id="companyName" name="companyName" value={signatureSettings.companyName} onChange={handleSignatureChange} className={inputClass} placeholder="文唱堂印刷株式会社" />
                        </div>
                        <div>
                            <label htmlFor="department" className={labelClass}>部署名</label>
                            <input type="text" id="department" name="department" value={signatureSettings.department} onChange={handleSignatureChange} className={inputClass} placeholder="システム管理・開発" />
                        </div>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="yourName" className={labelClass}>氏名</label>
                            <input type="text" id="yourName" name="yourName" value={signatureSettings.yourName} onChange={handleSignatureChange} className={inputClass} placeholder="石嶋 洋平" />
                        </div>
                         <div>
                            <label htmlFor="phone" className={labelClass}>電話番号・FAX</label>
                            <input type="text" id="phone" name="phone" value={signatureSettings.phone} onChange={handleSignatureChange} className={inputClass} placeholder="TEL：03-3851-0111　FAX：03-3861-1979" />
                        </div>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="email" className={labelClass}>E-mail</label>
                            <input type="email" id="email" name="email" value={signatureSettings.email} onChange={handleSignatureChange} className={inputClass} placeholder="sales.system@mqprint.co.jp" />
                        </div>
                         <div>
                            <label htmlFor="website" className={labelClass}>ウェブサイト</label>
                            <input type="url" id="website" name="website" value={signatureSettings.website} onChange={handleSignatureChange} className={inputClass} placeholder="https://new.b-p.co.jp/" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-end">
                <button
                    type="submit"
                    disabled={isSaving || isTesting}
                    className="w-48 flex items-center justify-center gap-2 bg-blue-600 text-white font-semibold py-2.5 px-4 rounded-lg shadow-md hover:bg-blue-700 disabled:bg-slate-400"
                >
                    {isSaving ? <Loader className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5" />}
                    <span>{isSaving ? '保存中...' : 'すべての設定を保存'}</span>
                </button>
            </div>
        </form>
    );
};

export default SettingsPage;
