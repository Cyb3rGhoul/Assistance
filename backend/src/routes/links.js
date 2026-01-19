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
    const { url, userTags = [], testMode = false } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    // Get user to access their API key (only if not in test mode)
    let user = null;
    if (!testMode) {
      const User = (await import('../models/User.js')).default;
      user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
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
    
    // Use AI to categorize and tag with enhanced content understanding (skip in test mode)
    let autoTags = [];
    let category = 'General';
    let aiTitle = title;
    let aiDescription = description;
    
    if (testMode) {
      // In test mode, just use basic categorization without AI
      const domain = new URL(url).hostname.toLowerCase();
      if (domain.includes('youtube.com') || domain.includes('youtu.be')) {
        category = 'Entertainment';
        autoTags = ['video', 'youtube'];
      } else if (domain.includes('github.com')) {
        category = 'Development';
        autoTags = ['code', 'github'];
      } else if (domain.includes('stackoverflow.com')) {
        category = 'Technology';
        autoTags = ['programming', 'qa'];
      } else if (domain.includes('medium.com') || domain.includes('dev.to')) {
        category = 'Education';
        autoTags = ['article', 'blog'];
      } else if (domain.includes('twitter.com') || domain.includes('x.com')) {
        category = 'Social';
        autoTags = ['social', 'twitter'];
      } else if (domain.includes('reddit.com')) {
        category = 'Social';
        autoTags = ['social', 'reddit'];
      }
      
      console.log('TEST MODE - Extracted data:');
      console.log('Title:', title);
      console.log('Description:', description);
      console.log('Content Info:', contentInfo);
      console.log('Category:', category);
      console.log('Auto Tags:', autoTags);
      
    } else {
      // Normal AI processing
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

Instructions:
1. ONLY improve the title if the original is generic, unclear, or unhelpful (like just "YouTube" or domain name)
2. ONLY improve the description if the original is missing, too short, or unclear
3. If the original title and description are already good and descriptive, keep them as-is
4. Focus on accurate categorization and relevant tags

Return format:
{
  "title": "keep original title unless it needs improvement",
  "description": "keep original description unless it needs improvement", 
  "category": "one of: Technology, News, Education, Entertainment, Shopping, Social, Business, Health, Travel, Food, Sports, Finance, Design, Development, Other",
  "tags": ["tag1", "tag2", "tag3"] (max 3 relevant tags, lowercase, specific to content)
}`;

          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-lite",
            contents: prompt,
          });
          
          const responseText = response.text.trim();
          // Remove markdown code blocks if present
          const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, '');
          const aiResult = JSON.parse(cleanedResponse);
          
          // Only use AI title if it's significantly different and better
          if (aiResult.title && aiResult.title !== title && aiResult.title.length > 10) {
            // Check if original title is generic or needs improvement
            const genericTitles = ['youtube', 'github', 'twitter', 'reddit', 'medium', 'stack overflow'];
            const isGeneric = genericTitles.some(generic => title.toLowerCase().includes(generic) && title.length < 50);
            
            if (isGeneric || title === url || title.length < 20) {
              aiTitle = aiResult.title;
            }
          }
          
          // Only use AI description if original is missing or too short
          if (aiResult.description && (!description || description.length < 30)) {
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

Return format:
{
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
    }
    
    const link = new Link({
      userId: testMode ? 'test-user-id' : req.user.userId,
      url,
      title: aiTitle,
      description: aiDescription,
      favicon,
      autoTags,
      userTags,
      category
    });
    
    if (!testMode) {
      await link.save();
    }
    
    res.json({
      ...link.toObject(),
      testMode,
      extractedData: testMode ? {
        originalTitle: title,
        originalDescription: description,
        contentInfo,
        domain: new URL(url).hostname
      } : undefined
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update link (mainly for adding user tags)
router.put('/:id', async (req, res) => {
  try {
    const { userTags, autoTags, title, description } = req.body;
    
    const updateData = { updatedAt: Date.now() };
    if (userTags !== undefined) updateData.userTags = userTags;
    if (autoTags !== undefined) updateData.autoTags = autoTags;
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