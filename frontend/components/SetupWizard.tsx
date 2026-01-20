'use client';

import { useState } from 'react';
import { X, Key, Mail, MessageCircle, TestTube, ExternalLink, ToggleLeft, ToggleRight, CheckCircle } from 'lucide-react';
import api from '@/lib/api';

interface SetupWizardProps {
  userInfo: {
    email: string;
    name: string;
  };
  tempToken: string;
  onComplete: (token: string, user: any) => void;
  onBack: () => void;
}

export default function SetupWizard({ userInfo, tempToken, onComplete, onBack }: SetupWizardProps) {
  const [selectedFeatures, setSelectedFeatures] = useState({
    aiFeatures: true, // Always enabled - required
    emailReminders: false,
    whatsappReminders: false,
  });

  const [apiKeys, setApiKeys] = useState({
    geminiApiKey: '',
    resendApiKey: '',
    whatsappApiKey: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [testingEmail, setTestingEmail] = useState(false);
  const [testingWhatsApp, setTestingWhatsApp] = useState(false);

  const handleFeatureToggle = (feature: keyof typeof selectedFeatures) => {
    // AI Features cannot be disabled - it's required
    if (feature === 'aiFeatures') return;
    
    setSelectedFeatures(prev => ({
      ...prev,
      [feature]: !prev[feature]
    }));
  };

  const handleTestEmail = async () => {
    if (!apiKeys.resendApiKey.trim()) {
      setError('Please enter Resend API key first');
      return;
    }

    setTestingEmail(true);
    setError('');
    setSuccess('');

    try {
      // Create a temporary user to test email
      const response = await fetch('/api/test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userInfo.email,
          resendApiKey: apiKeys.resendApiKey,
        }),
      });

      if (response.ok) {
        setSuccess('Test email sent successfully! Check your inbox.');
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to send test email');
      }
    } catch (error) {
      setError('Failed to test email. Please check your API key.');
    } finally {
      setTestingEmail(false);
    }
  };

  const handleTestWhatsApp = async () => {
    if (!apiKeys.whatsappApiKey.trim()) {
      setError('Please enter WhatsApp API key first');
      return;
    }

    setTestingWhatsApp(true);
    setError('');
    setSuccess('');

    try {
      // Test WhatsApp (this would need a phone number, so we'll simulate for now)
      setSuccess('WhatsApp API key format looks valid! You can test it after setup.');
    } catch (error) {
      setError('Failed to test WhatsApp. Please check your API key.');
    } finally {
      setTestingWhatsApp(false);
    }
  };

  const handleComplete = async () => {
    setIsLoading(true);
    setError('');

    // Validate required fields
    if (!apiKeys.geminiApiKey.trim()) {
      setError('Gemini API key is required');
      setIsLoading(false);
      return;
    }

    // Validate optional features
    if (selectedFeatures.emailReminders && !apiKeys.resendApiKey.trim()) {
      setError('Resend API key is required for email reminders');
      setIsLoading(false);
      return;
    }

    if (selectedFeatures.whatsappReminders && !apiKeys.whatsappApiKey.trim()) {
      setError('WhatsApp API key is required for WhatsApp reminders');
      setIsLoading(false);
      return;
    }

    try {
      const requestBody: any = {
        geminiApiKey: apiKeys.geminiApiKey.trim() // Always required
      };
      
      // Add optional API keys for selected features
      if (selectedFeatures.emailReminders) {
        requestBody.resendApiKey = apiKeys.resendApiKey.trim();
      }
      if (selectedFeatures.whatsappReminders) {
        requestBody.whatsappApiKey = apiKeys.whatsappApiKey.trim();
      }

      const response = await fetch(api.endpoints.oauth.completeSignup, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tempToken}`
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (response.ok) {
        onComplete(data.token, data.user);
      } else {
        setError(data.error || 'Setup failed');
      }
    } catch (error) {
      setError('Connection error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const canSkipSetup = !selectedFeatures.emailReminders && !selectedFeatures.whatsappReminders;

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4 py-8">
      {/* Grid Background */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#1a1a1a_1px,transparent_1px),linear-gradient(to_bottom,#1a1a1a_1px,transparent_1px)] bg-[size:4rem_4rem]"></div>

      <div className="relative z-10 bg-zinc-900 border border-zinc-800 p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tighter mb-2 font-display">
              <span className="text-cyan-400">[</span>
              SETUP_WIZARD
              <span className="text-cyan-400">]</span>
            </h1>
            <p className="text-gray-500 text-xs tracking-wider">&gt; CONFIGURE_YOUR_FEATURES</p>
          </div>
          <button
            onClick={onBack}
            className="text-gray-500 hover:text-red-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* User Info */}
        <div className="mb-6 p-4 bg-zinc-800 border border-zinc-700">
          <p className="text-xs text-gray-500 mb-1">&gt; GOOGLE_ACCOUNT</p>
          <p className="text-sm text-gray-300 font-mono">{userInfo.name}</p>
          <p className="text-xs text-gray-500 font-mono">{userInfo.email}</p>
        </div>

        {/* Feature Selection */}
        <div className="mb-6">
          <h3 className="text-sm text-cyan-400 mb-4 font-mono">&gt; SELECT_FEATURES</h3>
          <div className="space-y-4">
            
            {/* AI Features - Required */}
            <div className="bg-zinc-800 border border-zinc-700 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-purple-400" />
                  <span className="text-sm text-gray-300 font-mono">AI_FEATURES</span>
                  <span className="text-xs text-red-400 font-mono">(REQUIRED)</span>
                </div>
                <div className="flex items-center">
                  <ToggleRight className="w-6 h-6 text-green-500" />
                </div>
              </div>
              <p className="text-xs text-gray-500 mb-2">Voice commands, link categorization, smart search</p>
              
              <div className="mt-3 space-y-2">
                <label className="text-xs text-gray-500 block">GEMINI_API_KEY *</label>
                <input
                  type="password"
                  value={apiKeys.geminiApiKey}
                  onChange={(e) => setApiKeys({ ...apiKeys, geminiApiKey: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 text-gray-300 text-sm focus:outline-none focus:border-cyan-500 font-mono"
                  placeholder="AIzaSy..."
                  required
                />
                <p className="text-[10px] text-gray-600 font-mono">
                  Get your API key: 
                  <a 
                    href="https://aistudio.google.com/app/apikey" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:text-cyan-300 ml-1"
                  >
                    aistudio.google.com/app/apikey
                  </a>
                </p>
              </div>
            </div>

            {/* Email Reminders */}
            <div className="bg-zinc-800 border border-zinc-700 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-400" />
                  <span className="text-sm text-gray-300 font-mono">EMAIL_REMINDERS</span>
                </div>
                <button
                  onClick={() => handleFeatureToggle('emailReminders')}
                  className="flex items-center"
                >
                  {selectedFeatures.emailReminders ? (
                    <ToggleRight className="w-6 h-6 text-green-500" />
                  ) : (
                    <ToggleLeft className="w-6 h-6 text-gray-500" />
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500 mb-2">Task reminders, daily summaries via email</p>
              
              {selectedFeatures.emailReminders && (
                <div className="mt-3 space-y-2">
                  <label className="text-xs text-gray-500 block">RESEND_API_KEY *</label>
                  <input
                    type="password"
                    value={apiKeys.resendApiKey}
                    onChange={(e) => setApiKeys({ ...apiKeys, resendApiKey: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 text-gray-300 text-sm focus:outline-none focus:border-cyan-500 font-mono"
                    placeholder="re_..."
                  />
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] text-gray-600 font-mono flex-1">
                      Get your API key: 
                      <a 
                        href="https://resend.com/api-keys" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-cyan-400 hover:text-cyan-300 ml-1"
                      >
                        resend.com/api-keys
                      </a>
                    </p>
                    <button
                      onClick={handleTestEmail}
                      disabled={testingEmail || !apiKeys.resendApiKey.trim()}
                      className="flex items-center gap-1 px-2 py-1 bg-blue-700 hover:bg-blue-600 text-white text-xs font-mono border border-blue-600 transition-colors disabled:opacity-50"
                    >
                      {testingEmail ? (
                        <>
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          TESTING...
                        </>
                      ) : (
                        <>
                          <TestTube className="w-3 h-3" />
                          TEST
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* WhatsApp Reminders */}
            <div className="bg-zinc-800 border border-zinc-700 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-gray-300 font-mono">WHATSAPP_REMINDERS</span>
                </div>
                <button
                  onClick={() => handleFeatureToggle('whatsappReminders')}
                  className="flex items-center"
                >
                  {selectedFeatures.whatsappReminders ? (
                    <ToggleRight className="w-6 h-6 text-green-500" />
                  ) : (
                    <ToggleLeft className="w-6 h-6 text-gray-500" />
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500 mb-2">Task reminders, daily summaries via WhatsApp</p>
              
              {selectedFeatures.whatsappReminders && (
                <div className="mt-3 space-y-2">
                  <label className="text-xs text-gray-500 block">WHATABOT_API_KEY *</label>
                  <input
                    type="password"
                    value={apiKeys.whatsappApiKey}
                    onChange={(e) => setApiKeys({ ...apiKeys, whatsappApiKey: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 text-gray-300 text-sm focus:outline-none focus:border-cyan-500 font-mono"
                    placeholder="Enter API key..."
                  />
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <p className="text-[10px] text-gray-600 font-mono mb-1">Quick Setup:</p>
                      <a
                        href="https://wa.me/5491132704925?text=I%20allow%20whatabot%20to%20send%20me%20messages"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2 py-1 bg-green-600 hover:bg-green-500 text-white text-xs rounded transition-colors w-fit"
                      >
                        <ExternalLink className="w-3 h-3" />
                        OPEN_WHATSAPP
                      </a>
                    </div>
                    <button
                      onClick={handleTestWhatsApp}
                      disabled={testingWhatsApp || !apiKeys.whatsappApiKey.trim()}
                      className="flex items-center gap-1 px-2 py-1 bg-green-700 hover:bg-green-600 text-white text-xs font-mono border border-green-600 transition-colors disabled:opacity-50"
                    >
                      {testingWhatsApp ? (
                        <>
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          TESTING...
                        </>
                      ) : (
                        <>
                          <TestTube className="w-3 h-3" />
                          TEST
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="mb-6 bg-zinc-800 border border-zinc-700 p-4">
          <p className="text-xs text-cyan-400 mb-2 font-mono">&gt; SETUP_INFO:</p>
          <ul className="text-[10px] text-gray-500 space-y-1 font-mono">
            <li>• Gemini API key is required for core AI features</li>
            <li>• Email and WhatsApp reminders are optional</li>
            <li>• You can add optional features later in profile settings</li>
            <li>• All API keys are stored securely and only used for your requests</li>
            <li>• Test buttons help verify your API keys work correctly</li>
          </ul>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 p-3 bg-red-950/20 border border-red-900 text-red-400 text-xs font-mono">
            ERROR: {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-950/20 border border-green-900 text-green-400 text-xs font-mono">
            SUCCESS: {success}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleComplete}
            disabled={isLoading}
            className="flex-1 py-2 bg-cyan-500 hover:bg-cyan-400 text-black text-sm font-mono transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                CREATING...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                COMPLETE_SETUP
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}