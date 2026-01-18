'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { Key, ArrowLeft } from 'lucide-react';

function SignupForm() {
  const [formData, setFormData] = useState({
    geminiApiKey: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userInfo, setUserInfo] = useState<{
    email: string;
    name: string;
  } | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check if this is an OAuth signup
    const isOAuth = searchParams.get('oauth') === 'google';
    const email = searchParams.get('email');
    const name = searchParams.get('name');

    if (isOAuth && email && name) {
      setUserInfo({
        email: decodeURIComponent(email),
        name: decodeURIComponent(name),
      });
    } else {
      // If not OAuth signup, redirect to login
      router.push('/login');
    }
  }, [searchParams, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!formData.geminiApiKey.trim()) {
      setError('Gemini API key is required');
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(api.endpoints.oauth.completeSignup, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          geminiApiKey: formData.geminiApiKey.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        router.push('/');
      } else {
        setError(data.error || 'Signup failed');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    router.push('/login');
  };

  if (!userInfo) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-cyan-400 font-mono">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4 py-8">
      {/* Grid Background */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#1a1a1a_1px,transparent_1px),linear-gradient(to_bottom,#1a1a1a_1px,transparent_1px)] bg-[size:4rem_4rem]"></div>

      <div className="relative z-10 bg-zinc-900 border border-zinc-800 p-6 sm:p-8 w-full max-w-md">
        <div className="mb-6 sm:mb-8">
          <button
            onClick={handleBackToLogin}
            className="flex items-center gap-2 text-gray-500 hover:text-cyan-400 text-xs font-mono mb-4 transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            BACK_TO_LOGIN
          </button>
          
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tighter mb-2 font-display">
            <span className="text-cyan-400">[</span>
            SETUP
            <span className="text-cyan-400">]</span>
          </h1>
          <p className="text-gray-500 text-[10px] sm:text-xs tracking-wider">&gt; COMPLETE_YOUR_ACCOUNT</p>
        </div>

        {/* User Info */}
        <div className="mb-6 p-4 bg-zinc-800 border border-zinc-700">
          <p className="text-xs text-gray-500 mb-1">&gt; GOOGLE_ACCOUNT</p>
          <p className="text-sm text-gray-300 font-mono">{userInfo.name}</p>
          <p className="text-xs text-gray-500 font-mono">{userInfo.email}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] sm:text-xs text-gray-500 mb-2 block flex items-center gap-2">
              <Key className="w-3 h-3" />
              GEMINI_API_KEY *
            </label>
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

          {error && (
            <p className="text-red-400 text-[10px] sm:text-xs font-mono border border-red-900 bg-red-950/20 p-2 break-words">
              ERROR: {error}
            </p>
          )}

          <div className="bg-zinc-800 border border-zinc-700 p-3 text-[10px] text-gray-500 font-mono">
            <p className="mb-2">&gt; WHY_API_KEY_REQUIRED:</p>
            <ul className="space-y-1 ml-2">
              <li>• Voice commands powered by your API</li>
              <li>• Email reminders for your tasks</li>
              <li>• Link categorization & search</li>
              <li>• Backup key support for failover</li>
            </ul>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 sm:py-2 bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 text-black font-mono text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                <span>CREATING_ACCOUNT...</span>
              </div>
            ) : (
              '[ COMPLETE_SETUP ]'
            )}
          </button>
        </form>

        <div className="mt-4 text-center">
          <p className="text-[10px] text-gray-600 font-mono">
            You can add a backup API key later in profile settings
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Signup() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-cyan-400 font-mono text-sm">Loading...</div>
      </div>
    }>
      <SignupForm />
    </Suspense>
  );
}