'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, Circle, Trash2, Clock, Edit3, CheckCheck, XCircle, Plus } from 'lucide-react';
import api from '@/lib/api';
import TaskEditModal from './TaskEditModal';
import { formatDateTimeIST } from '@/lib/timeUtils';

interface Task {
  _id: string;
  title: string;
  description?: string;
  dueDate?: string;
  reminderTime?: string;
  completed: boolean;
}

export default function TaskList() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    task: Task | null;
    type: 'single' | 'all' | 'toggleAll';
  }>({
    isOpen: false,
    task: null,
    type: 'single'
  });

  const fetchTasks = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No token found');
        setTasks([]);
        return;
      }
      
      const res = await fetch(api.endpoints.tasks.list, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          // Token expired or invalid
          localStorage.removeItem('token');
          window.location.href = '/login';
          return;
        }
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      
      // Ensure data is an array
      if (Array.isArray(data)) {
        setTasks(data);
      } else {
        console.error('Tasks data is not an array:', data);
        setTasks([]);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      setTasks([]); // Set empty array on error to prevent map error
    }
  };

  useEffect(() => {
    fetchTasks();
    window.addEventListener('taskUpdate', fetchTasks);
    return () => window.removeEventListener('taskUpdate', fetchTasks);
  }, []);

  const toggleComplete = async (id: string, completed: boolean) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(api.endpoints.tasks.update(id), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ completed: !completed })
      });
      fetchTasks();
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const deleteTask = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(api.endpoints.tasks.delete(id), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchTasks();
      setDeleteConfirmation({ isOpen: false, task: null, type: 'single' });
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const deleteAllTasks = async () => {
    try {
      const token = localStorage.getItem('token');
      await fetch(api.endpoints.tasks.deleteAll, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchTasks();
      setDeleteConfirmation({ isOpen: false, task: null, type: 'single' });
    } catch (error) {
      console.error('Error deleting all tasks:', error);
    }
  };

  const markAllTasksCompleted = async () => {
    try {
      const token = localStorage.getItem('token');
      await fetch(api.endpoints.tasks.markAllCompleted, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchTasks();
      setDeleteConfirmation({ isOpen: false, task: null, type: 'single' });
    } catch (error) {
      console.error('Error marking all tasks as completed:', error);
    }
  };

  const markAllTasksIncomplete = async () => {
    try {
      const token = localStorage.getItem('token');
      await fetch(api.endpoints.tasks.markAllIncomplete, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchTasks();
      setDeleteConfirmation({ isOpen: false, task: null, type: 'single' });
    } catch (error) {
      console.error('Error marking all tasks as incomplete:', error);
    }
  };

  const showDeleteConfirmation = (task: Task) => {
    setDeleteConfirmation({ isOpen: true, task, type: 'single' });
  };

  const showDeleteAllConfirmation = () => {
    setDeleteConfirmation({ isOpen: true, task: null, type: 'all' });
  };

  const showToggleAllConfirmation = () => {
    setDeleteConfirmation({ isOpen: true, task: null, type: 'toggleAll' });
  };

  // Check if all tasks are completed
  const allTasksCompleted = tasks.length > 0 && tasks.every(task => task.completed);

  const handleConfirmDelete = () => {
    if (deleteConfirmation.type === 'single' && deleteConfirmation.task) {
      deleteTask(deleteConfirmation.task._id);
    } else if (deleteConfirmation.type === 'all') {
      deleteAllTasks();
    } else if (deleteConfirmation.type === 'toggleAll') {
      if (allTasksCompleted) {
        markAllTasksIncomplete();
      } else {
        markAllTasksCompleted();
      }
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirmation({ isOpen: false, task: null, type: 'single' });
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setIsEditModalOpen(true);
  };

  const openCreateModal = () => {
    setEditingTask(null); // null means create new task
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setEditingTask(null);
    setIsEditModalOpen(false);
  };

  return (
    <>
      <div className="bg-zinc-900 border border-zinc-800 p-4 sm:p-6">
        {/* Header */}
        <div className="border-b border-zinc-800 pb-2 sm:pb-3 mb-4 sm:mb-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-[10px] sm:text-xs text-gray-500 tracking-wider">&gt; TASK_MANAGER</p>
              <p className="text-xs sm:text-sm text-gray-400 mt-1">TOTAL: {tasks.length}</p>
            </div>
          </div>
          
          {tasks.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                onClick={showToggleAllConfirmation}
                className={`${
                  allTasksCompleted 
                    ? 'text-yellow-500 hover:text-yellow-400 border-yellow-800 hover:border-yellow-600' 
                    : 'text-green-500 hover:text-green-400 border-green-800 hover:border-green-600'
                } text-[10px] sm:text-xs font-mono px-2 py-1 border transition-colors flex items-center gap-1`}
              >
                {allTasksCompleted ? (
                  <>
                    <XCircle className="w-3 h-3" />
                    <span className="hidden sm:inline">MARK_ALL_UNDONE</span>
                    <span className="sm:hidden">UNDONE</span>
                  </>
                ) : (
                  <>
                    <CheckCheck className="w-3 h-3" />
                    <span className="hidden sm:inline">MARK_ALL_DONE</span>
                    <span className="sm:hidden">DONE</span>
                  </>
                )}
              </button>
              
              <button
                onClick={showDeleteAllConfirmation}
                className="text-red-500 hover:text-red-400 text-[10px] sm:text-xs font-mono px-2 py-1 border border-red-800 hover:border-red-600 transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                <span className="hidden sm:inline">DELETE_ALL</span>
                <span className="sm:hidden">DELETE</span>
              </button>
            </div>
          )}

          {/* Add Task Button */}
          <div className="mt-3">
            <button
              onClick={openCreateModal}
              className="text-cyan-500 hover:text-cyan-400 text-[10px] sm:text-xs font-mono px-2 py-1 border border-cyan-800 hover:border-cyan-600 transition-colors flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              <span className="hidden sm:inline">ADD_TASK</span>
              <span className="sm:hidden">ADD</span>
            </button>
          </div>
        </div>
        
        <div className="space-y-2 max-h-[400px] sm:max-h-[600px] overflow-y-auto pr-1 sm:pr-2">
          {tasks.length === 0 ? (
            <div className="text-center py-8 sm:py-12 border border-dashed border-zinc-800">
              <p className="text-[10px] sm:text-xs text-gray-600 font-mono">NO_TASKS_FOUND</p>
            </div>
          ) : (
            tasks.map((task) => (
              <div
                key={task._id}
                className={`bg-zinc-800/50 border border-zinc-700 p-3 sm:p-4 hover:border-cyan-900 transition-all group ${
                  task.completed ? 'opacity-50' : ''
                }`}
              >
                <div className="flex items-start gap-2 sm:gap-3">
                  <button
                    onClick={() => toggleComplete(task._id, task.completed)}
                    className="mt-0.5 flex-shrink-0 active:scale-90 transition-transform"
                  >
                    {task.completed ? (
                      <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
                    ) : (
                      <Circle className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 hover:text-cyan-500" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <h3 className={`text-gray-200 text-xs sm:text-sm font-mono break-words ${task.completed ? 'line-through' : ''}`}>
                      {task.title}
                    </h3>
                    {task.description && (
                      <p className="text-gray-500 text-[10px] sm:text-xs mt-1 font-mono break-words">{task.description}</p>
                    )}
                    {task.reminderTime && (
                      <div className="flex items-center gap-1 text-cyan-400 text-[10px] sm:text-xs mt-2 font-mono">
                        <Clock className="w-3 h-3" />
                        <span className="break-all">{formatDateTimeIST(task.reminderTime)} IST</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEditModal(task)}
                      className="text-cyan-500 hover:text-cyan-400 flex-shrink-0 active:scale-90 transition-transform p-1"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => showDeleteConfirmation(task)}
                      className="text-red-500 hover:text-red-400 flex-shrink-0 active:scale-90 transition-transform p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <TaskEditModal
        task={editingTask}
        isOpen={isEditModalOpen}
        onClose={closeEditModal}
        onSave={fetchTasks}
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirmation.isOpen && (
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
              <p className="text-[10px] text-gray-500 tracking-wider">&gt; CONFIRM_DELETE</p>
            </div>
            
            <div className="mb-6">
              {deleteConfirmation.type === 'single' && deleteConfirmation.task ? (
                <div>
                  <p className="text-gray-200 text-sm font-mono mb-2">
                    Delete task: "{deleteConfirmation.task.title}"?
                  </p>
                  {deleteConfirmation.task.description && (
                    <p className="text-gray-500 text-xs font-mono mb-2">
                      {deleteConfirmation.task.description}
                    </p>
                  )}
                  <p className="text-red-400 text-xs font-mono">
                    This action cannot be undone.
                  </p>
                </div>
              ) : deleteConfirmation.type === 'all' ? (
                <div>
                  <p className="text-gray-200 text-sm font-mono mb-2">
                    Delete all {tasks.length} tasks?
                  </p>
                  <p className="text-red-400 text-xs font-mono">
                    This will permanently delete all tasks and cannot be undone.
                  </p>
                </div>
              ) : deleteConfirmation.type === 'toggleAll' ? (
                <div>
                  <p className="text-gray-200 text-sm font-mono mb-2">
                    {allTasksCompleted 
                      ? `Mark all ${tasks.length} tasks as incomplete?`
                      : `Mark all ${tasks.length} tasks as completed?`
                    }
                  </p>
                  <p className={`text-xs font-mono ${allTasksCompleted ? 'text-yellow-400' : 'text-green-400'}`}>
                    {allTasksCompleted 
                      ? 'All tasks will be marked as not done. You can undo this action later.'
                      : 'All tasks will be marked as done. You can undo this action later.'
                    }
                  </p>
                </div>
              ) : null}
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
                className={`flex-1 px-4 py-2 text-xs font-mono border transition-colors ${
                  deleteConfirmation.type === 'toggleAll' 
                    ? allTasksCompleted
                      ? 'bg-yellow-900 hover:bg-yellow-800 text-yellow-100 border-yellow-700'
                      : 'bg-green-900 hover:bg-green-800 text-green-100 border-green-700'
                    : 'bg-red-900 hover:bg-red-800 text-red-100 border-red-700'
                }`}
              >
                {deleteConfirmation.type === 'single' 
                  ? 'DELETE' 
                  : deleteConfirmation.type === 'all'
                  ? 'DELETE_ALL'
                  : deleteConfirmation.type === 'toggleAll'
                  ? allTasksCompleted ? 'MARK_ALL_UNDONE' : 'MARK_ALL_DONE'
                  : 'CONFIRM'
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
