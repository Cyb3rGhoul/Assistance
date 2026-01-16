'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ email: '', password: '', name: '' });
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

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
        router.push('/');
      } else {
        setError(data.error || 'Authentication failed');
      }
    } catch (err) {
      setError('Connection error. Make sure the backend is running.');
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      {/* Grid Background */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#1a1a1a_1px,transparent_1px),linear-gradient(to_bottom,#1a1a1a_1px,transparent_1px)] bg-[size:4rem_4rem]"></div>

      <div className="relative z-10 bg-zinc-900 border border-zinc-800 p-8 w-full max-w-md">
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tighter mb-2 font-display">
            <span className="text-cyan-400">[</span>
            ARIA
            <span className="text-cyan-400">]</span>
          </h1>
          <p className="text-gray-500 text-xs tracking-wider">&gt; AUTHENTICATION_REQUIRED</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">&gt; NAME</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 text-gray-300 text-sm focus:outline-none focus:border-cyan-500 font-mono"
                required
              />
            </div>
          )}

          <div>
            <label className="text-xs text-gray-500 mb-1 block">&gt; EMAIL</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 text-gray-300 text-sm focus:outline-none focus:border-cyan-500 font-mono"
              required
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">&gt; PASSWORD</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 text-gray-300 text-sm focus:outline-none focus:border-cyan-500 font-mono"
              required
            />
          </div>

          {error && (
            <p className="text-red-400 text-xs font-mono border border-red-900 bg-red-950/20 p-2">
              ERROR: {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-mono text-sm transition-colors"
          >
            [ {isLogin ? 'LOGIN' : 'REGISTER'} ]
          </button>
        </form>

        <button
          onClick={() => setIsLogin(!isLogin)}
          className="w-full mt-4 text-gray-500 hover:text-cyan-400 text-xs font-mono transition-colors"
        >
          {isLogin ? '&gt; CREATE_ACCOUNT' : '&gt; BACK_TO_LOGIN'}
        </button>
      </div>
    </div>
  );
}
