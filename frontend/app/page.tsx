'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import VoiceAssistant from '@/components/VoiceAssistant';
import TaskList from '@/components/TaskList';
import LinksManager from '@/components/LinksManager';
import ProfileModal from '@/components/ProfileModal';
import { Power, List, Link as LinkIcon, User } from 'lucide-react';

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'tasks' | 'links'>('tasks');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('token');
      const userData = localStorage.getItem('user');
      
      if (!token) {
        router.push('/login');
        return;
      }
      
      if (userData) {
        try {
          setUser(JSON.parse(userData));
        } catch (error) {
          console.error('Error parsing user data:', error);
        }
      }
      
      setIsAuthenticated(true);
      setIsLoading(false);
    };

    checkAuth();
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  // Show loading screen while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-cyan-400 font-mono text-sm">INITIALIZING...</p>
        </div>
      </div>
    );
  }

  // Don't render anything if not authenticated (will redirect)
  if (!isAuthenticated) return null;

  return (
    <main className="min-h-screen bg-black text-gray-100">
      {/* Grid Background */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#1a1a1a_1px,transparent_1px),linear-gradient(to_bottom,#1a1a1a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]"></div>

      <div className="relative z-10 container mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Header */}
        <header className="mb-6 sm:mb-12">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tighter mb-1 sm:mb-2 font-display">
                <span className="text-cyan-400">[</span>
                ARIA
                <span className="text-cyan-400">]</span>
              </h1>
              <p className="text-gray-500 text-[10px] sm:text-xs md:text-sm tracking-wider hidden sm:block">
                &gt; ADAPTIVE.RESPONSIVE.INTELLIGENT.ASSISTANT
              </p>
              <p className="text-gray-500 text-[10px] tracking-wider sm:hidden">
                &gt; A.R.I.A
              </p>
              {user && (
                <p className="text-gray-600 text-[10px] sm:text-xs font-mono mt-1">
                  &gt; WELCOME: {user.name} {user.isOAuthUser && <span className="text-cyan-400">OAUTH</span>}
                </p>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsProfileOpen(true)}
                className="flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-gray-400 hover:text-cyan-400 border border-zinc-800 hover:border-cyan-900 transition-all duration-200 text-xs sm:text-sm min-w-[40px] sm:min-w-auto"
              >
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">PROFILE</span>
              </button>
              
              <button
                onClick={handleLogout}
                className="flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-gray-400 hover:text-red-400 border border-zinc-800 hover:border-red-900 transition-all duration-200 text-xs sm:text-sm min-w-[40px] sm:min-w-auto"
              >
                <Power className="w-4 h-4" />
                <span className="hidden sm:inline">LOGOUT</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 max-w-7xl mx-auto">
          <VoiceAssistant />
          
          <div className="space-y-4">
            {/* Tab Navigation */}
            <div className="flex border border-zinc-800 bg-zinc-900">
              <button
                onClick={() => setActiveTab('tasks')}
                className={`flex-1 px-4 py-2 text-sm font-mono transition-colors flex items-center justify-center gap-2 ${
                  activeTab === 'tasks'
                    ? 'bg-cyan-500 text-black'
                    : 'text-gray-400 hover:text-cyan-400 hover:bg-zinc-800'
                }`}
              >
                <List className="w-4 h-4" />
                <span className="hidden sm:inline">TASKS</span>
              </button>
              <button
                onClick={() => setActiveTab('links')}
                className={`flex-1 px-4 py-2 text-sm font-mono transition-colors flex items-center justify-center gap-2 ${
                  activeTab === 'links'
                    ? 'bg-cyan-500 text-black'
                    : 'text-gray-400 hover:text-cyan-400 hover:bg-zinc-800'
                }`}
              >
                <LinkIcon className="w-4 h-4" />
                <span className="hidden sm:inline">LINKS</span>
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'tasks' ? <TaskList /> : <LinksManager />}
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center mt-6 sm:mt-12 text-gray-600 text-[10px] sm:text-xs">
          <p className="hidden sm:block">&gt; POWERED_BY: GEMINI_AI | STATUS: ONLINE</p>
          <p className="sm:hidden">&gt; ONLINE</p>
        </footer>
      </div>

      {/* Profile Modal */}
      <ProfileModal 
        isOpen={isProfileOpen} 
        onClose={() => setIsProfileOpen(false)} 
      />
    </main>
  );
}
