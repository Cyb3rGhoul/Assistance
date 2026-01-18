'use client';

import { useState, useEffect } from 'react';
import { X, User, Key, Mail, Phone, Save, RefreshCw, Edit3 } from 'lucide-react';
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
  hasResendApiKey: boolean;
  createdAt: string;
  updatedAt: string;
  // Current API key values (only shown when requested)
  currentGeminiApiKey1?: string;
  currentGeminiApiKey2?: string;
  currentResendApiKey?: string;
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
  const [editingKeys, setEditingKeys] = useState({
    geminiApiKey1: false,
    geminiApiKey2: false,
    resendApiKey: false
  });

  useEffect(() => {
    if (isOpen) {
      fetchProfile(true); // Always load with API keys included
    }
  }, [isOpen]);

  const fetchProfile = async (includeKeys = false) => {
    setIsLoading(true);
    setError('');
    
    try {
      const token = localStorage.getItem('token');
      const url = includeKeys ? `${api.endpoints.profile.get}?includeKeys=true` : api.endpoints.profile.get;
      const response = await fetch(url, {
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
          geminiApiKey1: data.currentGeminiApiKey1 || '',
          geminiApiKey2: data.currentGeminiApiKey2 || '',
          resendApiKey: data.currentResendApiKey || '',
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

      // Only include API keys if they're being edited and have values
      if (editingKeys.geminiApiKey1 && formData.geminiApiKey1.trim()) {
        updateData.geminiApiKey1 = formData.geminiApiKey1.trim();
      }
      if (editingKeys.geminiApiKey2 && formData.geminiApiKey2.trim()) {
        updateData.geminiApiKey2 = formData.geminiApiKey2.trim();
      }
      if (editingKeys.resendApiKey && formData.resendApiKey.trim()) {
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
        
        // Reset editing states and clear form fields for edited keys
        setEditingKeys({
          geminiApiKey1: false,
          geminiApiKey2: false,
          resendApiKey: false
        });
        
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

  const handleEditKey = (keyType: 'geminiApiKey1' | 'geminiApiKey2' | 'resendApiKey') => {
    setEditingKeys(prev => ({
      ...prev,
      [keyType]: !prev[keyType]
    }));
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
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h2 className="text-sm font-mono text-cyan-400 truncate">&gt; USER_PROFILE</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-red-400 transition-colors flex-shrink-0 ml-2"
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
                    <p className="text-sm text-gray-300 font-mono bg-zinc-900 p-2 border border-zinc-700 break-all overflow-hidden">
                      {profile.email}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">ACCOUNT_TYPE</label>
                    <p className="text-sm text-gray-300 font-mono bg-zinc-900 p-2 border border-zinc-700 break-all overflow-hidden">
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
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 text-gray-300 text-sm focus:outline-none focus:border-cyan-500 font-mono break-all overflow-hidden"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-500 mb-1 block">PHONE (OPTIONAL)</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 text-gray-300 text-sm focus:outline-none focus:border-cyan-500 font-mono break-all overflow-hidden"
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

                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-gray-500">CURRENT_RESEND_API_KEY</label>
                      <button
                        onClick={() => handleEditKey('resendApiKey')}
                        className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 font-mono"
                      >
                        <Edit3 className="w-3 h-3" />
                        {editingKeys.resendApiKey ? 'CANCEL' : 'EDIT'}
                      </button>
                    </div>
                    {editingKeys.resendApiKey ? (
                      <input
                        type="text"
                        value={formData.resendApiKey}
                        onChange={(e) => setFormData({ ...formData, resendApiKey: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 text-gray-300 text-sm focus:outline-none focus:border-cyan-500 font-mono break-all overflow-hidden"
                        placeholder="Enter new Resend API key"
                      />
                    ) : (
                      <div className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 text-gray-300 text-sm font-mono break-all overflow-hidden">
                        {profile.hasResendApiKey ? '••••••••••••••••••••••••••••••••' : 'NOT_SET'}
                      </div>
                    )}
                  </div>
                  
                  <p className="text-[10px] text-gray-600 font-mono">
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
                </div>

                <div className="space-y-4">
                  {/* Primary API Key */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${profile.hasApiKey1 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <span className="text-sm text-gray-300 font-mono">PRIMARY_KEY</span>
                        {profile.currentApiKeyIndex === 1 && (
                          <span className="text-xs text-cyan-400 font-mono">ACTIVE</span>
                        )}
                      </div>
                      <button
                        onClick={() => handleEditKey('geminiApiKey1')}
                        className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 font-mono"
                      >
                        <Edit3 className="w-3 h-3" />
                        {editingKeys.geminiApiKey1 ? 'CANCEL' : 'EDIT'}
                      </button>
                    </div>
                    {editingKeys.geminiApiKey1 ? (
                      <input
                        type="text"
                        value={formData.geminiApiKey1}
                        onChange={(e) => setFormData({ ...formData, geminiApiKey1: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 text-gray-300 text-sm focus:outline-none focus:border-cyan-500 font-mono break-all overflow-hidden"
                        placeholder="Enter new primary Gemini API key"
                      />
                    ) : (
                      <div className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 text-gray-300 text-sm font-mono break-all overflow-hidden">
                        {profile.hasApiKey1 ? '••••••••••••••••••••••••••••••••••••••••' : 'NOT_SET'}
                      </div>
                    )}
                  </div>

                  {/* Backup API Key */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${profile.hasApiKey2 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <span className="text-sm text-gray-300 font-mono">BACKUP_KEY</span>
                        {profile.currentApiKeyIndex === 2 && (
                          <span className="text-xs text-cyan-400 font-mono">ACTIVE</span>
                        )}
                      </div>
                      <button
                        onClick={() => handleEditKey('geminiApiKey2')}
                        className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 font-mono"
                      >
                        <Edit3 className="w-3 h-3" />
                        {editingKeys.geminiApiKey2 ? 'CANCEL' : 'EDIT'}
                      </button>
                    </div>
                    {editingKeys.geminiApiKey2 ? (
                      <input
                        type="text"
                        value={formData.geminiApiKey2}
                        onChange={(e) => setFormData({ ...formData, geminiApiKey2: e.target.value })}
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 text-gray-300 text-sm focus:outline-none focus:border-cyan-500 font-mono break-all overflow-hidden"
                        placeholder="Enter new backup Gemini API key"
                      />
                    ) : (
                      <div className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 text-gray-300 text-sm font-mono break-all overflow-hidden">
                        {profile.hasApiKey2 ? '••••••••••••••••••••••••••••••••••••••••' : 'NOT_SET'}
                      </div>
                    )}
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

                  <p className="text-[10px] text-gray-600 font-mono">
                    Get your API key from: 
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