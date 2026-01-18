'use client';

import { useState, useEffect } from 'react';
import { X, User, Key, Mail, Phone, Save, RefreshCw } from 'lucide-react';
import api from '@/lib/api';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone?: string;
  profilePicture?: string;
  isOAuthUser: boolean;
  hasApiKey1: boolean;
  hasApiKey2: boolean;
  currentApiKeyIndex: number;
  createdAt: string;
  updatedAt: string;
}

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    geminiApiKey1: '',
    geminiApiKey2: '',
    resendApiKey: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showApiKeys, setShowApiKeys] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchProfile();
    }
  }, [isOpen]);

  const fetchProfile = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(api.endpoints.profile.get, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setProfile(data);
        setFormData({
          name: data.name || '',
          phone: data.phone || '',
          geminiApiKey1: '',
          geminiApiKey2: '',
          resendApiKey: '',
        });
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to load profile');
      }
    } catch (error) {
      setError('Connection error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
      const updateData: any = {
        name: formData.name,
        phone: formData.phone || null,
      };

      // Only include API keys if they're provided
      if (formData.geminiApiKey1.trim()) {
        updateData.geminiApiKey1 = formData.geminiApiKey1.trim();
      }
      if (formData.geminiApiKey2.trim()) {
        updateData.geminiApiKey2 = formData.geminiApiKey2.trim();
      }
      if (formData.resendApiKey.trim()) {
        updateData.resendApiKey = formData.resendApiKey.trim();
      }

      const response = await fetch(api.endpoints.profile.update, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        const data = await response.json();
        setProfile(data.user);
        setSuccess('Profile updated successfully!');
        
        // Clear API key fields after successful update
        setFormData(prev => ({
          ...prev,
          geminiApiKey1: '',
          geminiApiKey2: '',
          resendApiKey: '',
        }));
        
        setTimeout(() => setSuccess(''), 3000);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to update profile');
      }
    } catch (error) {
      setError('Connection error. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSwitchApiKey = async () => {
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(api.endpoints.profile.switchApiKey, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSuccess(data.message);
        fetchProfile(); // Refresh profile data
        setTimeout(() => setSuccess(''), 3000);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to switch API key');
      }
    } catch (error) {
      setError('Connection error. Please try again.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h2 className="text-sm font-mono text-cyan-400">&gt; USER_PROFILE</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-red-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-gray-500 font-mono text-sm">Loading profile...</p>
            </div>
          ) : profile ? (
            <>
              {/* Account Info */}
              <div className="bg-zinc-800 border border-zinc-700 p-4">
                <h3 className="text-xs text-gray-500 mb-3 flex items-center gap-2">
                  <User className="w-3 h-3" />
                  ACCOUNT_INFO
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">EMAIL</label>
                    <p className="text-sm text-gray-300 font-mono bg-zinc-900 p-2 border border-zinc-700">
                      {profile.email}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">ACCOUNT_TYPE</label>
                    <p className="text-sm text-gray-300 font-mono bg-zinc-900 p-2 border border-zinc-700">
                      {profile.isOAuthUser ? 'GOOGLE_OAUTH' : 'EMAIL_PASSWORD'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Editable Fields */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">NAME</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 text-gray-300 text-sm focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-500 mb-1 block">PHONE (OPTIONAL)</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 text-gray-300 text-sm focus:outline-none focus:border-cyan-500 font-mono"
                    placeholder="+1234567890"
                  />
                </div>
              </div>

              {/* Resend API Key Section */}
              <div className="bg-zinc-800 border border-zinc-700 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs text-gray-500 flex items-center gap-2">
                    <Mail className="w-3 h-3" />
                    RESEND_API_KEY (REQUIRED)
                  </h3>
                </div>

                <div className="mb-4">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${profile.hasResendApiKey ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span className="text-sm text-gray-300 font-mono">
                      {profile.hasResendApiKey ? 'CONFIGURED' : 'NOT_SET'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-500 mb-1 block">UPDATE_RESEND_API_KEY</label>
                  <input
                    type="password"
                    value={formData.resendApiKey}
                    onChange={(e) => setFormData({ ...formData, resendApiKey: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 text-gray-300 text-sm focus:outline-none focus:border-cyan-500 font-mono"
                    placeholder="Leave empty to keep current key"
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
              </div>

              {/* Gemini API Keys Section */}
              <div className="bg-zinc-800 border border-zinc-700 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs text-gray-500 flex items-center gap-2">
                    <Key className="w-3 h-3" />
                    GEMINI_API_KEYS (REQUIRED)
                  </h3>
                  <button
                    onClick={() => setShowApiKeys(!showApiKeys)}
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-mono"
                  >
                    {showApiKeys ? 'HIDE' : 'SHOW'}
                  </button>
                </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">PRIMARY_KEY</label>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${profile.hasApiKey1 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <span className="text-sm text-gray-300 font-mono">
                          {profile.hasApiKey1 ? 'CONFIGURED' : 'NOT_SET'}
                        </span>
                        {profile.currentApiKeyIndex === 1 && (
                          <span className="text-xs text-cyan-400 font-mono">ACTIVE</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">BACKUP_KEY</label>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${profile.hasApiKey2 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <span className="text-sm text-gray-300 font-mono">
                          {profile.hasApiKey2 ? 'CONFIGURED' : 'NOT_SET'}
                        </span>
                        {profile.currentApiKeyIndex === 2 && (
                          <span className="text-xs text-cyan-400 font-mono">ACTIVE</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {showApiKeys && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">UPDATE_PRIMARY_KEY</label>
                        <input
                          type="password"
                          value={formData.geminiApiKey1}
                          onChange={(e) => setFormData({ ...formData, geminiApiKey1: e.target.value })}
                          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 text-gray-300 text-sm focus:outline-none focus:border-cyan-500 font-mono"
                          placeholder="Leave empty to keep current key"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">UPDATE_BACKUP_KEY</label>
                        <input
                          type="password"
                          value={formData.geminiApiKey2}
                          onChange={(e) => setFormData({ ...formData, geminiApiKey2: e.target.value })}
                          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 text-gray-300 text-sm focus:outline-none focus:border-cyan-500 font-mono"
                          placeholder="Leave empty to keep current key"
                        />
                      </div>

                      {profile.hasApiKey1 && profile.hasApiKey2 && (
                        <button
                          onClick={handleSwitchApiKey}
                          className="flex items-center gap-2 px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-gray-300 text-xs font-mono border border-zinc-600 transition-colors"
                        >
                          <RefreshCw className="w-3 h-3" />
                          SWITCH_TO_{profile.currentApiKeyIndex === 1 ? 'BACKUP' : 'PRIMARY'}
                        </button>
                      )}
                    </div>
                  )}
                </div>

              {/* Messages */}
              {error && (
                <p className="text-red-400 text-xs font-mono border border-red-900 bg-red-950/20 p-2">
                  ERROR: {error}
                </p>
              )}

              {success && (
                <p className="text-green-400 text-xs font-mono border border-green-900 bg-green-950/20 p-2">
                  SUCCESS: {success}
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-zinc-800">
                <button
                  onClick={onClose}
                  className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-gray-400 text-sm font-mono transition-colors"
                >
                  CANCEL
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 py-2 bg-cyan-500 hover:bg-cyan-400 text-black text-sm font-mono transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                      SAVING...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      SAVE_CHANGES
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-red-400 font-mono text-sm">Failed to load profile</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}