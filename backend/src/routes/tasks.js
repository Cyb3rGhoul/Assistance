import express from 'express';
import Task from '../models/Task.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const tasks = await Task.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const task = new Task({ ...req.body, userId: req.user.userId });
    await task.save();
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId },
      { ...req.body, updatedAt: Date.now() },
      { new: true }
    );
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await Task.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
    res.json({ message: 'Task deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete all tasks for the user
router.delete('/', async (req, res) => {
  try {
    const result = await Task.deleteMany({ userId: req.user.userId });
    res.json({ 
      message: `Deleted ${result.deletedCount} task${result.deletedCount !== 1 ? 's' : ''}`,
      deletedCount: result.deletedCount 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark all tasks as completed
router.put('/mark-all/completed', async (req, res) => {
  try {
    const result = await Task.updateMany(
      { userId: req.user.userId },
      { completed: true, updatedAt: Date.now() }
    );
    res.json({ 
      message: `Marked ${result.modifiedCount} task${result.modifiedCount !== 1 ? 's' : ''} as completed`,
      modifiedCount: result.modifiedCount 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark all tasks as incomplete
router.put('/mark-all/incomplete', async (req, res) => {
  try {
    const result = await Task.updateMany(
      { userId: req.user.userId },
      { completed: false, updatedAt: Date.now() }
    );
    res.json({ 
      message: `Marked ${result.modifiedCount} task${result.modifiedCount !== 1 ? 's' : ''} as incomplete`,
      modifiedCount: result.modifiedCount 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
