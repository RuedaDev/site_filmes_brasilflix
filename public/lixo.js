// BrasilFLIX backend completo com autenticação
const path = require("path");
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Database = require("better-sqlite3");
const cookieParser = require('cookie-parser');
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

// Cria tabelas e colunas (is_premium, phone)
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);
try { db.exec(`ALTER TABLE users ADD COLUMN is_premium INTEGER DEFAULT 0`); } catch (e) {}
try { db.exec(`ALTER TABLE users ADD COLUMN phone TEXT`); } catch (e) {}
try {
    db.exec(`ALTER TABLE users ADD COLUMN premium_activated_at DATETIME`);
} catch (e) { /* coluna já existe */ }
db.exec(`
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
app.use(cookieParser());
app.get("/", (req, res) => res.sendFile(path.join(PUBLIC_DIR, "homepage-1.html")));
// Middleware para detectar usuário premium via cookie
app.use((req, res, next) => {
    const token = req.cookies?.token;
    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.isPremium = decoded.is_premium === 1;
        } catch (e) {
            req.isPremium = false;
        }
    } else {
        req.isPremium = false;
    }
    next();
});
// CSP permissivo
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

// ==================== FUNÇÕES AUXILIARES ====================
function authenticateToken(req, res, next) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Token não fornecido" });
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: "Token inválido" });
        req.user = user;
        next();
    });
}

function authenticateAdmin(req, res, next) {
    const { key } = req.query;
    if (!key || key !== process.env.ADMIN_KEY) {
        return res.status(403).json({ error: "Acesso negado. Chave admin inválida." });
    }
    next();
}

async function tmdbRequest(endpoint, params = {}) {
    if (!process.env.TMDB_KEY) return { error: "TMDB_KEY não configurada" };
    try {
        const response = await axios.get(`${TMDB_BASE_URL}${endpoint}`, {
            params: { api_key: TMDB_KEY, language: "pt-BR", ...params },
            timeout: 12000
        });
        return response.data;
    } catch (error) {
        console.error(`❌ Erro TMDB: ${endpoint}`);
        return { error: "tmdb_request_failed" };
    }
}

function sendTmdbResult(res, data) {
    if (data && data.error) return res.status(500).json(data);
    res.json(data);
}

function normalizeMedia(type) {
    return (type === "tv" || type === "series") ? "tv" : "movie";
}

function normalizePage(page) {
    const value = Number(page || 1);
    if (!Number.isFinite(value) || value < 1) return 1;
    return Math.min(value, 500);
}

// ==================== AUTENTICAÇÃO ====================
app.post("/api/auth/register", async (req, res) => {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password || !phone) {
        return res.status(400).json({ error: "Todos os campos são obrigatórios (nome, email, senha, telefone)" });
    }
    if (password.length < 6) return res.status(400).json({ error: "A senha deve ter pelo menos 6 caracteres" });
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 11) {
        return res.status(400).json({ error: "Telefone inválido. Use DDD + número (ex: 11988887777)" });
    }
    try {
        const exists = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
        if (exists) return res.status(400).json({ error: "Email já cadastrado" });
        const hash = await bcrypt.hash(password, 10);
        const result = db.prepare("INSERT INTO users (name, email, password, phone) VALUES (?,?,?,?)").run(name, email, hash, cleanPhone);
        const token = jwt.sign({ id: result.lastInsertRowid, name, email, is_premium: 0 }, JWT_SECRET, { expiresIn: "30d" });
        // Após gerar o token JWT
        res.cookie('token', token, {
            httpOnly: true,
            secure: false, // true em produção com HTTPS
            maxAge: 30 * 24 * 60 * 60 * 1000 // 30 dias
        });
        res.status(201).json({
            message: "Conta criada!",
            token,
            user: { id: result.lastInsertRowid, name, email, phone: cleanPhone, is_premium: 0 }
        });
    } catch (e) { res.status(500).json({ error: "Erro no registro" }); }
});

app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
        if (!user || !(await bcrypt.compare(password, user.password)))
            return res.status(401).json({ error: "Email ou senha incorretos" });
        const token = jwt.sign(
            { id: user.id, name: user.name, email: user.email, is_premium: user.is_premium || 0 },
            JWT_SECRET, { expiresIn: "30d" }
        );
        // Após gerar o token JWT
    res.cookie('token', token, {
        httpOnly: true,
        secure: false, // true em produção com HTTPS
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 dias
    });
        res.json({ message: "OK", token, user: { id: user.id, name: user.name, email: user.email, is_premium: user.is_premium || 0 } });
    } catch (e) { res.status(500).json({ error: "Erro no login" }); }
});

app.get("/api/auth/profile", authenticateToken, (req, res) => {
    console.log("📥 [PERFIL] Requisição recebida para usuário ID:", req.user.id);
    
    try {
        const user = db.prepare(`
            SELECT id, name, email, phone, is_premium, premium_expires_at, created_at
            FROM users WHERE id = ?
        `).get(req.user.id);
        
        if (!user) {
            console.log("❌ [PERFIL] Usuário não encontrado");
            return res.status(404).json({ error: "Usuário não encontrado" });
        }

        // Verifica e corrige expiração do premium
        const now = new Date();
        const expiresAt = user.premium_expires_at ? new Date(user.premium_expires_at) : null;
        if (user.is_premium && expiresAt && expiresAt < now) {
            console.log("⏰ [PERFIL] Premium expirado, removendo...");
            db.prepare("UPDATE users SET is_premium = 0, premium_expires_at = NULL WHERE id = ?").run(user.id);
            user.is_premium = 0;
            user.premium_expires_at = null;
        }

        const daysRemaining = user.is_premium && expiresAt
            ? Math.max(0, Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24)))
            : 0;

        const favoritesCount = db.prepare("SELECT COUNT(*) as count FROM favorites WHERE user_id = ?").get(user.id).count;
        const historyCount = db.prepare("SELECT COUNT(*) as count FROM history WHERE user_id = ?").get(user.id).count;

        const responseData = {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            is_premium: user.is_premium,
            premium_expires_at: user.premium_expires_at,
            created_at: user.created_at,
            daysRemaining,
            favoritesCount,
            historyCount
        };

        console.log("✅ [PERFIL] Dados retornados com sucesso");
        res.json(responseData);
    } catch (error) {
        console.error("💥 [PERFIL] Erro interno:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
});

// ==================== ADMIN (antes do fallback) ====================
app.get("/admin", (req, res) => res.sendFile(path.join(PUBLIC_DIR, "admin.html")));

app.get("/api/admin/dashboard", authenticateAdmin, (req, res) => {
    try {
        res.json({
            totalUsers: db.prepare("SELECT COUNT(*) as c FROM users").get().c,
            premiumUsers: db.prepare("SELECT COUNT(*) as c FROM users WHERE is_premium = 1").get().c,
            totalFavorites: db.prepare("SELECT COUNT(*) as c FROM favorites").get().c,
            totalHistory: db.prepare("SELECT COUNT(*) as c FROM history").get().c
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/admin/users", authenticateAdmin, (req, res) => {
    const users = db.prepare(`
        SELECT u.id, u.name, u.email, u.phone, u.is_premium, u.created_at,
               COUNT(DISTINCT f.id) as favorites_count,
               COUNT(DISTINCT h.id) as history_count
        FROM users u
        LEFT JOIN favorites f ON u.id = f.user_id
        LEFT JOIN history h ON u.id = h.user_id
        GROUP BY u.id
        ORDER BY u.created_at DESC
    `).all();
    res.json(users);
});
app.get("/api/auth/profile", authenticateToken, (req, res) => {
    console.log("📥 [PERFIL] ID:", req.user.id);
    
    try {
        // Obtém todos os dados do usuário de forma segura
        const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
        if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

        // Garante valores padrão para colunas que podem não existir
        const isPremium = (user.is_premium !== undefined) ? user.is_premium : 0;
        const premiumExpiresAt = user.premium_expires_at || null;
        const phone = user.phone || null;

        // Verifica expiração do premium
        let finalIsPremium = isPremium;
        let finalExpiresAt = premiumExpiresAt;
        const now = new Date();
        if (isPremium && premiumExpiresAt) {
            const expires = new Date(premiumExpiresAt);
            if (expires < now) {
                db.prepare("UPDATE users SET is_premium = 0, premium_expires_at = NULL WHERE id = ?").run(user.id);
                finalIsPremium = 0;
                finalExpiresAt = null;
            }
        }

        const daysRemaining = finalIsPremium && finalExpiresAt
            ? Math.max(0, Math.ceil((new Date(finalExpiresAt) - now) / (1000 * 60 * 60 * 24)))
            : 0;

        const favoritesCount = db.prepare("SELECT COUNT(*) as count FROM favorites WHERE user_id = ?").get(user.id).count;
        const historyCount = db.prepare("SELECT COUNT(*) as count FROM history WHERE user_id = ?").get(user.id).count;

        res.json({
            id: user.id,
            name: user.name,
            email: user.email,
            phone: phone,
            is_premium: finalIsPremium,
            premium_expires_at: finalExpiresAt,
            created_at: user.created_at,
            daysRemaining,
            favoritesCount,
            historyCount
        });
    } catch (error) {
        console.error("💥 [PERFIL] Erro:", error.message);
        res.status(500).json({ error: "Erro interno: " + error.message });
    }
});
app.post("/api/admin/toggle-premium/:userId", authenticateAdmin, (req, res) => {
    const userId = req.params.userId;
    const user = db.prepare("SELECT is_premium, premium_expires_at FROM users WHERE id = ?").get(userId);
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

    const newStatus = user.is_premium ? 0 : 1;
    const expiresAt = newStatus === 1 
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()  // 30 dias a partir de agora
        : null;

    db.prepare("UPDATE users SET is_premium = ?, premium_expires_at = ? WHERE id = ?")
        .run(newStatus, expiresAt, userId);

    res.json({ 
        message: `Premium ${newStatus ? 'ativado' : 'desativado'}!`,
        is_premium: newStatus,
        premium_expires_at: expiresAt
    });
});
// ==================== ROTAS TMDB COMPLETAS ====================

// Health
app.get("/api/health", (req, res) => res.json({ ok: true }));

// Popular
app.get("/api/popular", async (req, res) => {
    const data = await tmdbRequest(`/${normalizeMedia(req.query.type)}/popular`, { page: normalizePage(req.query.page) });
    sendTmdbResult(res, data);
});

// Top rated
app.get("/api/top", async (req, res) => {
    const media = normalizeMedia(req.query.type || "movie");
    const data = await tmdbRequest(`/${media}/top_rated`, { page: normalizePage(req.query.page) });
    sendTmdbResult(res, data);
});

// Trending
app.get("/api/trending", async (req, res) => {
    const media = normalizeMedia(req.query.type || "movie");
    const data = await tmdbRequest(`/trending/${media}/week`, { page: normalizePage(req.query.page) });
    sendTmdbResult(res, data);
});

// Discover
app.get("/api/discover", async (req, res) => {
    const media = normalizeMedia(req.query.type || "movie");
    const params = {
        page: normalizePage(req.query.page),
        sort_by: req.query.sort_by || "popularity.desc",
        with_genres: req.query.genre || undefined,
        primary_release_year: req.query.year || undefined,
        first_air_date_year: req.query.year || undefined
    };
    if (req.query.language) params.with_original_language = req.query.language;
    if (req.query.with_origin_country) params.with_origin_country = req.query.with_origin_country;
    if (req.query.region) params.region = req.query.region;
    if (req.query['vote_count.gte']) params['vote_count.gte'] = req.query['vote_count.gte'];
    const data = await tmdbRequest(`/discover/${media}`, params);
    sendTmdbResult(res, data);
});

// Search
app.get("/api/search", async (req, res) => {
    const query = (req.query.query || "").trim();
    if (!query) return res.json({ page: 1, results: [], total_pages: 0, total_results: 0 });
    const media = normalizeMedia(req.query.type || "movie");
    const data = await tmdbRequest(`/search/${media}`, { query, page: normalizePage(req.query.page), include_adult: false });
    sendTmdbResult(res, data);
});

// Details
app.get("/api/details/:type/:id", async (req, res) => {
    const media = normalizeMedia(req.params.type);
    const id = (req.params.id || "").replace(/\D/g, "");
    if (!id) return res.status(400).json({ error: "ID inválido" });
    const data = await tmdbRequest(`/${media}/${id}`, { append_to_response: "videos,credits,recommendations,similar,external_ids" });
    sendTmdbResult(res, data);
});

// ==================== DORAMAS ====================
app.get("/api/doramas/popular", async (req, res) => {
    const page = normalizePage(req.query.page);
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
    const query = (req.query.query || "").trim();
    if (!query) return res.json({ results: [] });
    const data = await tmdbRequest("/search/tv", { query, include_adult: false });
    if (data.results) data.results = data.results.filter(item => ["ko","ja","zh","th"].includes(item.original_language));
    sendTmdbResult(res, data);
});

// ==================== ANIMES ====================
app.get("/api/animes/popular", async (req, res) => {
    const page = normalizePage(req.query.page);
    const data = await tmdbRequest("/discover/tv", {
        page,
        sort_by: "popularity.desc",
        with_genres: "16",
        with_original_language: "ja",
        "vote_count.gte": 10
    });
    sendTmdbResult(res, data);
});

app.get("/api/animes/search", async (req, res) => {
    const query = (req.query.query || "").trim();
    if (!query) return res.json({ results: [] });
    const data = await tmdbRequest("/search/tv", { query, include_adult: false });
    if (data.results) data.results = data.results.filter(item => item.genre_ids && item.genre_ids.includes(16) && item.original_language === "ja");
    sendTmdbResult(res, data);
});

// ==================== DESENHOS ====================
app.get("/api/desenhos/series", async (req, res) => {
    const page = normalizePage(req.query.page);
    const country = req.query.country;
    const params = {
        page,
        sort_by: "popularity.desc",
        with_genres: "16",
        without_original_language: "ja",
        "vote_count.gte": 5
    };
    if (country) params.with_origin_country = country;
    const data = await tmdbRequest("/discover/tv", params);
    sendTmdbResult(res, data);
});

app.get("/api/desenhos/filmes", async (req, res) => {
    const page = normalizePage(req.query.page);
    const country = req.query.country;
    const params = {
        page,
        sort_by: "popularity.desc",
        with_genres: "16",
        without_original_language: "ja",
        "vote_count.gte": 5
    };
    if (country) params.region = country;
    const data = await tmdbRequest("/discover/movie", params);
    sendTmdbResult(res, data);
});

app.get("/api/desenhos/search", async (req, res) => {
    const query = (req.query.query || "").trim();
    if (!query) return res.json({ results: [] });
    const type = req.query.type === "movie" ? "movie" : "tv";
    const data = await tmdbRequest(`/search/${type}`, { query, include_adult: false });
    if (data.results) data.results = data.results.filter(item => item.genre_ids && item.genre_ids.includes(16) && item.original_language !== "ja");
    sendTmdbResult(res, data);
});

// ==================== GÊNEROS ====================
app.get("/api/genres/:type", async (req, res) => {
    const media = normalizeMedia(req.params.type);
    const data = await tmdbRequest(`/genre/${media}/list`, { language: "pt-BR" });
    sendTmdbResult(res, data);
});

app.get("/api/genre/:type/:genreId", async (req, res) => {
    const media = normalizeMedia(req.params.type);
    const page = normalizePage(req.query.page);
    const data = await tmdbRequest(`/discover/${media}`, {
        page,
        sort_by: req.query.sort_by || "popularity.desc",
        with_genres: req.params.genreId,
        "vote_count.gte": 5
    });
    sendTmdbResult(res, data);
});

// ==================== TRAILERS ====================
app.get("/api/trailers/:type/:id", async (req, res) => {
    const media = normalizeMedia(req.params.type);
    const data = await tmdbRequest(`/${media}/${req.params.id}/videos`, { language: "pt-BR" });
    sendTmdbResult(res, data);
});

// ==================== FAVORITOS / HISTÓRICO (usuário logado) ====================
app.post("/api/favorites", authenticateToken, (req, res) => {
    const { tmdb_id, title, poster_path, media_type } = req.body;
    try {
        db.prepare("INSERT OR IGNORE INTO favorites (user_id, tmdb_id, title, poster_path, media_type) VALUES (?,?,?,?,?)")
            .run(req.user.id, tmdb_id, title, poster_path, media_type || "movie");
        res.json({ message: "Adicionado" });
    } catch (e) { res.status(500).json({ error: "Erro" }); }
});

app.get("/api/favorites", authenticateToken, (req, res) => {
    const list = db.prepare("SELECT * FROM favorites WHERE user_id = ? ORDER BY added_at DESC").all(req.user.id);
    res.json(list);
});

app.delete("/api/favorites/:tmdb_id", authenticateToken, (req, res) => {
    db.prepare("DELETE FROM favorites WHERE user_id = ? AND tmdb_id = ?").run(req.user.id, req.params.tmdb_id);
    res.json({ message: "Removido" });
});

app.post("/api/history", authenticateToken, (req, res) => {
    const { tmdb_id, title, poster_path, media_type } = req.body;
    db.prepare("INSERT INTO history (user_id, tmdb_id, title, poster_path, media_type) VALUES (?,?,?,?,?)")
        .run(req.user.id, tmdb_id, title, poster_path, media_type || "movie");
    res.json({ message: "OK" });
});

app.get("/api/history", authenticateToken, (req, res) => {
    const list = db.prepare("SELECT * FROM history WHERE user_id = ? ORDER BY watched_at DESC LIMIT 50").all(req.user.id);
    res.json(list);
});

app.get("/api/user/stats", authenticateToken, (req, res) => {
    const favs = db.prepare("SELECT COUNT(*) as c FROM favorites WHERE user_id = ?").get(req.user.id).c;
    const hist = db.prepare("SELECT COUNT(*) as c FROM history WHERE user_id = ?").get(req.user.id).c;
    const user = db.prepare("SELECT name, email, created_at FROM users WHERE id = ?").get(req.user.id);
    res.json({ ...user, favoritesCount: favs, historyCount: hist });
});
// Excluir usuário (admin)
app.delete("/api/admin/users/:userId", authenticateAdmin, (req, res) => {
    const userId = req.params.userId;
    const user = db.prepare("SELECT id FROM users WHERE id = ?").get(userId);
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
    
    db.prepare("DELETE FROM favorites WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM history WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM users WHERE id = ?").run(userId);
    
    res.json({ message: "Usuário excluído com sucesso!" });
});

// Pesquisar usuários (admin)
app.get("/api/admin/users/search", authenticateAdmin, (req, res) => {
    const { q } = req.query;
    if (!q || q.trim().length === 0) {
        return res.json([]);
    }
    const term = `%${q.trim()}%`;
    const users = db.prepare(`
        SELECT u.id, u.name, u.email, u.phone, u.is_premium, u.created_at,
               COUNT(DISTINCT f.id) as favorites_count,
               COUNT(DISTINCT h.id) as history_count
        FROM users u
        LEFT JOIN favorites f ON u.id = f.user_id
        LEFT JOIN history h ON u.id = h.user_id
        WHERE u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?
        GROUP BY u.id
        ORDER BY u.created_at DESC
        LIMIT 50
    `).all(term, term, term);
    res.json(users);
});
// ==================== FALLBACK SPA (deve ser a última rota) ====================
app.use((req, res) => res.sendFile(path.join(PUBLIC_DIR, "homepage-1.html")));

// ==================== INICIAR SERVIDOR ====================
app.listen(PORT, () => {
    console.log(`✅ BrasilFLIX online em http://localhost:${PORT}`);
    console.log(`🔑 Admin: http://localhost:${PORT}/admin`);
});