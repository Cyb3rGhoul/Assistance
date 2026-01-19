'use client';

import { useState, useEffect } from 'react';
import { X, Calendar, Clock, Save } from 'lucide-react';
import api from '@/lib/api';
import { utcToISTDate, utcToISTTime, istToUTC } from '@/lib/timeUtils';

interface Task {
  _id: string;
  title: string;
  description?: string;
  dueDate?: string;
  reminderTime?: string;
  completed: boolean;
}

interface TaskEditModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export default function TaskEditModal({ task, isOpen, onClose, onSave }: TaskEditModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    dueDate: '',
    dueTime: '',
    reminderDate: '',
    reminderTime: ''
  });

  useEffect(() => {
    if (task) {
      // Convert UTC dates to IST for display using utility functions
      let dueDateIST = '';
      let dueTimeIST = '';
      if (task.dueDate) {
        dueDateIST = utcToISTDate(task.dueDate);
        dueTimeIST = utcToISTTime(task.dueDate);
      }
      
      let reminderDateIST = '';
      let reminderTimeIST = '';
      if (task.reminderTime) {
        reminderDateIST = utcToISTDate(task.reminderTime);
        reminderTimeIST = utcToISTTime(task.reminderTime);
      }

      setFormData({
        title: task.title,
        description: task.description || '',
        dueDate: dueDateIST,
        dueTime: dueTimeIST,
        reminderDate: reminderDateIST,
        reminderTime: reminderTimeIST
      });
    } else {
      // Reset form for new task
      setFormData({
        title: '',
        description: '',
        dueDate: '',
        dueTime: '',
        reminderDate: '',
        reminderTime: ''
      });
    }
  }, [task, isOpen]);

  const handleSave = async () => {
    if (!formData.title.trim()) {
      alert('Please enter a task title');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      
      // Convert IST back to UTC for storage using utility function
      let dueDate = null;
      if (formData.dueDate && formData.dueTime) {
        dueDate = istToUTC(formData.dueDate, formData.dueTime);
      }
      
      let reminderTime = null;
      if (formData.reminderDate && formData.reminderTime) {
        reminderTime = istToUTC(formData.reminderDate, formData.reminderTime);
      }

      const taskData = {
        title: formData.title,
        description: formData.description || null,
        dueDate,
        reminderTime
      };

      if (task) {
        // Update existing task
        await fetch(api.endpoints.tasks.update(task._id), {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(taskData)
        });
      } else {
        // Create new task
        await fetch(api.endpoints.tasks.create, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(taskData)
        });
      }

      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving task:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-md animate-in fade-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h2 className="text-sm font-mono text-cyan-400">
            &gt; {task ? 'EDIT_TASK' : 'CREATE_TASK'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-red-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <div className="p-4 space-y-4">
          {/* Title */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">&gt; TITLE</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 text-gray-300 text-sm focus:outline-none focus:border-cyan-500 font-mono"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">&gt; DESCRIPTION</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 text-gray-300 text-sm focus:outline-none focus:border-cyan-500 font-mono resize-none"
              rows={3}
            />
          </div>

          {/* Due Date & Time */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 mb-1 block flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                DUE_DATE
              </label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 text-gray-300 text-sm focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block flex items-center gap-1">
                <Clock className="w-3 h-3" />
                TIME_IST
              </label>
              <input
                type="time"
                value={formData.dueTime}
                onChange={(e) => setFormData({ ...formData, dueTime: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 text-gray-300 text-sm focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
          </div>

          {/* Reminder Date & Time */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 mb-1 block flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                REMINDER_DATE
              </label>
              <input
                type="date"
                value={formData.reminderDate}
                onChange={(e) => setFormData({ ...formData, reminderDate: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 text-gray-300 text-sm focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block flex items-center gap-1">
                <Clock className="w-3 h-3" />
                TIME_IST
              </label>
              <input
                type="time"
                value={formData.reminderTime}
                onChange={(e) => setFormData({ ...formData, reminderTime: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 text-gray-300 text-sm focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
          </div>

          <p className="text-xs text-gray-600 font-mono">
            * All times are in IST (India Standard Time)
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 p-4 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-gray-400 text-sm font-mono transition-colors"
          >
            CANCEL
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2 bg-cyan-500 hover:bg-cyan-400 text-black text-sm font-mono transition-colors flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            {task ? 'UPDATE' : 'CREATE'}
          </button>
        </div>
      </div>
    </div>
  );
}