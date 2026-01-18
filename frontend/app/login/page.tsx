'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import GoogleOAuthButton from '@/components/GoogleOAuthButton';

function LoginForm() {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ email: '', password: '', name: '', geminiApiKey: '', resendApiKey: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('token');
    if (token) {
      router.push('/');
      return;
    }

    // Handle OAuth callback success
    const token_param = searchParams.get('token');
    const success_param = searchParams.get('success');
    const error_param = searchParams.get('error');

    if (token_param && success_param === 'true') {
      localStorage.setItem('token', token_param);
      setSuccess('Successfully signed in with Google!');
      setTimeout(() => {
        router.push('/');
      }, 1000);
    } else if (error_param) {
      setError('OAuth authentication failed. Please try again.');
    }
  }, [router, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const endpoint = isLogin ? api.endpoints.auth.login : api.endpoints.auth.register;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        if (data.message) {
          setSuccess(data.message);
        }
        
        setTimeout(() => {
          router.push('/');
        }, 1000);
      } else {
        if (data.isOAuthAccount) {
          setError(data.error + ' Use the Google sign-in button below.');
        } else {
          setError(data.error || 'Authentication failed');
        }
      }
    } catch (err) {
      setError('Connection error. Make sure the backend is running.');
    }
  };

  const handleOAuthError = (error: string) => {
    setError(error);
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4 py-8">
      {/* Grid Background */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#1a1a1a_1px,transparent_1px),linear-gradient(to_bottom,#1a1a1a_1px,transparent_1px)] bg-[size:4rem_4rem]"></div>

      <div className="relative z-10 bg-zinc-900 border border-zinc-800 p-6 sm:p-8 w-full max-w-md">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tighter mb-2 font-display">
            <span className="text-cyan-400">[</span>
            ARIA
            <span className="text-cyan-400">]</span>
          </h1>
          <p className="text-gray-500 text-[10px] sm:text-xs tracking-wider">&gt; AUTHENTICATION_REQUIRED</p>
        </div>

        {/* Google OAuth Button */}
        <div className="mb-6">
          <GoogleOAuthButton mode={isLogin ? 'login' : 'signup'} onError={handleOAuthError} />
          <p className="text-center text-[10px] text-gray-600 font-mono mt-2">
            Recommended: Easier setup with Google account
          </p>
        </div>

        {/* Divider */}
        <div className="flex items-center mb-6">
          <div className="flex-1 border-t border-zinc-700"></div>
          <span className="px-3 text-[10px] text-gray-500 font-mono">OR_USE_EMAIL_SIGNUP</span>
          <div className="flex-1 border-t border-zinc-700"></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          {!isLogin && (
            <div>
              <label className="text-[10px] sm:text-xs text-gray-500 mb-1 block">&gt; NAME</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2.5 sm:py-2 bg-zinc-800 border border-zinc-700 text-gray-300 text-sm focus:outline-none focus:border-cyan-500 font-mono"
                required
              />
            </div>
          )}

          <div>
            <label className="text-[10px] sm:text-xs text-gray-500 mb-1 block">&gt; EMAIL</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2.5 sm:py-2 bg-zinc-800 border border-zinc-700 text-gray-300 text-sm focus:outline-none focus:border-cyan-500 font-mono"
              required
            />
          </div>

          <div>
            <label className="text-[10px] sm:text-xs text-gray-500 mb-1 block">&gt; PASSWORD</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3 py-2.5 sm:py-2 bg-zinc-800 border border-zinc-700 text-gray-300 text-sm focus:outline-none focus:border-cyan-500 font-mono"
              required
            />
          </div>

          {!isLogin && (
            <div>
              <label className="text-[10px] sm:text-xs text-gray-500 mb-1 block">&gt; GEMINI_API_KEY *</label>
              <input
                type="password"
                value={formData.geminiApiKey}
                onChange={(e) => setFormData({ ...formData, geminiApiKey: e.target.value })}
                className="w-full px-3 py-2.5 sm:py-2 bg-zinc-800 border border-zinc-700 text-gray-300 text-sm focus:outline-none focus:border-cyan-500 font-mono"
                placeholder="AIzaSy..."
                required
              />
              <p className="text-[10px] text-gray-600 mt-1 font-mono">
                Get your API key from: 
                <a 
                  href="https://makersuite.google.com/app/apikey" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 ml-1"
                >
                  makersuite.google.com
                </a>
              </p>
            </div>
          )}

          {!isLogin && (
            <div>
              <label className="text-[10px] sm:text-xs text-gray-500 mb-1 block">&gt; RESEND_API_KEY *</label>
              <input
                type="password"
                value={formData.resendApiKey}
                onChange={(e) => setFormData({ ...formData, resendApiKey: e.target.value })}
                className="w-full px-3 py-2.5 sm:py-2 bg-zinc-800 border border-zinc-700 text-gray-300 text-sm focus:outline-none focus:border-cyan-500 font-mono"
                placeholder="re_..."
                required
              />
              <p className="text-[10px] text-gray-600 mt-1 font-mono">
                Get your API key from: 
                <a 
                  href="https://resend.com/api-keys" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 ml-1"
                >
                  resend.com/api-keys
                </a>
              </p>
            </div>
          )}

          {error && (
            <p className="text-red-400 text-[10px] sm:text-xs font-mono border border-red-900 bg-red-950/20 p-2 break-words">
              ERROR: {error}
            </p>
          )}

          {success && (
            <p className="text-green-400 text-[10px] sm:text-xs font-mono border border-green-900 bg-green-950/20 p-2 break-words">
              SUCCESS: {success}
            </p>
          )}

          <button
            type="submit"
            className="w-full py-3 sm:py-2 bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 text-black font-mono text-sm transition-colors"
          >
            [ {isLogin ? 'LOGIN' : 'REGISTER'} ]
          </button>
        </form>

        {!isLogin && (
          <div className="mt-4 p-3 bg-zinc-800 border border-zinc-700 text-[10px] text-gray-500 font-mono">
            <p className="mb-1">&gt; ALL_USERS_GET:</p>
            <ul className="space-y-1 ml-2">
              <li>• Email reminders for tasks</li>
              <li>• Personal API key usage</li>
              <li>• Full voice features</li>
              <li>• Backup API key support</li>
              <li>• Personal email notifications</li>
            </ul>
          </div>
        )}

        <button
          onClick={() => setIsLogin(!isLogin)}
          className="w-full mt-4 text-gray-500 hover:text-cyan-400 text-[10px] sm:text-xs font-mono transition-colors"
        >
          {isLogin ? '&gt; CREATE_ACCOUNT' : '&gt; BACK_TO_LOGIN'}
        </button>
      </div>
    </div>
  );
}

export default function Login() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-cyan-400 font-mono text-sm">Loading...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
