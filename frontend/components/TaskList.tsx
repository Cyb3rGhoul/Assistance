'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, Circle, Trash2, Clock } from 'lucide-react';
import api from '@/lib/api';

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

  const fetchTasks = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(api.endpoints.tasks.list, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setTasks(data);
    } catch (error) {
      console.error('Error fetching tasks:', error);
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
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 p-6">
      {/* Header */}
      <div className="border-b border-zinc-800 pb-3 mb-6">
        <p className="text-xs text-gray-500 tracking-wider">&gt; TASK_MANAGER</p>
        <p className="text-sm text-gray-400 mt-1">TOTAL: {tasks.length}</p>
      </div>
      
      <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
        {tasks.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-zinc-800">
            <p className="text-xs text-gray-600 font-mono">NO_TASKS_FOUND</p>
          </div>
        ) : (
          tasks.map((task) => (
            <div
              key={task._id}
              className={`bg-zinc-800/50 border border-zinc-700 p-4 hover:border-cyan-900 transition-all ${
                task.completed ? 'opacity-50' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <button
                  onClick={() => toggleComplete(task._id, task.completed)}
                  className="mt-0.5 flex-shrink-0"
                >
                  {task.completed ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-600 hover:text-cyan-500" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <h3 className={`text-gray-200 text-sm font-mono ${task.completed ? 'line-through' : ''}`}>
                    {task.title}
                  </h3>
                  {task.description && (
                    <p className="text-gray-500 text-xs mt-1 font-mono">{task.description}</p>
                  )}
                  {task.reminderTime && (
                    <div className="flex items-center gap-1 text-cyan-400 text-xs mt-2 font-mono">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(task.reminderTime).toLocaleString()}</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => deleteTask(task._id)}
                  className="text-red-500 hover:text-red-400 flex-shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
