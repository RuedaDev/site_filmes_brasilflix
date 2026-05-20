// BrasilFLIX backend
// Serve o frontend e centraliza todas as chamadas ao TMDB para nao expor a chave no navegador.

const path = require("path");
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const TMDB_KEY = process.env.TMDB_KEY;
const TMDB_READ_TOKEN = process.env.TMDB_READ_TOKEN;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const PUBLIC_DIR = path.join(__dirname, "public");

// Middlewares basicos do servidor.
app.use(cors());
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

// Redireciona a raiz para a home atual.
app.get("/", (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "homepage-1.html"));
});

// ==================== CSP PERMISSIVO PARA DESENVOLVIMENTO ====================
app.use((req, res, next) => {
    res.setHeader(
        "Content-Security-Policy",
        "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; " +
        "script-src * 'unsafe-inline' 'unsafe-eval' data: blob:; " +
        "style-src * 'unsafe-inline' data: blob:; " +
        "img-src * data: blob:; " +
        "frame-src * data: blob:; " +
        "connect-src *; " +
        "media-src *;"
    );

    res.setHeader("X-Frame-Options", "ALLOWALL");
    res.setHeader("Access-Control-Allow-Origin", "*");
    
    next();
});
// ===========================================================================

// Health check simples para confirmar se o servidor e a chave estao prontos.
app.get("/api/health", (req, res) => {
    res.json({
        ok: true,
        tmdbConfigured: Boolean(hasValidApiKey() || hasValidReadToken())
    });
});

// Filmes populares.
app.get("/api/popular", async (req, res) => {
    const media = normalizeMedia(req.query.type || "movie");
    const page = normalizePage(req.query.page);
    const data = await tmdbRequest(`/${media}/popular`, { page });
    sendTmdbResult(res, data);
});

// Filmes/series mais bem avaliados.
app.get("/api/top", async (req, res) => {
    const media = normalizeMedia(req.query.type || "movie");
    const page = normalizePage(req.query.page);
    const data = await tmdbRequest(`/${media}/top_rated`, { page });
    sendTmdbResult(res, data);
});

// Tendencias da semana.
app.get("/api/trending", async (req, res) => {
    const media = normalizeMedia(req.query.type || "movie");
    const page = normalizePage(req.query.page);
    const data = await tmdbRequest(`/trending/${media}/week`, { page });
    sendTmdbResult(res, data);
});

// Discover permite montar catalogos grandes por paginas.
app.get("/api/discover", async (req, res) => {
    const media = normalizeMedia(req.query.type || "movie");
    const page = normalizePage(req.query.page);
    const data = await tmdbRequest(`/discover/${media}`, {
        page,
        sort_by: req.query.sort_by || "popularity.desc",
        with_genres: req.query.genre || undefined,
        primary_release_year: req.query.year || undefined,
        first_air_date_year: req.query.year || undefined
    });
    sendTmdbResult(res, data);
});

// Busca profissional em tempo real.
app.get("/api/search", async (req, res) => {
    const query = String(req.query.query || "").trim();
    const media = normalizeMedia(req.query.type || "movie");
    const page = normalizePage(req.query.page);

    if (!query) {
        res.json({ page: 1, results: [], total_pages: 0, total_results: 0 });
        return;
    }

    const data = await tmdbRequest(`/search/${media}`, {
        query,
        page,
        include_adult: false
    });
    sendTmdbResult(res, data);
});

// Detalhes completos para a pagina de detalhes/player.
app.get("/api/details/:type/:id", async (req, res) => {
    const media = normalizeMedia(req.params.type || "movie");
    const id = String(req.params.id || "").replace(/\D/g, "");

    if (!id) {
        res.status(400).json({ error: "invalid_id", message: "ID TMDB invalido." });
        return;
    }

    const data = await tmdbRequest(`/${media}/${id}`, {
        append_to_response: "videos,credits,recommendations,similar,external_ids"
    });
    sendTmdbResult(res, data);
});

// Compatibilidade com o codigo anterior do projeto.
app.get("/api/tmdb/popular", async (req, res) => {
    const media = normalizeMedia(req.query.type || "movie");
    const page = normalizePage(req.query.page);
    const data = await tmdbRequest(`/${media}/popular`, { page });
    sendTmdbResult(res, data);
});

app.get("/api/tmdb/movie/:id", async (req, res) => {
    const data = await tmdbRequest(`/movie/${req.params.id}`, {
        append_to_response: "videos,credits,recommendations,similar,external_ids"
    });
    sendTmdbResult(res, data);
});

app.get("/api/tmdb/tv/:id", async (req, res) => {
    const data = await tmdbRequest(`/tv/${req.params.id}`, {
        append_to_response: "videos,credits,recommendations,similar,external_ids"
    });
    sendTmdbResult(res, data);
});

app.get("/api/tmdb/find/:imdbId", async (req, res) => {
    const data = await tmdbRequest(`/find/${req.params.imdbId}`, {
        external_source: "imdb_id"
    });
    sendTmdbResult(res, data);
});

// ==================== ROTAS DE DORAMAS ====================

// Doramas populares (Coreanos, Japoneses, Chineses)
// Doramas populares - VERSÃO SIMPLIFICADA
app.get("/api/doramas/popular", async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    
    console.log("🎌 Buscando doramas página", page);
    
    // Busca séries coreanas populares (sem filtros complexos)
    const data = await tmdbRequest("/discover/tv", {
        page,
        sort_by: "popularity.desc",
        with_original_language: "ko",  // Apenas coreano (mais comum)
        "vote_count.gte": 1
    });
    
    console.log("📊 Resultados:", data.total_results);
    
    sendTmdbResult(res, data);
});
// Doramas em tendência
app.get("/api/doramas/trending", async (req, res) => {
    const page = normalizePage(req.query.page);
    
    const data = await tmdbRequest("/trending/tv/week", {
        page,
        language: "pt-BR"
    });
    
    // Filtra apenas conteúdo asiático
    if (data.results) {
        data.results = data.results.filter(item => 
            item.origin_country && 
            item.origin_country.some(country => ["KR", "JP", "CN", "TW", "TH"].includes(country))
        );
    }
    
    sendTmdbResult(res, data);
});

// Busca de doramas
app.get("/api/doramas/search", async (req, res) => {
    const query = String(req.query.query || "").trim();
    const page = normalizePage(req.query.page);
    
    if (!query) {
        res.json({ page: 1, results: [], total_pages: 0, total_results: 0 });
        return;
    }
    
    const data = await tmdbRequest("/search/tv", {
        query,
        page,
        include_adult: false,
        language: "pt-BR"
    });
    
    // Filtra resultados asiáticos
    if (data.results) {
        data.results = data.results.filter(item =>
            item.original_language && ["ko", "ja", "zh", "th"].includes(item.original_language)
        );
    }
    
    sendTmdbResult(res, data);
});

// Doramas por país específico
app.get("/api/doramas/by-country/:country", async (req, res) => {
    const page = normalizePage(req.query.page);
    const country = req.params.country.toUpperCase();
    
    const countryMap = {
        "KR": { language: "ko", name: "Coreia do Sul" },
        "JP": { language: "ja", name: "Japão" },
        "CN": { language: "zh", name: "China" },
        "TW": { language: "zh", name: "Taiwan" },
        "TH": { language: "th", name: "Tailândia" }
    };
    
    if (!countryMap[country]) {
        res.status(400).json({ error: "País não suportado" });
        return;
    }
    
    const data = await tmdbRequest("/discover/tv", {
        page,
        sort_by: "popularity.desc",
        with_original_language: countryMap[country].language,
        with_origin_country: country,
        "vote_count.gte": 5
    });
    
    sendTmdbResult(res, data);
});

// ==================== ROTAS DE ANIMES ====================

// Animes populares
app.get("/api/animes/popular", async (req, res) => {
    const page = normalizePage(req.query.page);
    
    const data = await tmdbRequest("/discover/tv", {
        page,
        sort_by: "popularity.desc",
        with_genres: "16", // Gênero de animação
        with_original_language: "ja", // Japonês
        with_origin_country: "JP",
        "vote_count.gte": 10,
        without_genres: "10764,10767" // Remove reality e talk show
    });
    
    sendTmdbResult(res, data);
});

// Animes em tendência
app.get("/api/animes/trending", async (req, res) => {
    const page = normalizePage(req.query.page);
    
    const data = await tmdbRequest("/trending/tv/week", {
        page,
        language: "pt-BR"
    });
    
    // Filtra apenas animes
    if (data.results) {
        data.results = data.results.filter(item =>
            item.genre_ids && item.genre_ids.includes(16) &&
            item.original_language === "ja"
        );
    }
    
    sendTmdbResult(res, data);
});

// Busca de animes
app.get("/api/animes/search", async (req, res) => {
    const query = String(req.query.query || "").trim();
    const page = normalizePage(req.query.page);
    
    if (!query) {
        res.json({ page: 1, results: [], total_pages: 0, total_results: 0 });
        return;
    }
    
    const data = await tmdbRequest("/search/tv", {
        query,
        page,
        include_adult: false,
        language: "pt-BR"
    });
    
    // Filtra apenas animes (gênero 16 = animação, idioma japonês)
    if (data.results) {
        data.results = data.results.filter(item =>
            item.genre_ids && item.genre_ids.includes(16) &&
            item.original_language === "ja"
        );
    }
    
    sendTmdbResult(res, data);
});

// Animes por gênero específico
app.get("/api/animes/by-genre/:genreId", async (req, res) => {
    const page = normalizePage(req.query.page);
    const genreId = req.params.genreId;
    
    // Gêneros populares de anime no TMDB
    const validGenres = {
        "16": "Animação",
        "10759": "Ação & Aventura",
        "35": "Comédia",
        "18": "Drama",
        "10765": "Sci-Fi & Fantasia",
        "9648": "Mistério",
        "10751": "Família"
    };
    
    if (!validGenres[genreId]) {
        res.status(400).json({ error: "Gênero não suportado para animes" });
        return;
    }
    
    const data = await tmdbRequest("/discover/tv", {
        page,
        sort_by: "popularity.desc",
        with_genres: `16,${genreId}`,
        with_original_language: "ja",
        with_origin_country: "JP",
        "vote_count.gte": 5
    });
    
    sendTmdbResult(res, data);
});

// Animes por temporada
app.get("/api/animes/seasonal", async (req, res) => {
    const page = normalizePage(req.query.page);
    const year = req.query.year || new Date().getFullYear();
    const season = req.query.season || getCurrentSeason();
    
    const data = await tmdbRequest("/discover/tv", {
        page,
        sort_by: "popularity.desc",
        with_genres: "16",
        with_original_language: "ja",
        first_air_date_year: year,
        "vote_count.gte": 5,
        with_origin_country: "JP"
    });
    
    sendTmdbResult(res, data);
});
// ==================== ROTAS DE GÊNEROS ====================

// Lista de gêneros
app.get("/api/genres/:type", async (req, res) => {
    const media = normalizeMedia(req.params.type || "movie");
    const data = await tmdbRequest(`/genre/${media}/list`, {
        language: "pt-BR"
    });
    sendTmdbResult(res, data);
});

// Conteúdo por gênero
app.get("/api/genre/:type/:genreId", async (req, res) => {
    const media = normalizeMedia(req.params.type || "movie");
    const genreId = req.params.genreId;
    const page = normalizePage(req.query.page);
    
    const data = await tmdbRequest(`/discover/${media}`, {
        page,
        sort_by: req.query.sort_by || "popularity.desc",
        with_genres: genreId,
        "vote_count.gte": 5
    });
    sendTmdbResult(res, data);
});

// ==================== ROTAS DE TENDÊNCIAS ====================

app.get("/api/trending/all", async (req, res) => {
    const page = normalizePage(req.query.page);
    const data = await tmdbRequest("/trending/all/week", {
        page
    });
    sendTmdbResult(res, data);
});

// ==================== ROTAS DE ELENCO ====================

app.get("/api/person/:id", async (req, res) => {
    const data = await tmdbRequest(`/person/${req.params.id}`, {
        append_to_response: "movie_credits,tv_credits",
        language: "pt-BR"
    });
    sendTmdbResult(res, data);
});

// ==================== ROTAS DE TRAILERS ====================

app.get("/api/trailers/:type/:id", async (req, res) => {
    const media = normalizeMedia(req.params.type || "movie");
    const data = await tmdbRequest(`/${media}/${req.params.id}/videos`, {
        language: "pt-BR"
    });
    sendTmdbResult(res, data);
});
// Qualquer rota desconhecida do frontend volta para a home.
app.use((req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "homepage-1.html"));
});

app.listen(PORT, () => {
    console.log(`✅ BrasilFLIX online em http://localhost:${PORT}`);
    console.log(`🎌 Rotas de Doramas: /api/doramas/*`);
    console.log(`🎬 Rotas de Animes: /api/animes/*`);
});

// ==================== FUNÇÕES AUXILIARES ====================

// Faz requisicoes ao TMDB sempre com idioma pt-BR e chave protegida no backend.
async function tmdbRequest(endpoint, params = {}) {
    if (!hasValidApiKey() && !hasValidReadToken()) {
        return {
            error: "tmdb_key_missing",
            message: "Configure TMDB_KEY ou TMDB_READ_TOKEN no arquivo .env."
        };
    }

    try {
        const headers = hasValidReadToken() ? { Authorization: `Bearer ${TMDB_READ_TOKEN}` } : {};
        const authParams = hasValidReadToken() ? {} : { api_key: TMDB_KEY };

        const response = await axios.get(`${TMDB_BASE_URL}${endpoint}`, {
            params: {
                ...authParams,
                language: "pt-BR",
                ...removeEmpty(params)
            },
            headers,
            timeout: 12000
        });

        return response.data;
    } catch (error) {
        console.error(`❌ Erro TMDB: ${endpoint}`, error.message);
        return {
            error: "tmdb_request_failed",
            status: error.response ? error.response.status : 500,
            message: error.message,
            details: error.response ? error.response.data : null
        };
    }
}

// Verifica se ha uma API key v3 plausivel configurada.
function hasValidApiKey() {
    return Boolean(TMDB_KEY && TMDB_KEY !== "cole_sua_api_key_aqui" && TMDB_KEY.length > 10);
}

// Verifica se ha um read access token v4 plausivel configurado.
function hasValidReadToken() {
    return Boolean(TMDB_READ_TOKEN && TMDB_READ_TOKEN !== "cole_seu_token_read_access_aqui" && TMDB_READ_TOKEN.startsWith("ey"));
}

// Envia resposta padronizada para falhas e sucessos do TMDB.
function sendTmdbResult(res, data) {
    if (data && data.error) {
        res.status(data.status || 500).json(data);
        return;
    }

    res.json(data);
}

// Normaliza o tipo de midia para os nomes aceitos pelo TMDB.
function normalizeMedia(type) {
    return type === "tv" || type === "series" ? "tv" : "movie";
}

// Limita paginas para evitar abuso acidental.
function normalizePage(page) {
    const value = Number(page || 1);
    if (!Number.isFinite(value) || value < 1) {
        return 1;
    }
    return Math.min(value, 500);
}

// Remove parametros vazios antes de chamar o TMDB.
function removeEmpty(params) {
    return Object.fromEntries(
        Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== "")
    );
}

// Retorna a estação atual para animes sazonais
function getCurrentSeason() {
    const month = new Date().getMonth();
    if (month >= 0 && month <= 2) return "winter";
    if (month >= 3 && month <= 5) return "spring";
    if (month >= 6 && month <= 8) return "summer";
    return "fall";
}