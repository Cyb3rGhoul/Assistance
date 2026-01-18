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
    
    // Fetch page metadata with enhanced content extraction
    let title = url;
    let description = '';
    let favicon = '';
    let contentInfo = '';
    
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      const html = await response.text();
      
      // Extract basic metadata
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) {
        title = titleMatch[1].trim().replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
      }
      
      const descMatch = html.match(/<meta[^>]*name=["\']description["\'][^>]*content=["\']([^"\']+)["\'][^>]*>/i);
      if (descMatch) {
        description = descMatch[1].trim().replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
      }
      
      // Extract Open Graph data for better content understanding
      const ogTitleMatch = html.match(/<meta[^>]*property=["\']og:title["\'][^>]*content=["\']([^"\']+)["\'][^>]*>/i);
      if (ogTitleMatch && !title.includes(ogTitleMatch[1])) {
        title = ogTitleMatch[1].trim().replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
      }
      
      const ogDescMatch = html.match(/<meta[^>]*property=["\']og:description["\'][^>]*content=["\']([^"\']+)["\'][^>]*>/i);
      if (ogDescMatch && (!description || ogDescMatch[1].length > description.length)) {
        description = ogDescMatch[1].trim().replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
      }
      
      // Platform-specific content extraction
      const urlObj = new URL(url);
      const domain = urlObj.hostname.toLowerCase();
      
      if (domain.includes('youtube.com') || domain.includes('youtu.be')) {
        // YouTube specific extraction
        const ytTitleMatch = html.match(/"title":"([^"]+)"/);
        if (ytTitleMatch) {
          title = ytTitleMatch[1].replace(/\\u0026/g, '&').replace(/\\"/g, '"');
        }
        
        const ytDescMatch = html.match(/"shortDescription":"([^"]+)"/);
        if (ytDescMatch) {
          description = ytDescMatch[1].substring(0, 200).replace(/\\n/g, ' ').replace(/\\"/g, '"') + (ytDescMatch[1].length > 200 ? '...' : '');
        }
        
        const ytChannelMatch = html.match(/"ownerChannelName":"([^"]+)"/);
        if (ytChannelMatch) {
          contentInfo += `Channel: ${ytChannelMatch[1]}. `;
        }
        
        const ytViewsMatch = html.match(/"viewCount":"([^"]+)"/);
        if (ytViewsMatch) {
          contentInfo += `Views: ${parseInt(ytViewsMatch[1]).toLocaleString()}. `;
        }
        
      } else if (domain.includes('github.com')) {
        // GitHub specific extraction
        const repoMatch = html.match(/<meta[^>]*property=["\']og:title["\'][^>]*content=["\']([^"\']+)["\'][^>]*>/i);
        if (repoMatch) {
          title = repoMatch[1];
        }
        
        const langMatch = html.match(/<span[^>]*class="[^"]*color-fg-default[^"]*"[^>]*>([^<]+)<\/span>/);
        if (langMatch) {
          contentInfo += `Language: ${langMatch[1].trim()}. `;
        }
        
      } else if (domain.includes('stackoverflow.com')) {
        // Stack Overflow specific extraction
        const questionMatch = html.match(/<h1[^>]*class="[^"]*fs-headline1[^"]*"[^>]*>([^<]+)<\/h1>/);
        if (questionMatch) {
          title = questionMatch[1].trim();
        }
        
        const tagsMatch = html.match(/<div[^>]*class="[^"]*post-taglist[^"]*"[^>]*>(.*?)<\/div>/s);
        if (tagsMatch) {
          const tags = tagsMatch[1].match(/class="[^"]*post-tag[^"]*"[^>]*>([^<]+)</g);
          if (tags) {
            contentInfo += `Tags: ${tags.map(t => t.match(/>([^<]+)/)[1]).join(', ')}. `;
          }
        }
        
      } else if (domain.includes('medium.com') || domain.includes('dev.to')) {
        // Blog/Article specific extraction
        const authorMatch = html.match(/<meta[^>]*name=["\']author["\'][^>]*content=["\']([^"\']+)["\'][^>]*>/i);
        if (authorMatch) {
          contentInfo += `Author: ${authorMatch[1]}. `;
        }
        
        const readTimeMatch = html.match(/(\d+)\s*min\s*read/i);
        if (readTimeMatch) {
          contentInfo += `Read time: ${readTimeMatch[1]} min. `;
        }
        
      } else if (domain.includes('twitter.com') || domain.includes('x.com')) {
        // Twitter/X specific extraction
        const tweetMatch = html.match(/<meta[^>]*property=["\']og:description["\'][^>]*content=["\']([^"\']+)["\'][^>]*>/i);
        if (tweetMatch) {
          description = tweetMatch[1].substring(0, 150) + (tweetMatch[1].length > 150 ? '...' : '');
        }
        
      } else if (domain.includes('reddit.com')) {
        // Reddit specific extraction
        const subredditMatch = html.match(/r\/([^\/\s"]+)/);
        if (subredditMatch) {
          contentInfo += `Subreddit: r/${subredditMatch[1]}. `;
        }
      }
      
      // Extract favicon
      const faviconMatch = html.match(/<link[^>]*rel=["\'](?:shortcut )?icon["\'][^>]*href=["\']([^"\']+)["\'][^>]*>/i);
      if (faviconMatch) {
        favicon = faviconMatch[1];
        if (favicon.startsWith('/')) {
          favicon = `${urlObj.protocol}//${urlObj.host}${favicon}`;
        } else if (favicon.startsWith('//')) {
          favicon = `${urlObj.protocol}${favicon}`;
        } else if (!favicon.startsWith('http')) {
          favicon = `${urlObj.protocol}//${urlObj.host}/${favicon}`;
        }
      }
      
    } catch (fetchError) {
      console.error('Metadata fetch error:', fetchError.message);
    }
    
    // Use AI to categorize and tag with enhanced content understanding
    let autoTags = [];
    let category = 'General';
    let aiTitle = title;
    let aiDescription = description;
    
    try {
      const apiKey = user.getCurrentApiKey();
      if (apiKey) {
        const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
        
        const prompt = `Analyze this link and its content, then return ONLY a JSON object:

URL: ${url}
Original Title: ${title}
Original Description: ${description}
Content Info: ${contentInfo}
Domain: ${new URL(url).hostname}

Based on the content, provide:
1. An improved, concise title (max 80 chars) that clearly describes what this link is about
2. A brief, informative description (max 120 chars) that explains the content value
3. A category from the predefined list
4. 2-3 relevant tags that describe the content type and topic

Return format:
{
  "title": "improved title that clearly describes the content",
  "description": "brief description of what this content offers or is about",
  "category": "one of: Technology, News, Education, Entertainment, Shopping, Social, Business, Health, Travel, Food, Sports, Finance, Design, Development, Other",
  "tags": ["tag1", "tag2", "tag3"] (max 3 relevant tags, lowercase, specific to content)
}

Examples:
- YouTube video about React: {"title": "React Tutorial: Building Modern Web Apps", "description": "Step-by-step guide to creating React applications with hooks and components", "category": "Education", "tags": ["react", "tutorial", "javascript"]}
- GitHub repo: {"title": "Open Source Machine Learning Library", "description": "Python library for building and training neural networks", "category": "Development", "tags": ["python", "machine-learning", "open-source"]}`;

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-lite",
          contents: prompt,
        });
        
        const responseText = response.text.trim();
        // Remove markdown code blocks if present
        const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, '');
        const aiResult = JSON.parse(cleanedResponse);
        
        // Use AI-generated content if it's better than extracted content
        if (aiResult.title && aiResult.title.length > 10 && aiResult.title !== title) {
          aiTitle = aiResult.title;
        }
        if (aiResult.description && aiResult.description.length > 20) {
          aiDescription = aiResult.description;
        }
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
Content: ${contentInfo}

Return format:
{
  "title": "improved title (max 80 chars)",
  "description": "brief description (max 120 chars)",
  "category": "one of: Technology, News, Education, Entertainment, Shopping, Social, Business, Health, Travel, Food, Sports, Finance, Design, Development, Other",
  "tags": ["tag1", "tag2", "tag3"] (max 3 relevant tags, lowercase)
}`;

          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-lite",
            contents: prompt,
          });
          
          const responseText = response.text.trim();
          const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, '');
          const aiResult = JSON.parse(cleanedResponse);
          
          if (aiResult.title && aiResult.title.length > 10) aiTitle = aiResult.title;
          if (aiResult.description && aiResult.description.length > 20) aiDescription = aiResult.description;
          category = aiResult.category || 'General';
          autoTags = aiResult.tags || [];
          
          // Switch to backup key for future requests
          await user.switchToBackupApiKey();
        }
      } catch (backupError) {
        console.error('Backup API key also failed:', backupError.message);
        // Use extracted content as fallback
      }
    }
    
    const link = new Link({
      userId: req.user.userId,
      url,
      title: aiTitle,
      description: aiDescription,
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