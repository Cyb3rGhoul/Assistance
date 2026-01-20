'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import SetupWizard from '@/components/SetupWizard';
import { ArrowLeft } from 'lucide-react';

function SignupForm() {
  const [userInfo, setUserInfo] = useState<{
    email: string;
    name: string;
  } | null>(null);
  const [tempToken, setTempToken] = useState<string>('');

  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check if this is an OAuth signup
    const isOAuth = searchParams.get('oauth') === 'google';
    const email = searchParams.get('email');
    const name = searchParams.get('name');
    const token = searchParams.get('token');

    if (isOAuth && email && name && token) {
      setUserInfo({
        email: decodeURIComponent(email),
        name: decodeURIComponent(name),
      });
      setTempToken(token);
    } else {
      // If not OAuth signup, redirect to login
      router.push('/login');
    }
  }, [searchParams, router]);

  const handleSetupComplete = (token: string, user: any) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    router.push('/');
  };

  const handleBack = () => {
    router.push('/login');
  };

  if (!userInfo || !tempToken) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-cyan-400 font-mono">Loading...</div>
      </div>
    );
  }

  return (
    <SetupWizard
      userInfo={userInfo}
      tempToken={tempToken}
      onComplete={handleSetupComplete}
      onBack={handleBack}
    />
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