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
    <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border border-white/20">
      <h2 className="text-3xl font-bold text-white mb-6">Your Tasks</h2>
      
      <div className="space-y-3 max-h-[600px] overflow-y-auto">
        {tasks.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No tasks yet. Use voice commands to add some!</p>
        ) : (
          tasks.map((task) => (
            <div
              key={task._id}
              className={`bg-white/5 rounded-xl p-4 border border-white/10 hover:bg-white/10 transition-all ${
                task.completed ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <button
                  onClick={() => toggleComplete(task._id, task.completed)}
                  className="mt-1 flex-shrink-0"
                >
                  {task.completed ? (
                    <CheckCircle2 className="w-6 h-6 text-green-400" />
                  ) : (
                    <Circle className="w-6 h-6 text-gray-400 hover:text-purple-400" />
                  )}
                </button>

                <div className="flex-1">
                  <h3 className={`text-white font-medium ${task.completed ? 'line-through' : ''}`}>
                    {task.title}
                  </h3>
                  {task.description && (
                    <p className="text-gray-400 text-sm mt-1">{task.description}</p>
                  )}
                  {task.reminderTime && (
                    <div className="flex items-center gap-1 text-purple-300 text-sm mt-2">
                      <Clock className="w-4 h-4" />
                      <span>{new Date(task.reminderTime).toLocaleString()}</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => deleteTask(task._id)}
                  className="text-red-400 hover:text-red-300 flex-shrink-0"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
