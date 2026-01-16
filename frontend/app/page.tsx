'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import VoiceAssistant from '@/components/VoiceAssistant';
import TaskList from '@/components/TaskList';
import { Power } from 'lucide-react';

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

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/login');
  };

  if (!isAuthenticated) return null;

  return (
    <main className="min-h-screen bg-black text-gray-100">
      {/* Grid Background */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#1a1a1a_1px,transparent_1px),linear-gradient(to_bottom,#1a1a1a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]"></div>

      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-12">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div>
              <h1 className="text-5xl font-bold tracking-tighter mb-2 font-display">
                <span className="text-cyan-400">[</span>
                ARIA
                <span className="text-cyan-400">]</span>
              </h1>
              <p className="text-gray-500 text-sm tracking-wider">
                &gt; ADAPTIVE.RESPONSIVE.INTELLIGENT.ASSISTANT
              </p>
            </div>
            
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-gray-400 hover:text-red-400 border border-zinc-800 hover:border-red-900 transition-all duration-200 text-sm"
            >
              <Power className="w-4 h-4" />
              <span>LOGOUT</span>
            </button>
          </div>
        </header>

        {/* Main Content */}
        <div className="grid lg:grid-cols-2 gap-6 max-w-7xl mx-auto">
          <VoiceAssistant />
          <TaskList />
        </div>

        {/* Footer */}
        <footer className="text-center mt-12 text-gray-600 text-xs">
          <p>&gt; POWERED_BY: GEMINI_AI | STATUS: ONLINE</p>
        </footer>
      </div>
    </main>
  );
}
