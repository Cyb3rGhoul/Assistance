import express from 'express';
import { GoogleGenAI } from '@google/genai';
import Link from '../models/Link.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

// Get all links with optional filtering
router.get('/', async (req, res) => {
  try {
    const { category, tag, search } = req.query;
    let query = { userId: req.user.userId };
    
    if (category) {
      query.category = category;
    }
    
    if (tag) {
      query.$or = [
        { autoTags: { $in: [tag] } },
        { userTags: { $in: [tag] } }
      ];
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { url: { $regex: search, $options: 'i' } }
      ];
    }
    
    const links = await Link.find(query).sort({ createdAt: -1 });
    res.json(links);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get categories and tags for filtering
router.get('/metadata', async (req, res) => {
  try {
    const links = await Link.find({ userId: req.user.userId });
    
    const categories = [...new Set(links.map(l => l.category).filter(Boolean))];
    const autoTags = [...new Set(links.flatMap(l => l.autoTags))];
    const userTags = [...new Set(links.flatMap(l => l.userTags))];
    
    res.json({
      categories,
      autoTags,
      userTags,
      allTags: [...new Set([...autoTags, ...userTags])]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add new link with AI categorization
router.post('/', async (req, res) => {
  try {
    const { url, userTags = [] } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    // Get user to access their API key
    const User = (await import('../models/User.js')).default;
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Fetch page metadata
    let title = url;
    let description = '';
    let favicon = '';
    
    try {
      const response = await fetch(url);
      const html = await response.text();
      
      // Extract title
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) {
        title = titleMatch[1].trim();
      }
      
      // Extract description
      const descMatch = html.match(/<meta[^>]*name=["\']description["\'][^>]*content=["\']([^"\']+)["\'][^>]*>/i);
      if (descMatch) {
        description = descMatch[1].trim();
      }
      
      // Extract favicon
      const faviconMatch = html.match(/<link[^>]*rel=["\'](?:shortcut )?icon["\'][^>]*href=["\']([^"\']+)["\'][^>]*>/i);
      if (faviconMatch) {
        favicon = faviconMatch[1];
        if (favicon.startsWith('/')) {
          const urlObj = new URL(url);
          favicon = `${urlObj.protocol}//${urlObj.host}${favicon}`;
        }
      }
    } catch (fetchError) {
      // Silently handle metadata fetch errors
    }
    
    // Use AI to categorize and tag
    let autoTags = [];
    let category = 'General';
    
    try {
      const apiKey = user.getCurrentApiKey();
      if (apiKey) {
        const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
        
        const prompt = `Analyze this link and return ONLY a JSON object:
URL: ${url}
Title: ${title}
Description: ${description}

Return format:
{
  "category": "one of: Technology, News, Education, Entertainment, Shopping, Social, Business, Health, Travel, Food, Sports, Finance, Design, Development, Other",
  "tags": ["tag1", "tag2"] (max 2 relevant tags, lowercase, most important only)
}`;

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-lite",
          contents: prompt,
        });
        
        const responseText = response.text.trim();
        // Remove markdown code blocks if present
        const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, '');
        const aiResult = JSON.parse(cleanedResponse);
        category = aiResult.category || 'General';
        autoTags = aiResult.tags || [];
      }
    } catch (aiError) {
      console.error('AI categorization error:', aiError.message);
      // Try backup API key if available
      try {
        if (user.geminiApiKey2 && user.currentApiKeyIndex === 1) {
          const backupApiKey = user.geminiApiKey2;
          const ai = new GoogleGenAI({ apiKey: backupApiKey.trim() });
          
          const prompt = `Analyze this link and return ONLY a JSON object:
URL: ${url}
Title: ${title}
Description: ${description}

Return format:
{
  "category": "one of: Technology, News, Education, Entertainment, Shopping, Social, Business, Health, Travel, Food, Sports, Finance, Design, Development, Other",
  "tags": ["tag1", "tag2"] (max 2 relevant tags, lowercase, most important only)
}`;

          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-lite",
            contents: prompt,
          });
          
          const responseText = response.text.trim();
          const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, '');
          const aiResult = JSON.parse(cleanedResponse);
          category = aiResult.category || 'General';
          autoTags = aiResult.tags || [];
          
          // Switch to backup key for future requests
          await user.switchToBackupApiKey();
        }
      } catch (backupError) {
        console.error('Backup API key also failed:', backupError.message);
        // Silently handle AI categorization errors - will use manual tags only
      }
    }
    
    const link = new Link({
      userId: req.user.userId,
      url,
      title,
      description,
      favicon,
      autoTags,
      userTags,
      category
    });
    
    await link.save();
    res.json(link);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update link (mainly for adding user tags)
router.put('/:id', async (req, res) => {
  try {
    const { userTags, title, description } = req.body;
    
    const updateData = { updatedAt: Date.now() };
    if (userTags !== undefined) updateData.userTags = userTags;
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    
    const link = await Link.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId },
      updateData,
      { new: true }
    );
    
    if (!link) {
      return res.status(404).json({ error: 'Link not found' });
    }
    
    res.json(link);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete link
router.delete('/:id', async (req, res) => {
  try {
    const link = await Link.findOneAndDelete({ 
      _id: req.params.id, 
      userId: req.user.userId 
    });
    
    if (!link) {
      return res.status(404).json({ error: 'Link not found' });
    }
    
    res.json({ message: 'Link deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;