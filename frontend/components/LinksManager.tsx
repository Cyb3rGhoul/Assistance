'use client';

import { useState, useEffect } from 'react';
import { Link as LinkIcon, ExternalLink, Trash2, Tag, Search, Filter, Plus, Mic, MicOff, Edit3 } from 'lucide-react';
import api from '@/lib/api';

interface Link {
  _id: string;
  url: string;
  title: string;
  description?: string;
  favicon?: string;
  autoTags: string[];
  userTags: string[];
  category: string;
  createdAt: string;
}

interface Metadata {
  categories: string[];
  allTags: string[];
}

interface EditLinkFormProps {
  link: Link;
  onSave: (data: { title: string; description: string; userTags: string[]; autoTags: string[] }) => void;
  onCancel: () => void;
}

function EditLinkForm({ link, onSave, onCancel }: EditLinkFormProps) {
  const [title, setTitle] = useState(link.title);
  const [description, setDescription] = useState(link.description || '');
  const [userTags, setUserTags] = useState<string[]>(link.userTags);
  const [autoTags, setAutoTags] = useState<string[]>(link.autoTags);
  const [newTag, setNewTag] = useState('');

  const handleAddTag = () => {
    const tag = newTag.trim();
    if (tag && !userTags.includes(tag)) {
      setUserTags([...userTags, tag]);
      setNewTag('');
    }
  };

  const handleRemoveUserTag = (tagToRemove: string) => {
    setUserTags(userTags.filter(tag => tag !== tagToRemove));
  };

  const handleRemoveAutoTag = (tagToRemove: string) => {
    setAutoTags(autoTags.filter(tag => tag !== tagToRemove));
  };

  const handleSave = () => {
    onSave({
      title: title.trim(),
      description: description.trim(),
      userTags,
      autoTags
    });
  };

  return (
    <div className="space-y-4">
      {/* URL (read-only) */}
      <div>
        <label className="block text-xs text-gray-400 font-mono mb-1">URL</label>
        <div className="px-3 py-2 bg-zinc-800 border border-zinc-700 text-gray-500 text-xs font-mono break-all">
          {link.url}
        </div>
      </div>

      {/* Title */}
      <div>
        <label className="block text-xs text-gray-400 font-mono mb-1">TITLE</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 text-gray-300 text-xs font-mono focus:outline-none focus:border-cyan-500"
          placeholder="Enter title..."
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs text-gray-400 font-mono mb-1">DESCRIPTION</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 text-gray-300 text-xs font-mono focus:outline-none focus:border-cyan-500 resize-none"
          placeholder="Enter description..."
        />
      </div>

      {/* Auto Tags (editable) */}
      {autoTags.length > 0 && (
        <div>
          <label className="block text-xs text-gray-400 font-mono mb-1">AUTO_TAGS</label>
          <div className="flex flex-wrap gap-1">
            {autoTags.map((tag, index) => (
              <span
                key={index}
                className="bg-green-500/20 text-green-400 px-2 py-0.5 text-[10px] font-mono flex items-center gap-1"
              >
                <Tag className="w-2 h-2" />
                {tag}
                <button
                  onClick={() => handleRemoveAutoTag(tag)}
                  className="text-green-300 hover:text-red-400 ml-1"
                  title="Remove auto tag"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <p className="text-[9px] text-gray-600 font-mono mt-1">
            * Click × to remove unwanted auto-generated tags
          </p>
        </div>
      )}

      {/* User Tags */}
      <div>
        <label className="block text-xs text-gray-400 font-mono mb-1">USER_TAGS</label>
        
        {/* Existing tags */}
        {userTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {userTags.map((tag, index) => (
              <span
                key={index}
                className="bg-purple-500/20 text-purple-400 px-2 py-0.5 text-[10px] font-mono flex items-center gap-1"
              >
                <Tag className="w-2 h-2" />
                {tag}
                <button
                  onClick={() => handleRemoveUserTag(tag)}
                  className="text-purple-300 hover:text-red-400 ml-1"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Add new tag */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddTag();
              }
            }}
            className="flex-1 px-2 py-1 bg-zinc-700 border border-zinc-600 text-gray-300 text-[10px] font-mono focus:outline-none focus:border-cyan-500"
            placeholder="Add tag..."
          />
          <button
            onClick={handleAddTag}
            disabled={!newTag.trim()}
            className="px-2 py-1 bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-[10px] font-mono hover:bg-cyan-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            ADD
          </button>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onCancel}
          className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-gray-300 px-4 py-2 text-xs font-mono border border-zinc-700 transition-colors"
        >
          CANCEL
        </button>
        <button
          onClick={handleSave}
          className="flex-1 bg-cyan-900 hover:bg-cyan-800 text-cyan-100 px-4 py-2 text-xs font-mono border border-cyan-700 transition-colors"
        >
          SAVE
        </button>
      </div>
    </div>
  );
}

export default function LinksManager() {
  const [links, setLinks] = useState<Link[]>([]);
  const [metadata, setMetadata] = useState<Metadata>({ categories: [], allTags: [] });
  const [filteredLinks, setFilteredLinks] = useState<Link[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    link: Link | null;
  }>({
    isOpen: false,
    link: null
  });
  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    link: Link | null;
  }>({
    isOpen: false,
    link: null
  });

  const fetchLinks = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(api.endpoints.links.list, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setLinks(data);
      setFilteredLinks(data);
    } catch (error) {
      console.error('Error fetching links:', error);
    }
  };

  const fetchMetadata = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(api.endpoints.links.metadata, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setMetadata(data);
    } catch (error) {
      console.error('Error fetching metadata:', error);
    }
  };

  useEffect(() => {
    fetchLinks();
    fetchMetadata();

    // Listen for links update events from voice commands
    const handleLinksUpdate = () => {
      fetchLinks();
      fetchMetadata();
    };

    window.addEventListener('linksUpdate', handleLinksUpdate);
    return () => window.removeEventListener('linksUpdate', handleLinksUpdate);
  }, []);

  useEffect(() => {
    let filtered = links;

    if (searchTerm) {
      filtered = filtered.filter(link =>
        link.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        link.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        link.url.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedCategory) {
      filtered = filtered.filter(link => link.category === selectedCategory);
    }

    if (selectedTag) {
      filtered = filtered.filter(link =>
        link.autoTags.includes(selectedTag) || link.userTags.includes(selectedTag)
      );
    }

    setFilteredLinks(filtered);
  }, [links, searchTerm, selectedCategory, selectedTag]);

  const addLink = async (url: string) => {
    if (!url) return;

    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      await fetch(api.endpoints.links.create, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ url })
      });

      setNewUrl('');
      await fetchLinks();
      await fetchMetadata();
    } catch (error) {
      console.error('Error adding link:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteLink = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(api.endpoints.links.delete(id), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      await fetchLinks();
      await fetchMetadata();
      setDeleteConfirmation({ isOpen: false, link: null });
    } catch (error) {
      console.error('Error deleting link:', error);
    }
  };

  const showDeleteConfirmation = (link: Link) => {
    setDeleteConfirmation({ isOpen: true, link });
  };

  const showEditModal = (link: Link) => {
    setEditModal({ isOpen: true, link });
  };

  const handleConfirmDelete = () => {
    if (deleteConfirmation.link) {
      deleteLink(deleteConfirmation.link._id);
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirmation({ isOpen: false, link: null });
  };

  const handleEditSave = async (updatedData: { title: string; description: string; userTags: string[]; autoTags: string[] }) => {
    if (!editModal.link) return;

    try {
      const token = localStorage.getItem('token');
      await fetch(api.endpoints.links.update(editModal.link._id), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updatedData)
      });

      await fetchLinks();
      await fetchMetadata();
      setEditModal({ isOpen: false, link: null });
    } catch (error) {
      console.error('Error updating link:', error);
    }
  };

  const handleEditCancel = () => {
    setEditModal({ isOpen: false, link: null });
  };

  const addUserTag = async (linkId: string, tag: string) => {
    try {
      const token = localStorage.getItem('token');
      const link = links.find(l => l._id === linkId);
      if (!link) return;

      const updatedUserTags = [...link.userTags, tag];
      
      await fetch(api.endpoints.links.update(linkId), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userTags: updatedUserTags })
      });

      await fetchLinks();
      await fetchMetadata();
    } catch (error) {
      console.error('Error adding user tag:', error);
    }
  };

  const handleVoiceInput = () => {
    if ('webkitSpeechRecognition' in window) {
      const recognition = new (window as any).webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        
        // Extract URL from speech
        const urlMatch = transcript.match(/(https?:\/\/[^\s]+)/i);
        if (urlMatch) {
          setNewUrl(urlMatch[0]);
        } else {
          // If no URL detected, set the full transcript
          setNewUrl(transcript);
        }
      };

      recognition.start();
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('');
    setSelectedTag('');
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 p-4 sm:p-6">
      {/* Header */}
      <div className="border-b border-zinc-800 pb-2 sm:pb-3 mb-4 sm:mb-6">
        <p className="text-[10px] sm:text-xs text-gray-500 tracking-wider">&gt; LINK_MANAGER</p>
        <p className="text-xs sm:text-sm text-gray-400 mt-1">TOTAL: {links.length}</p>
      </div>

      {/* Add Link */}
      <div className="mb-4 sm:mb-6">
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="Paste URL or use voice..."
            className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 text-gray-300 text-sm focus:outline-none focus:border-cyan-500 font-mono"
          />
          <button
            onClick={handleVoiceInput}
            disabled={isListening}
            className={`px-3 py-2 border transition-colors ${
              isListening
                ? 'border-red-500 bg-red-500/10 text-red-400'
                : 'border-cyan-500 bg-cyan-500/5 text-cyan-400 hover:bg-cyan-500/10'
            }`}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <button
            onClick={() => addLink(newUrl)}
            disabled={!newUrl || isLoading}
            className="px-3 sm:px-4 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:bg-zinc-700 disabled:text-gray-500 text-black text-sm font-mono transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
                <span className="hidden sm:inline">SAVING...</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">ADD</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 space-y-2">
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Search className="w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search links..."
              className="flex-1 px-2 py-1 bg-zinc-800 border border-zinc-700 text-gray-300 text-sm focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>
          {(searchTerm || selectedCategory || selectedTag) && (
            <button
              onClick={clearFilters}
              className="px-2 py-1 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono hover:bg-red-500/20 transition-colors"
            >
              CLEAR
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-2 py-1 bg-zinc-800 border border-zinc-700 text-gray-300 text-sm focus:outline-none focus:border-cyan-500 font-mono"
          >
            <option value="">All Categories</option>
            {metadata.categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>

          <select
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            className="px-2 py-1 bg-zinc-800 border border-zinc-700 text-gray-300 text-sm focus:outline-none focus:border-cyan-500 font-mono"
          >
            <option value="">All Tags</option>
            {metadata.allTags.map(tag => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Links List */}
      <div className="space-y-2 max-h-[400px] sm:max-h-[500px] overflow-y-auto pr-1 sm:pr-2">
        {filteredLinks.length === 0 ? (
          <div className="text-center py-8 sm:py-12 border border-dashed border-zinc-800">
            <p className="text-[10px] sm:text-xs text-gray-600 font-mono">
              {links.length === 0 ? 'NO_LINKS_SAVED' : 'NO_MATCHES_FOUND'}
            </p>
          </div>
        ) : (
          filteredLinks.map((link) => (
            <div
              key={link._id}
              className="bg-zinc-800/50 border border-zinc-700 p-3 sm:p-4 hover:border-cyan-900 transition-all group"
            >
              <div className="flex items-start gap-2 sm:gap-3">
                {/* Favicon */}
                <div className="flex-shrink-0 mt-0.5">
                  {link.favicon ? (
                    <img
                      src={link.favicon}
                      alt=""
                      className="w-4 h-4 rounded"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <LinkIcon className="w-4 h-4 text-gray-500" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Title & URL */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-gray-200 text-xs sm:text-sm font-mono break-words">
                        {link.title}
                      </h3>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-400 text-[10px] sm:text-xs font-mono hover:text-cyan-300 break-all inline-flex items-center gap-1"
                      >
                        {link.url}
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      </a>
                    </div>
                    
                    <div className="flex items-center gap-2 sm:gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => showEditModal(link)}
                        className="text-cyan-500 hover:text-cyan-400 flex-shrink-0 active:scale-90 transition-transform p-2 sm:p-1"
                      >
                        <Edit3 className="w-4 h-4 sm:w-4 sm:h-4" />
                      </button>
                      <button
                        onClick={() => showDeleteConfirmation(link)}
                        className="text-red-500 hover:text-red-400 flex-shrink-0 active:scale-90 transition-transform p-2 sm:p-1"
                      >
                        <Trash2 className="w-4 h-4 sm:w-4 sm:h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Description */}
                  {link.description && (
                    <p className="text-gray-500 text-[10px] sm:text-xs font-mono mb-2 break-words">
                      {link.description}
                    </p>
                  )}

                  {/* Category & Tags */}
                  <div className="flex flex-wrap items-center gap-1 text-[10px] mb-2">
                    <span className="bg-cyan-500/20 text-cyan-400 px-2 py-0.5 font-mono">
                      {link.category}
                    </span>
                    {link.autoTags.map((tag, index) => (
                      <span
                        key={`auto-${index}`}
                        className="bg-green-500/20 text-green-400 px-2 py-0.5 font-mono flex items-center gap-1"
                        title="Auto-generated tag"
                      >
                        <Tag className="w-2 h-2" />
                        {tag}
                      </span>
                    ))}
                    {link.userTags.map((tag, index) => (
                      <span
                        key={`user-${index}`}
                        className="bg-purple-500/20 text-purple-400 px-2 py-0.5 font-mono flex items-center gap-1"
                        title="User-added tag"
                      >
                        <Tag className="w-2 h-2" />
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Add User Tags */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Add custom tag..."
                      className="flex-1 px-2 py-1 bg-zinc-700 border border-zinc-600 text-gray-300 text-[10px] focus:outline-none focus:border-cyan-500 font-mono"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          const input = e.target as HTMLInputElement;
                          const newTag = input.value.trim();
                          if (newTag && !link.userTags.includes(newTag)) {
                            addUserTag(link._id, newTag);
                            input.value = '';
                          }
                        }
                      }}
                    />
                    <span className="text-[9px] text-gray-600 font-mono">ENTER</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmation.isOpen && deleteConfirmation.link && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && handleCancelDelete()}
        >
          <div 
            className="bg-zinc-900 border border-zinc-800 p-6 max-w-md w-full"
            onKeyDown={(e) => {
              if (e.key === 'Escape') handleCancelDelete();
              if (e.key === 'Enter') handleConfirmDelete();
            }}
            tabIndex={-1}
          >
            <div className="border-b border-zinc-800 pb-3 mb-4">
              <p className="text-[10px] text-gray-500 tracking-wider">&gt; CONFIRM_DELETE_LINK</p>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-200 text-sm font-mono mb-2">
                Delete link: "{deleteConfirmation.link.title}"?
              </p>
              <p className="text-gray-500 text-xs font-mono mb-2 break-all">
                {deleteConfirmation.link.url}
              </p>
              <p className="text-red-400 text-xs font-mono">
                This action cannot be undone.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCancelDelete}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-gray-300 px-4 py-2 text-xs font-mono border border-zinc-700 transition-colors"
              >
                CANCEL
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 bg-red-900 hover:bg-red-800 text-red-100 px-4 py-2 text-xs font-mono border border-red-700 transition-colors"
              >
                DELETE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Link Modal */}
      {editModal.isOpen && editModal.link && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && handleEditCancel()}
        >
          <div 
            className="bg-zinc-900 border border-zinc-800 p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
            onKeyDown={(e) => {
              if (e.key === 'Escape') handleEditCancel();
            }}
            tabIndex={-1}
          >
            <div className="border-b border-zinc-800 pb-3 mb-4">
              <p className="text-[10px] text-gray-500 tracking-wider">&gt; EDIT_LINK</p>
            </div>
            
            <EditLinkForm
              link={editModal.link}
              onSave={handleEditSave}
              onCancel={handleEditCancel}
            />
          </div>
        </div>
      )}
    </div>
  );
}