/**
 * Simple Anime API Server (HiAnime Provider)
 * A minimal, standalone anime API - NO DATABASE REQUIRED
 * Uses HiAnime (aniwatch-api) as the data source
 * 
 * Self-host aniwatch-api: https://github.com/ghoshRitesh12/aniwatch-api
 * 
 * Endpoints:
 * - GET  /api/home              - Get home page data
 * - GET  /api/anime/:id         - Get anime info
 * - GET  /api/anime/:id/episodes - Get anime episodes
 * - GET  /api/episode/:episodeId/servers - Get episode servers
 * - GET  /api/episode/:episodeId/sources - Get streaming sources
 * - GET  /api/search?q=         - Search anime
 * - GET  /api/genre/:genre      - Get anime by genre
 * - GET  /api/category/:category - Get anime by category
 * - GET  /api/schedule?date=    - Get anime schedule
 * - GET  /api/az-list/:letter   - A-Z anime list
 */

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// HiAnime API base URL - self-host your own: https://github.com/ghoshRitesh12/aniwatch-api
const HIANIME_API = process.env.HIANIME_API_URL || 'https://api.example.com';

// Middleware
app.use(cors());
app.use(express.json());

// ============================================
// HELPER FUNCTIONS
// ============================================

async function fetchHiAnime(endpoint) {
  try {
    const url = `${HIANIME_API}/api/v2/hianime${endpoint}`;
    console.log(`[API] Fetching: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'AnimeAPI/1.0'
      }
    });
    
    if (!response.ok) {
      console.error(`[API] Error ${response.status}: ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    return data.success ? data.data : null;
  } catch (err) {
    console.error('[API] Fetch error:', err.message);
    return null;
  }
}

function normalizeAnime(anime) {
  if (!anime) return null;
  return {
    id: anime.id,
    name: anime.name,
    jname: anime.jname,
    poster: anime.poster,
    description: anime.description,
    type: anime.type,
    duration: anime.duration,
    rating: anime.rating,
    quality: anime.quality,
    episodes: anime.episodes,
    rank: anime.rank,
    otherInfo: anime.otherInfo
  };
}

// ============================================
// API ENDPOINTS
// ============================================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    provider: 'HiAnime',
    apiUrl: HIANIME_API,
    timestamp: new Date().toISOString() 
  });
});

// Home page data
app.get('/api/home', async (req, res) => {
  try {
    const data = await fetchHiAnime('/home');
    
    if (!data) {
      return res.status(503).json({ error: 'Failed to fetch home data from provider' });
    }

    res.json({
      spotlight: data.spotlightAnimes?.map(normalizeAnime) || [],
      trending: data.trendingAnimes?.map(normalizeAnime) || [],
      latest: data.latestEpisodeAnimes?.map(normalizeAnime) || [],
      topAiring: data.topAiringAnimes?.map(normalizeAnime) || [],
      mostPopular: data.mostPopularAnimes?.map(normalizeAnime) || [],
      mostFavorite: data.mostFavoriteAnimes?.map(normalizeAnime) || [],
      latestCompleted: data.latestCompletedAnimes?.map(normalizeAnime) || [],
      topUpcoming: data.topUpcomingAnimes?.map(normalizeAnime) || [],
      top10: data.top10Animes || { today: [], week: [], month: [] },
      genres: data.genres || []
    });
  } catch (err) {
    console.error('Home API error:', err);
    res.status(500).json({ error: 'Failed to fetch home data' });
  }
});

// Get anime info
app.get('/api/anime/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = await fetchHiAnime(`/anime/${id}`);
    
    if (!data) {
      return res.status(404).json({ error: 'Anime not found' });
    }

    res.json({
      info: data.anime?.info || {},
      moreInfo: data.anime?.moreInfo || {},
      seasons: data.seasons || [],
      relatedAnimes: data.relatedAnimes || [],
      recommendedAnimes: data.recommendedAnimes || [],
      mostPopularAnimes: data.mostPopularAnimes || []
    });
  } catch (err) {
    console.error('Anime fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch anime' });
  }
});

// Get anime quick info (tooltip/preview)
app.get('/api/anime/:id/quick', async (req, res) => {
  try {
    const { id } = req.params;
    const data = await fetchHiAnime(`/qtip/${id}`);
    
    if (!data) {
      return res.status(404).json({ error: 'Anime not found' });
    }

    res.json(data.anime || {});
  } catch (err) {
    console.error('Quick info error:', err);
    res.status(500).json({ error: 'Failed to fetch anime info' });
  }
});

// Get anime episodes
app.get('/api/anime/:id/episodes', async (req, res) => {
  try {
    const { id } = req.params;
    const data = await fetchHiAnime(`/anime/${id}/episodes`);
    
    if (!data) {
      return res.status(404).json({ error: 'Episodes not found' });
    }

    res.json({
      totalEpisodes: data.totalEpisodes || 0,
      episodes: data.episodes || []
    });
  } catch (err) {
    console.error('Episodes fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch episodes' });
  }
});

// Get next episode schedule for an anime
app.get('/api/anime/:id/schedule', async (req, res) => {
  try {
    const { id } = req.params;
    const data = await fetchHiAnime(`/anime/${id}/schedule`);
    
    res.json(data || { scheduledAt: null });
  } catch (err) {
    console.error('Schedule fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch schedule' });
  }
});

// Get episode servers
app.get('/api/episode/:episodeId/servers', async (req, res) => {
  try {
    const { episodeId } = req.params;
    const data = await fetchHiAnime(`/episode/servers?animeEpisodeId=${episodeId}`);
    
    if (!data) {
      return res.status(404).json({ error: 'Servers not found' });
    }

    res.json({
      episodeId: data.episodeId,
      episodeNo: data.episodeNo,
      sub: data.sub || [],
      dub: data.dub || [],
      raw: data.raw || []
    });
  } catch (err) {
    console.error('Servers fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch servers' });
  }
});

// Get episode streaming sources
app.get('/api/episode/:episodeId/sources', async (req, res) => {
  try {
    const { episodeId } = req.params;
    const { server = 'hd-1', category = 'sub' } = req.query;
    
    const data = await fetchHiAnime(
      `/episode/sources?animeEpisodeId=${episodeId}&server=${server}&category=${category}`
    );
    
    if (!data) {
      return res.status(404).json({ error: 'Sources not found' });
    }

    res.json({
      tracks: data.tracks || [],
      intro: data.intro || {},
      outro: data.outro || {},
      sources: data.sources || [],
      anilistID: data.anilistID,
      malID: data.malID
    });
  } catch (err) {
    console.error('Sources fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch sources' });
  }
});

// Search anime
app.get('/api/search', async (req, res) => {
  try {
    const { q, page = 1 } = req.query;

    if (!q || q.length < 2) {
      return res.json({ results: [], page: 1, query: q, hasNextPage: false });
    }

    const data = await fetchHiAnime(`/search?q=${encodeURIComponent(q)}&page=${page}`);
    
    if (!data) {
      return res.json({ results: [], page: 1, query: q, hasNextPage: false });
    }

    res.json({
      results: data.animes?.map(normalizeAnime) || [],
      mostPopular: data.mostPopularAnimes?.map(normalizeAnime) || [],
      page: data.currentPage || 1,
      totalPages: data.totalPages || 1,
      hasNextPage: data.hasNextPage || false,
      query: q
    });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Search suggestions (autocomplete)
app.get('/api/search/suggest', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.json({ suggestions: [] });
    }

    const data = await fetchHiAnime(`/search/suggestion?q=${encodeURIComponent(q)}`);
    
    res.json({
      suggestions: data?.suggestions || []
    });
  } catch (err) {
    console.error('Suggestion error:', err);
    res.status(500).json({ error: 'Suggestion failed' });
  }
});

// Get anime by genre
app.get('/api/genre/:genre', async (req, res) => {
  try {
    const { genre } = req.params;
    const { page = 1 } = req.query;

    const data = await fetchHiAnime(`/genre/${genre}?page=${page}`);
    
    if (!data) {
      return res.json({ results: [], page: 1, genre, hasNextPage: false });
    }

    res.json({
      results: data.animes?.map(normalizeAnime) || [],
      page: data.currentPage || 1,
      totalPages: data.totalPages || 1,
      hasNextPage: data.hasNextPage || false,
      genre,
      genreInfo: data.genreName
    });
  } catch (err) {
    console.error('Genre search error:', err);
    res.status(500).json({ error: 'Failed to fetch by genre' });
  }
});

// Get anime by category (e.g., subbed-anime, dubbed-anime, movie, tv, ova, ona, special, most-popular, etc.)
app.get('/api/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const { page = 1 } = req.query;

    const data = await fetchHiAnime(`/category/${category}?page=${page}`);
    
    if (!data) {
      return res.json({ results: [], page: 1, category, hasNextPage: false });
    }

    res.json({
      results: data.animes?.map(normalizeAnime) || [],
      top10Animes: data.top10Animes || { today: [], week: [], month: [] },
      page: data.currentPage || 1,
      totalPages: data.totalPages || 1,
      hasNextPage: data.hasNextPage || false,
      category,
      categoryInfo: data.category
    });
  } catch (err) {
    console.error('Category search error:', err);
    res.status(500).json({ error: 'Failed to fetch by category' });
  }
});

// Get producer/studio anime
app.get('/api/producer/:producerId', async (req, res) => {
  try {
    const { producerId } = req.params;
    const { page = 1 } = req.query;

    const data = await fetchHiAnime(`/producer/${producerId}?page=${page}`);
    
    if (!data) {
      return res.json({ results: [], page: 1, hasNextPage: false });
    }

    res.json({
      results: data.animes?.map(normalizeAnime) || [],
      producerName: data.producerName,
      page: data.currentPage || 1,
      totalPages: data.totalPages || 1,
      hasNextPage: data.hasNextPage || false
    });
  } catch (err) {
    console.error('Producer search error:', err);
    res.status(500).json({ error: 'Failed to fetch by producer' });
  }
});

// Get anime schedule
app.get('/api/schedule', async (req, res) => {
  try {
    // Format: YYYY-MM-DD
    const { date } = req.query;
    const scheduleDate = date || new Date().toISOString().split('T')[0];

    const data = await fetchHiAnime(`/schedule?date=${scheduleDate}`);
    
    if (!data) {
      return res.json({ scheduledAnimes: [], date: scheduleDate });
    }

    res.json({
      scheduledAnimes: data.scheduledAnimes || [],
      date: scheduleDate
    });
  } catch (err) {
    console.error('Schedule fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch schedule' });
  }
});

// A-Z List
app.get('/api/az-list/:letter', async (req, res) => {
  try {
    const { letter } = req.params;
    const { page = 1 } = req.query;

    // Valid: all, other, 0-9, a-z
    const data = await fetchHiAnime(`/azlist/${letter.toLowerCase()}?page=${page}`);
    
    if (!data) {
      return res.json({ results: [], page: 1, hasNextPage: false });
    }

    res.json({
      results: data.animes?.map(normalizeAnime) || [],
      sortOption: data.sortOption,
      page: data.currentPage || 1,
      totalPages: data.totalPages || 1,
      hasNextPage: data.hasNextPage || false
    });
  } catch (err) {
    console.error('AZ list error:', err);
    res.status(500).json({ error: 'Failed to fetch A-Z list' });
  }
});

// ============================================
// CONVENIENCE ENDPOINTS (Mapped from categories)
// ============================================

// Currently airing
app.get('/api/airing', async (req, res) => {
  try {
    const { page = 1 } = req.query;
    const data = await fetchHiAnime(`/category/top-airing?page=${page}`);
    
    res.json({
      results: data?.animes?.map(normalizeAnime) || [],
      page: data?.currentPage || 1,
      totalPages: data?.totalPages || 1,
      hasNextPage: data?.hasNextPage || false
    });
  } catch (err) {
    console.error('Airing fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch airing anime' });
  }
});

// Most popular
app.get('/api/popular', async (req, res) => {
  try {
    const { page = 1 } = req.query;
    const data = await fetchHiAnime(`/category/most-popular?page=${page}`);
    
    res.json({
      results: data?.animes?.map(normalizeAnime) || [],
      page: data?.currentPage || 1,
      totalPages: data?.totalPages || 1,
      hasNextPage: data?.hasNextPage || false
    });
  } catch (err) {
    console.error('Popular fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch popular anime' });
  }
});

// Most favorite
app.get('/api/favorite', async (req, res) => {
  try {
    const { page = 1 } = req.query;
    const data = await fetchHiAnime(`/category/most-favorite?page=${page}`);
    
    res.json({
      results: data?.animes?.map(normalizeAnime) || [],
      page: data?.currentPage || 1,
      totalPages: data?.totalPages || 1,
      hasNextPage: data?.hasNextPage || false
    });
  } catch (err) {
    console.error('Favorite fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch favorite anime' });
  }
});

// Completed anime
app.get('/api/completed', async (req, res) => {
  try {
    const { page = 1 } = req.query;
    const data = await fetchHiAnime(`/category/completed?page=${page}`);
    
    res.json({
      results: data?.animes?.map(normalizeAnime) || [],
      page: data?.currentPage || 1,
      totalPages: data?.totalPages || 1,
      hasNextPage: data?.hasNextPage || false
    });
  } catch (err) {
    console.error('Completed fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch completed anime' });
  }
});

// Subbed anime
app.get('/api/subbed', async (req, res) => {
  try {
    const { page = 1 } = req.query;
    const data = await fetchHiAnime(`/category/subbed-anime?page=${page}`);
    
    res.json({
      results: data?.animes?.map(normalizeAnime) || [],
      page: data?.currentPage || 1,
      totalPages: data?.totalPages || 1,
      hasNextPage: data?.hasNextPage || false
    });
  } catch (err) {
    console.error('Subbed fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch subbed anime' });
  }
});

// Dubbed anime
app.get('/api/dubbed', async (req, res) => {
  try {
    const { page = 1 } = req.query;
    const data = await fetchHiAnime(`/category/dubbed-anime?page=${page}`);
    
    res.json({
      results: data?.animes?.map(normalizeAnime) || [],
      page: data?.currentPage || 1,
      totalPages: data?.totalPages || 1,
      hasNextPage: data?.hasNextPage || false
    });
  } catch (err) {
    console.error('Dubbed fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch dubbed anime' });
  }
});

// Movies
app.get('/api/movies', async (req, res) => {
  try {
    const { page = 1 } = req.query;
    const data = await fetchHiAnime(`/category/movie?page=${page}`);
    
    res.json({
      results: data?.animes?.map(normalizeAnime) || [],
      page: data?.currentPage || 1,
      totalPages: data?.totalPages || 1,
      hasNextPage: data?.hasNextPage || false
    });
  } catch (err) {
    console.error('Movies fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch movies' });
  }
});

// TV Series
app.get('/api/tv', async (req, res) => {
  try {
    const { page = 1 } = req.query;
    const data = await fetchHiAnime(`/category/tv?page=${page}`);
    
    res.json({
      results: data?.animes?.map(normalizeAnime) || [],
      page: data?.currentPage || 1,
      totalPages: data?.totalPages || 1,
      hasNextPage: data?.hasNextPage || false
    });
  } catch (err) {
    console.error('TV fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch TV series' });
  }
});

// OVA
app.get('/api/ova', async (req, res) => {
  try {
    const { page = 1 } = req.query;
    const data = await fetchHiAnime(`/category/ova?page=${page}`);
    
    res.json({
      results: data?.animes?.map(normalizeAnime) || [],
      page: data?.currentPage || 1,
      totalPages: data?.totalPages || 1,
      hasNextPage: data?.hasNextPage || false
    });
  } catch (err) {
    console.error('OVA fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch OVA' });
  }
});

// ONA
app.get('/api/ona', async (req, res) => {
  try {
    const { page = 1 } = req.query;
    const data = await fetchHiAnime(`/category/ona?page=${page}`);
    
    res.json({
      results: data?.animes?.map(normalizeAnime) || [],
      page: data?.currentPage || 1,
      totalPages: data?.totalPages || 1,
      hasNextPage: data?.hasNextPage || false
    });
  } catch (err) {
    console.error('ONA fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch ONA' });
  }
});

// Specials
app.get('/api/special', async (req, res) => {
  try {
    const { page = 1 } = req.query;
    const data = await fetchHiAnime(`/category/special?page=${page}`);
    
    res.json({
      results: data?.animes?.map(normalizeAnime) || [],
      page: data?.currentPage || 1,
      totalPages: data?.totalPages || 1,
      hasNextPage: data?.hasNextPage || false
    });
  } catch (err) {
    console.error('Special fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch specials' });
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
// SERVER START
// ============================================
app.listen(PORT, () => {
  console.log(`Anime API running on http://localhost:${PORT}`);
  console.log(`Provider: HiAnime API (${HIANIME_API})`);
  console.log('\nAvailable endpoints:');
  console.log('  GET /api/health                    - Health check');
  console.log('  GET /api/home                      - Home page data');
  console.log('  GET /api/anime/:id                 - Get anime info');
  console.log('  GET /api/anime/:id/quick           - Get anime quick info');
  console.log('  GET /api/anime/:id/episodes        - Get episodes');
  console.log('  GET /api/anime/:id/schedule        - Get next episode schedule');
  console.log('  GET /api/episode/:id/servers       - Get episode servers');
  console.log('  GET /api/episode/:id/sources       - Get streaming sources');
  console.log('  GET /api/search?q=                 - Search anime');
  console.log('  GET /api/search/suggest?q=         - Search suggestions');
  console.log('  GET /api/genre/:genre              - Get by genre');
  console.log('  GET /api/category/:category        - Get by category');
  console.log('  GET /api/producer/:id              - Get by producer/studio');
  console.log('  GET /api/schedule?date=            - Get schedule');
  console.log('  GET /api/az-list/:letter           - A-Z list');
  console.log('  GET /api/airing                    - Currently airing');
  console.log('  GET /api/popular                   - Most popular');
  console.log('  GET /api/favorite                  - Most favorite');
  console.log('  GET /api/completed                 - Completed anime');
  console.log('  GET /api/subbed                    - Subbed anime');
  console.log('  GET /api/dubbed                    - Dubbed anime');
  console.log('  GET /api/movies                    - Movies');
  console.log('  GET /api/tv                        - TV series');
  console.log('  GET /api/ova                       - OVA');
  console.log('  GET /api/ona                       - ONA');
  console.log('  GET /api/special                   - Specials');
});
