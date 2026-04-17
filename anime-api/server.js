/**
 * Simple Anime API Server
 * A minimal, non-modular anime API for streaming PWA
 * 
 * Endpoints:
 * - GET  /api/home              - Get home page data (recent, slider, airing)
 * - GET  /api/anime/:id         - Get anime info by ID or slug
 * - GET  /api/anime/:id/episodes - Get anime episodes
 * - GET  /api/search?q=         - Search anime by name
 * - GET  /api/genre/:genre      - Get anime by genre
 * - GET  /api/airing            - Get currently airing anime
 * - GET  /api/top-rated         - Get top rated anime
 * - GET  /api/random            - Get random anime
 * - GET  /api/total             - Get total anime count
 */

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// ============================================
// DATABASE SCHEMA
// ============================================
const EpisodeSchema = new mongoose.Schema({
  _id: { type: String, required: false },
  name: { type: String, trim: true },
  link: { type: String, trim: true },
  title: { type: String, trim: true }
});

const AnimeSchema = new mongoose.Schema({
  _id: { type: Number, required: false },
  name: { type: String, required: true },
  Name: { type: String, required: true, trim: true },
  finder: { type: String, trim: true }, // URL-friendly slug
  ImagePath: { type: String, trim: true },
  Cover: { type: String, trim: true },
  Synonyms: { type: String, trim: true },
  link: { type: String, trim: true },
  title: { type: String, trim: true },
  poster: { type: String, trim: true },
  MALID: { type: String, trim: true },
  Aired: { type: String, trim: true },
  Premiered: { type: String, trim: true },
  Duration: { type: String, trim: true },
  Status: { type: String, trim: true },
  MALScore: { type: String, trim: true },
  RatingsNum: { type: Number, min: 0 },
  Genres: { type: Array, required: true },
  Studios: { type: String, trim: true },
  Producers: { type: String, trim: true },
  DescripTion: { type: String, trim: true },
  type: { type: String, trim: true, enum: ['iframe', 'mp4', 'other'] },
  ep: [EpisodeSchema]
}, { timestamps: true });

const SliderSchema = new mongoose.Schema({
  _id: Number,
  slArray: [Number]
});

const Anime = mongoose.model('AniDB', AnimeSchema);
const Slider = mongoose.model('slider', SliderSchema);

// ============================================
// HELPER FUNCTIONS
// ============================================
const DEFAULT_FIELDS = { Name: 1, ImagePath: 1, DescripTion: 1, _id: 1, MALScore: 1, RatingsNum: 1, finder: 1 };

function changeStreamType(link, type) {
  if (!link) return link;
  if (link.includes('type=')) {
    return link.replace(/type=(sub|dub)/i, `type=${type}`);
  }
  if (link.match(/\/(sub|dub)/i)) {
    return link.replace(/\/(sub|dub)/i, `/${type}`);
  }
  return link;
}

function paginate(page = 1, limit = 20) {
  const p = Math.max(1, parseInt(page) || 1);
  return { skip: (p - 1) * limit, limit, page: p };
}

// ============================================
// API ENDPOINTS
// ============================================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get total anime count
app.get('/api/total', async (req, res) => {
  try {
    const total = await Anime.countDocuments();
    res.json({ total });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get count' });
  }
});

// Home page data
app.get('/api/home', async (req, res) => {
  try {
    // Recent anime
    const recent = await Anime.find({}, DEFAULT_FIELDS)
      .sort({ updatedAt: -1 })
      .limit(20);

    // Slider/featured anime
    let featured = [];
    const sliderDoc = await Slider.findById(1);
    if (sliderDoc?.slArray?.length) {
      featured = await Anime.find({ _id: { $in: sliderDoc.slArray } });
    }

    // Currently airing (random selection)
    const airing = await Anime.aggregate([
      { $match: { Status: 'Ongoing' } },
      { $sample: { size: 20 } },
      { $project: DEFAULT_FIELDS }
    ]);

    res.json({ recent, featured, airing });
  } catch (err) {
    console.error('Home API error:', err);
    res.status(500).json({ error: 'Failed to fetch home data' });
  }
});

// Get anime by ID or slug
app.get('/api/anime/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { type = 'sub' } = req.query;
    
    let anime;
    if (!isNaN(id)) {
      anime = await Anime.findById(Number(id));
    } else {
      anime = await Anime.findOne({ finder: id });
    }

    if (!anime) {
      return res.status(404).json({ error: 'Anime not found' });
    }

    // Transform episode links based on type (sub/dub)
    const result = anime.toObject();
    result.link = changeStreamType(result.link, type);
    if (result.ep?.length) {
      result.ep = result.ep.map(ep => ({
        ...ep,
        link: changeStreamType(ep.link, type)
      }));
    }
    result.epCount = result.ep?.length || 0;

    res.json(result);
  } catch (err) {
    console.error('Anime fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch anime' });
  }
});

// Get anime info (without episodes - lighter response)
app.get('/api/anime/:id/info', async (req, res) => {
  try {
    const { id } = req.params;
    
    let query;
    if (!isNaN(id)) {
      query = { _id: Number(id) };
    } else {
      query = { finder: id };
    }

    const anime = await Anime.findOne(query, {
      Genres: 1, Cover: 1, Synonyms: 1, Producers: 1, Premiered: 1,
      Aired: 1, Duration: 1, Status: 1, Studios: 1, Name: 1, ImagePath: 1,
      DescripTion: 1, _id: 1, MALScore: 1, RatingsNum: 1, finder: 1, MALID: 1,
      epCount: { $size: '$ep' }
    });

    if (!anime) {
      return res.status(404).json({ error: 'Anime not found' });
    }

    res.json(anime);
  } catch (err) {
    console.error('Anime info error:', err);
    res.status(500).json({ error: 'Failed to fetch anime info' });
  }
});

// Get anime episodes only
app.get('/api/anime/:id/episodes', async (req, res) => {
  try {
    const { id } = req.params;
    const { type = 'sub' } = req.query;
    
    let query;
    if (!isNaN(id)) {
      query = { _id: Number(id) };
    } else {
      query = { finder: id };
    }

    const anime = await Anime.findOne(query, { ep: 1, link: 1, Name: 1, _id: 1 });

    if (!anime) {
      return res.status(404).json({ error: 'Anime not found' });
    }

    const episodes = (anime.ep || []).map(ep => ({
      ...ep.toObject(),
      link: changeStreamType(ep.link, type)
    }));

    res.json({
      id: anime._id,
      name: anime.Name,
      mainLink: changeStreamType(anime.link, type),
      epCount: episodes.length,
      episodes
    });
  } catch (err) {
    console.error('Episodes fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch episodes' });
  }
});

// Search anime
app.get('/api/search', async (req, res) => {
  try {
    const { q, page = 1 } = req.query;

    if (!q || q.length < 2) {
      return res.json({ results: [], page: 1, query: q });
    }

    const { skip, limit, page: currentPage } = paginate(page);
    const regex = new RegExp(q, 'i');

    const results = await Anime.find(
      { Name: { $regex: regex } },
      DEFAULT_FIELDS
    ).skip(skip).limit(limit);

    res.json({ results, page: currentPage, query: q });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Quick search (for autocomplete)
app.get('/api/search/quick', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.json([]);
    }

    const regex = new RegExp(q, 'i');
    const results = await Anime.find(
      { Name: { $regex: regex } },
      { Name: 1, ImagePath: 1, _id: 1, finder: 1 }
    ).limit(10);

    res.json(results);
  } catch (err) {
    console.error('Quick search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Get anime by genre
app.get('/api/genre/:genre', async (req, res) => {
  try {
    const { genre } = req.params;
    const { page = 1 } = req.query;
    const { skip, limit, page: currentPage } = paginate(page);

    const results = await Anime.find(
      { Genres: genre.toLowerCase() },
      DEFAULT_FIELDS
    ).skip(skip).limit(limit);

    res.json({ results, page: currentPage, genre });
  } catch (err) {
    console.error('Genre search error:', err);
    res.status(500).json({ error: 'Failed to fetch by genre' });
  }
});

// Get currently airing anime
app.get('/api/airing', async (req, res) => {
  try {
    const { page = 1 } = req.query;
    const { skip, limit, page: currentPage } = paginate(page);

    const results = await Anime.find(
      { Status: 'Ongoing' },
      DEFAULT_FIELDS
    ).sort({ updatedAt: -1 }).skip(skip).limit(limit);

    res.json({ results, page: currentPage });
  } catch (err) {
    console.error('Airing fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch airing anime' });
  }
});

// Get top rated anime
app.get('/api/top-rated', async (req, res) => {
  try {
    const { page = 1 } = req.query;
    const { skip, limit, page: currentPage } = paginate(page, 10);

    const results = await Anime.find(
      { MALScore: { $ne: '?' } },
      DEFAULT_FIELDS
    ).sort({ MALScore: -1 }).skip(skip).limit(limit);

    res.json({ results, page: currentPage });
  } catch (err) {
    console.error('Top rated fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch top rated' });
  }
});

// Get random anime
app.get('/api/random', async (req, res) => {
  try {
    const count = req.query.count ? Math.min(parseInt(req.query.count), 20) : 1;
    
    const results = await Anime.aggregate([
      { $sample: { size: count } },
      { $project: { ...DEFAULT_FIELDS, ep: { $size: '$ep' } } }
    ]);

    if (count === 1) {
      res.json(results[0] || null);
    } else {
      res.json(results);
    }
  } catch (err) {
    console.error('Random fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch random anime' });
  }
});

// Check if anime exists by name
app.get('/api/check', async (req, res) => {
  try {
    const { name } = req.query;
    if (!name) {
      return res.json({ exists: false });
    }

    const anime = await Anime.findOne(
      { Name: new RegExp(`^${name}$`, 'i') },
      { _id: 1, ep: 1 }
    );

    if (!anime) {
      return res.json({ exists: false });
    }

    res.json({
      exists: true,
      id: anime._id,
      epCount: anime.ep?.length || 0
    });
  } catch (err) {
    console.error('Check error:', err);
    res.status(500).json({ error: 'Check failed' });
  }
});

// Get all anime (paginated)
app.get('/api/all', async (req, res) => {
  try {
    const { page = 1 } = req.query;
    const { skip, limit, page: currentPage } = paginate(page);

    const results = await Anime.find({}, DEFAULT_FIELDS)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Anime.countDocuments();

    res.json({
      results,
      page: currentPage,
      totalPages: Math.ceil(total / limit),
      total
    });
  } catch (err) {
    console.error('All anime fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch anime' });
  }
});

// ============================================
// JIKAN API INTEGRATION (External MAL Data)
// ============================================
async function fetchFromJikan(endpoint) {
  try {
    const response = await fetch(`https://api.jikan.moe/v4${endpoint}`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.data;
  } catch (err) {
    console.error('Jikan API error:', err.message);
    return null;
  }
}

// Get enhanced details with Jikan data
app.get('/api/anime/:id/details', async (req, res) => {
  try {
    const { id } = req.params;
    
    let query;
    if (!isNaN(id)) {
      query = { _id: Number(id) };
    } else {
      query = { finder: id };
    }

    const anime = await Anime.findOne(query, {
      Genres: 1, Cover: 1, Synonyms: 1, Producers: 1, Premiered: 1,
      Aired: 1, Duration: 1, Status: 1, Studios: 1, Name: 1, ImagePath: 1,
      DescripTion: 1, _id: 1, MALScore: 1, RatingsNum: 1, finder: 1, MALID: 1,
      epCount: { $size: '$ep' }
    });

    if (!anime) {
      return res.status(404).json({ error: 'Anime not found' });
    }

    const malId = anime.MALID || anime._id;
    
    // Fetch Jikan data in parallel
    const [jikanDetails, jikanCharacters] = await Promise.all([
      fetchFromJikan(`/anime/${malId}`),
      fetchFromJikan(`/anime/${malId}/characters`).then(data => data?.slice(0, 10) || [])
    ]);

    res.json({
      local: anime,
      jikan: jikanDetails,
      characters: jikanCharacters
    });
  } catch (err) {
    console.error('Details fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch details' });
  }
});

// ============================================
// ERROR HANDLING
// ============================================
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ============================================
// DATABASE CONNECTION & SERVER START
// ============================================
const MONGO_URI = process.env.MONGODB_URI || process.env.mongoDB || process.env.mongoToken;

if (!MONGO_URI) {
  console.error('MongoDB URI not found. Set MONGODB_URI in .env file');
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`Anime API running on http://localhost:${PORT}`);
      console.log('\nAvailable endpoints:');
      console.log('  GET /api/health          - Health check');
      console.log('  GET /api/home            - Home page data');
      console.log('  GET /api/total           - Total anime count');
      console.log('  GET /api/all             - All anime (paginated)');
      console.log('  GET /api/anime/:id       - Get anime by ID or slug');
      console.log('  GET /api/anime/:id/info  - Get anime info (no episodes)');
      console.log('  GET /api/anime/:id/episodes - Get episodes only');
      console.log('  GET /api/anime/:id/details  - Get enhanced details with Jikan');
      console.log('  GET /api/search?q=       - Search anime');
      console.log('  GET /api/search/quick?q= - Quick search (autocomplete)');
      console.log('  GET /api/genre/:genre    - Get by genre');
      console.log('  GET /api/airing          - Currently airing');
      console.log('  GET /api/top-rated       - Top rated anime');
      console.log('  GET /api/random          - Random anime');
      console.log('  GET /api/check?name=     - Check if anime exists');
    });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
