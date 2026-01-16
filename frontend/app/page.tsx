'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import VoiceAssistant from '@/components/VoiceAssistant';
import TaskList from '@/components/TaskList';

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
    } else {
      setIsAuthenticated(true);
    }
  }, [router]);

  if (!isAuthenticated) return null;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-12">
          <h1 className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 mb-2">
            ARIA
          </h1>
          <p className="text-gray-300 text-lg">Adaptive Responsive Intelligent Assistant</p>
        </header>

        <div className="grid lg:grid-cols-2 gap-8">
          <VoiceAssistant />
          <TaskList />
        </div>
      </div>
    </main>
  );
}
