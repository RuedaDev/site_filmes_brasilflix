// BrasilFLIX backend com autenticação
const path = require("path");
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Database = require("better-sqlite3");

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const TMDB_KEY = process.env.TMDB_KEY;
const TMDB_READ_TOKEN = process.env.TMDB_READ_TOKEN;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const PUBLIC_DIR = path.join(__dirname, "public");
const JWT_SECRET = process.env.JWT_SECRET || "brasilflix_secret_key_2024";

// Banco de dados SQLite
const db = new Database("brasilflix.db");
db.pragma("journal_mode = WAL");

// Cria tabelas se não existirem
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        tmdb_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        poster_path TEXT,
        media_type TEXT DEFAULT 'movie',
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(user_id, tmdb_id)
    );

    CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        tmdb_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        poster_path TEXT,
        media_type TEXT DEFAULT 'movie',
        watched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    );
`);

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

// Redireciona a raiz
app.get("/", (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "homepage-1.html"));
});

// CSP Permissivo
app.use((req, res, next) => {
    res.setHeader("Content-Security-Policy",
        "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; " +
        "script-src * 'unsafe-inline' 'unsafe-eval' data: blob:; " +
        "style-src * 'unsafe-inline' data: blob:; " +
        "img-src * data: blob:; " +
        "frame-src * data: blob:; " +
        "connect-src *; " +
        "media-src *;");
    res.setHeader("X-Frame-Options", "ALLOWALL");
    res.setHeader("Access-Control-Allow-Origin", "*");
    next();
});

// ==================== ROTAS DE AUTENTICAÇÃO ====================

// Middleware para verificar token
function authenticateToken(req, res, next) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({ error: "Token não fornecido" });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: "Token inválido" });
        }
        req.user = user;
        next();
    });
}

// Registro de usuário
app.post("/api/auth/register", async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ error: "Todos os campos são obrigatórios" });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: "A senha deve ter pelo menos 6 caracteres" });
    }

    try {
        // Verifica se o email já existe
        const existingUser = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
        if (existingUser) {
            return res.status(400).json({ error: "Email já cadastrado" });
        }

        // Criptografa a senha
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insere o usuário
        const result = db.prepare("INSERT INTO users (name, email, password) VALUES (?, ?, ?)").run(name, email, hashedPassword);

        // Gera token
        const token = jwt.sign({ id: result.lastInsertRowid, name, email }, JWT_SECRET, { expiresIn: "30d" });

        res.status(201).json({
            message: "Conta criada com sucesso!",
            token,
            user: {
                id: result.lastInsertRowid,
                name,
                email
            }
        });
    } catch (error) {
        console.error("Erro no registro:", error);
        res.status(500).json({ error: "Erro ao criar conta" });
    }
});

// Login
app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "Email e senha são obrigatórios" });
    }

    try {
        // Busca o usuário
        const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
        if (!user) {
            return res.status(401).json({ error: "Email ou senha incorretos" });
        }

        // Verifica a senha
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: "Email ou senha incorretos" });
        }

        // Gera token
        const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: "30d" });

        res.json({
            message: "Login bem-sucedido!",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            }
        });
    } catch (error) {
        console.error("Erro no login:", error);
        res.status(500).json({ error: "Erro ao fazer login" });
    }
});

// Obter perfil do usuário
app.get("/api/auth/profile", authenticateToken, (req, res) => {
    const user = db.prepare("SELECT id, name, email, created_at FROM users WHERE id = ?").get(req.user.id);
    if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado" });
    }
    res.json(user);
});

// ==================== ROTAS DE FAVORITOS (SERVIDOR) ====================

// Adicionar favorito
app.post("/api/favorites", authenticateToken, (req, res) => {
    const { tmdb_id, title, poster_path, media_type } = req.body;

    try {
        db.prepare("INSERT OR IGNORE INTO favorites (user_id, tmdb_id, title, poster_path, media_type) VALUES (?, ?, ?, ?, ?)").run(
            req.user.id, tmdb_id, title, poster_path, media_type || "movie"
        );
        res.json({ message: "Favorito adicionado!" });
    } catch (error) {
        res.status(500).json({ error: "Erro ao adicionar favorito" });
    }
});

// Listar favoritos
app.get("/api/favorites", authenticateToken, (req, res) => {
    const favorites = db.prepare("SELECT * FROM favorites WHERE user_id = ? ORDER BY added_at DESC").all(req.user.id);
    res.json(favorites);
});

// Remover favorito
app.delete("/api/favorites/:tmdb_id", authenticateToken, (req, res) => {
    db.prepare("DELETE FROM favorites WHERE user_id = ? AND tmdb_id = ?").run(req.user.id, req.params.tmdb_id);
    res.json({ message: "Favorito removido" });
});

// Verificar se está favoritado
app.get("/api/favorites/check/:tmdb_id", authenticateToken, (req, res) => {
    const fav = db.prepare("SELECT id FROM favorites WHERE user_id = ? AND tmdb_id = ?").get(req.user.id, req.params.tmdb_id);
    res.json({ isFavorited: !!fav });
});

// ==================== ROTAS DE HISTÓRICO (SERVIDOR) ====================

// Adicionar ao histórico
app.post("/api/history", authenticateToken, (req, res) => {
    const { tmdb_id, title, poster_path, media_type } = req.body;

    try {
        db.prepare("INSERT INTO history (user_id, tmdb_id, title, poster_path, media_type) VALUES (?, ?, ?, ?, ?)").run(
            req.user.id, tmdb_id, title, poster_path, media_type || "movie"
        );
        res.json({ message: "Histórico atualizado!" });
    } catch (error) {
        res.status(500).json({ error: "Erro ao salvar histórico" });
    }
});

// Listar histórico
app.get("/api/history", authenticateToken, (req, res) => {
    const history = db.prepare("SELECT * FROM history WHERE user_id = ? ORDER BY watched_at DESC LIMIT 50").all(req.user.id);
    res.json(history);
});

// ==================== ROTAS EXISTENTES DO TMDB ====================

// Health check
app.get("/api/health", (req, res) => {
    res.json({
        ok: true,
        tmdbConfigured: Boolean(hasValidApiKey() || hasValidReadToken())
    });
});

// Filmes populares
app.get("/api/popular", async (req, res) => {
    const media = normalizeMedia(req.query.type || "movie");
    const page = normalizePage(req.query.page);
    const data = await tmdbRequest(`/${media}/popular`, { page });
    sendTmdbResult(res, data);
});

// Top rated
app.get("/api/top", async (req, res) => {
    const media = normalizeMedia(req.query.type || "movie");
    const page = normalizePage(req.query.page);
    const data = await tmdbRequest(`/${media}/top_rated`, { page });
    sendTmdbResult(res, data);
});

// Trending
app.get("/api/trending", async (req, res) => {
    const media = normalizeMedia(req.query.type || "movie");
    const page = normalizePage(req.query.page);
    const data = await tmdbRequest(`/trending/${media}/week`, { page });
    sendTmdbResult(res, data);
});

// Discover
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

// Search
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

// Details
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

// Rotas TMDB adicionais
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

app.get("/api/doramas/popular", async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const data = await tmdbRequest("/discover/tv", {
        page,
        sort_by: "popularity.desc",
        with_original_language: "ko|ja|zh",
        with_origin_country: "KR|JP|CN|TW",
        "vote_count.gte": 10
    });
    sendTmdbResult(res, data);
});

app.get("/api/doramas/search", async (req, res) => {
    const query = String(req.query.query || "").trim();
    if (!query) {
        res.json({ results: [] });
        return;
    }
    const data = await tmdbRequest("/search/tv", { query, include_adult: false });
    if (data.results) {
        data.results = data.results.filter(item => ["ko", "ja", "zh", "th"].includes(item.original_language));
    }
    sendTmdbResult(res, data);
});

// ==================== ROTAS DE ANIMES ====================

app.get("/api/animes/popular", async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const data = await tmdbRequest("/discover/tv", {
        page,
        sort_by: "popularity.desc",
        with_genres: "16",
        with_original_language: "ja",
        "vote_count.gte": 10
    });
    sendTmdbResult(res, data);
});

// ==================== OUTRAS ROTAS ====================

app.get("/api/trailers/:type/:id", async (req, res) => {
    const media = normalizeMedia(req.params.type || "movie");
    const data = await tmdbRequest(`/${media}/${req.params.id}/videos`, { language: "pt-BR" });
    sendTmdbResult(res, data);
});

// ads.txt
app.get("/ads.txt", (req, res) => {
    res.type("text/plain");
    res.send("google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0");
});

// Fallback para páginas HTML
app.use((req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "homepage-1.html"));
});

// Estatísticas do usuário (perfil)
app.get("/api/user/stats", authenticateToken, (req, res) => {
    const userId = req.user.id;
    const favCount = db.prepare("SELECT COUNT(*) as count FROM favorites WHERE user_id = ?").get(userId).count;
    const histCount = db.prepare("SELECT COUNT(*) as count FROM history WHERE user_id = ?").get(userId).count;
    const user = db.prepare("SELECT name, email, created_at FROM users WHERE id = ?").get(userId);
    res.json({ ...user, favoritesCount: favCount, historyCount: histCount });
});

// Rota admin: listar usuários
app.get("/api/admin/users", (req, res) => {
    const { key } = req.query;
    if (key !== process.env.ADMIN_KEY) {
        return res.status(403).json({ error: "Acesso negado" });
    }
    const users = db.prepare("SELECT id, name, email, created_at FROM users ORDER BY created_at DESC").all();
    res.json({ total: users.length, users });
});
// ==================== INICIAR SERVIDOR ====================

app.listen(PORT, () => {
    console.log(`✅ BrasilFLIX online em http://localhost:${PORT}`);
});

// ==================== FUNÇÕES AUXILIARES ====================

async function tmdbRequest(endpoint, params = {}) {
    if (!hasValidApiKey() && !hasValidReadToken()) {
        return { error: "tmdb_key_missing", message: "Configure TMDB_KEY no arquivo .env." };
    }

    try {
        const headers = hasValidReadToken() ? { Authorization: `Bearer ${TMDB_READ_TOKEN}` } : {};
        const authParams = hasValidReadToken() ? {} : { api_key: TMDB_KEY };

        const response = await axios.get(`${TMDB_BASE_URL}${endpoint}`, {
            params: { ...authParams, language: "pt-BR", ...removeEmpty(params) },
            headers,
            timeout: 12000
        });

        return response.data;
    } catch (error) {
        console.error(`❌ Erro TMDB: ${endpoint}`, error.message);
        return { error: "tmdb_request_failed" };
    }
}

function hasValidApiKey() {
    return Boolean(TMDB_KEY && TMDB_KEY.length > 10);
}

function hasValidReadToken() {
    return Boolean(TMDB_READ_TOKEN && TMDB_READ_TOKEN.startsWith("ey"));
}

function sendTmdbResult(res, data) {
    if (data && data.error) {
        res.status(500).json(data);
        return;
    }
    res.json(data);
}

function normalizeMedia(type) {
    return type === "tv" || type === "series" ? "tv" : "movie";
}

function normalizePage(page) {
    const value = Number(page || 1);
    if (!Number.isFinite(value) || value < 1) return 1;
    return Math.min(value, 500);
}

function removeEmpty(params) {
    return Object.fromEntries(
        Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== "")
    );
}