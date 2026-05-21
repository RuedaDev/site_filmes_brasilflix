(function () {
    "use strict";

    // ==========================================
    // DEBUG INICIAL
    // ==========================================

    window.__BRFLIX_LOADED__ = true;
    console.log("INICIO OK");

    // ==========================================
    // HELPERS
    // ==========================================

    function $(id) {
        return document.getElementById(id);
    }

    // ==========================================
    // CONFIGURAÇÕES
    // ==========================================

    const IMAGE_BASE = "https://image.tmdb.org/t/p/w342";
    const BACKDROP_BASE = "https://image.tmdb.org/t/p/w780";
    const FALLBACK_POSTER = "https://via.placeholder.com/500x750?text=BrasilFLIX";
    const MAX_AUTO_PAGES = 50;
    const INITIAL_HOME_PAGES = 8;

    // ==========================================
    // ESTADO
    // ==========================================

    const state = {
        pageType: document.body.getAttribute("data-bf-page") || "home",
        currentMedia: "movie",
        currentPage: 1,
        loading: false,
        reachedEnd: false,
        searchQuery: "",
        searchTimer: null
    };

    // Flag para evitar renderização dupla
    let detailsRendered = false;

    // ==========================================
    // ELEMENTOS (SEGUROS)
    // ==========================================

    const catalogNode = $("bf-catalog");
    const homeMoviesNode = $("bf-home-movies");
    const homeSeriesNode = $("bf-home-series");
    const homeAnimesNode = $("bf-home-animes");
    const homeDoramasNode = $("bf-home-doramas");
    const titleForm = $("bf-title-form");
    const titleInput = $("bf-title-input");
    const yearInput = $("bf-year-input");
    const messageNode = $("bf-message");
    const detailNode = $("bf-detail");
    const relatedNode = $("bf-related");

    // ==========================================
    // EMBEDS
    // ==========================================

    function embedsFor(media, id) {
        media = media === "tv" ? "tv" : "movie";

        if (media === "movie") {
            return [
                `https://vidsrc.me/embed/movie?tmdb=${id}`,
                `https://vidlink.pro/movie/${id}`,
                `https://embed.su/embed/movie/${id}`,
                `https://vidsrc.icu/embed/movie/${id}`,
                `https://autoembed.co/movie/tmdb/${id}`,
                `https://vidsrc.xyz/embed/movie/${id}`,
                `https://www.2embed.cc/embed/${id}`,
                `https://multiembed.mov/?video_id=${id}&tmdb=1`,
                `https://embedplayapi.top/embed/${id}`,
                `https://myembed.biz/filme/${id}`,
                `https://superflixapi.best/filme/${id}`,
            ];
        }

        return [
            `https://vidsrc.me/embed/tv?tmdb=${id}&season=1&episode=1`,
            `https://myembed.biz/serie/${id}/1/1`,
            `https://embedplayapi.top/embed/${id}/1/1`,
            `https://vidlink.pro/tv/${id}/1/1`,
            `https://embed.su/embed/tv/${id}/1/1`,
            `https://vidsrc.icu/embed/tv/${id}/1/1`,
            `https://autoembed.co/tv/tmdb/${id}/1/1`,
            `https://vidsrc.xyz/embed/tv/${id}/1/1`,
            `https://www.2embed.cc/embedtv/${id}&s=1&e=1`,
            `https://multiembed.mov/directstream.php?video_id=${id}&tmdb=1&s=1&e=1`,
            `https://superflixapi.best/serie/${id}/1/1`
        ];
    }

    // ==========================================
    // INIT
    // ==========================================

    document.addEventListener("DOMContentLoaded", function () {
        console.log("🚀 BrasilFLIX carregado");

        setupSearch();
        setupInfiniteScroll();

        if (state.pageType === "detalhes") {
            loadDetailsPage();
            return;
        }

        if (state.pageType === "home") {
            loadHomePage();
            return;
        }

        loadCatalogPage(true);
    });

    // ==========================================
    // SEARCH
    // ==========================================

    function setupSearch() {
    if (!titleInput) return;

    titleInput.addEventListener("input", function () {
        clearTimeout(state.searchTimer);
        state.searchTimer = setTimeout(function () {
            state.searchQuery = titleInput.value.trim();
            if (state.searchQuery) {
                if (state.pageType === "home") {
                    searchHome(); // nova função
                } else {
                    searchCatalog();
                }
            } else {
                if (state.pageType === "home") {
                    const resultsDiv = document.getElementById('bf-search-results');
                    if (resultsDiv) resultsDiv.style.display = 'none';
                    showMessage("Digite um titulo ou explore as secoes abaixo.");
                } else {
                    loadCatalogPage(true);
                }
            }
        }, 400);
    });

    if (titleForm) {
        titleForm.addEventListener("submit", function (e) {
            e.preventDefault();
            state.searchQuery = titleInput ? titleInput.value.trim() : "";
            if (state.pageType === "home") {
                searchHome();
            } else {
                searchCatalog();
            }
        });
    }
    }
    async function searchHome() {
    const query = encodeURIComponent(state.searchQuery);
    const media = "movie"; // pode buscar ambos, mas vamos simplificar
    const year = yearInput && yearInput.value ? `&year=${encodeURIComponent(yearInput.value)}` : "";
    const data = await apiGet(`/api/search?type=${media}&query=${query}${year}`);
    const results = (data.results || []).slice(0, 10); // limita a 10 resultados
    const container = document.getElementById('bf-search-results');
    if (!container) return;

    if (results.length === 0) {
        container.innerHTML = '<p class="text-white text-center">Nenhum resultado encontrado.</p>';
        container.style.display = 'block';
        showMessage("Nenhum resultado encontrado.");
        return;
    }

    container.innerHTML = results.map(item => {
        const title = item.title || item.name || 'Sem título';
        const poster = posterUrl(item.poster_path);
        const overview = item.overview ? item.overview.substring(0, 150) + '...' : 'Sinopse indisponível.';
        return `
            <div class="row mb-4 p-3" style="background:rgba(0,0,0,0.6); border-radius:10px;">
                <div class="col-md-3">
                    <img src="${poster}" class="img-fluid rounded" style="max-height:200px;" onerror="this.src='${FALLBACK_POSTER}'">
                </div>
                <div class="col-md-9">
                    <h4 class="text-white">${escapeHtml(title)}</h4>
                    <p class="text-muted">${escapeHtml(overview)}</p>
                    <a href="detalhes.html?id=${item.id}&media=${media}" class="btn btn-theme btn-sm">▶ Assistir</a>
                </div>
            </div>
        `;
    }).join('');
    container.style.display = 'block';
    showMessage(`${results.length} resultado(s)`);
}
    // ==========================================
    // INFINITE SCROLL
    // ==========================================

    function setupInfiniteScroll() {
        window.addEventListener("scroll", function () {
            if (state.loading || state.reachedEnd || state.searchQuery || 
                state.pageType === "home" || state.pageType === "detalhes") return;

            const nearBottom = window.innerHeight + window.scrollY >= 
                document.body.offsetHeight - 600;

            if (nearBottom) {
                loadCatalogPage(false);
            }
        });
    }

    // ==========================================
    // HOME
    // ==========================================

     async function loadHomePage() {
    showMessage("Carregando catálogo...");

    const movies = await collectPages("/api/popular?type=movie", INITIAL_HOME_PAGES);
    const series = await collectPages("/api/trending?type=tv", INITIAL_HOME_PAGES);

    renderCards(homeMoviesNode, movies.slice(0, 8), "movie");
    renderCards(homeSeriesNode, series.slice(0, 8), "tv");

    // Animes
    try {
        const animesData = await apiGet("/api/animes/popular?page=1");
        const animes = animesData.results || [];
        renderCards(homeAnimesNode, animes.slice(0, 8), "tv");
    } catch (e) {
        homeAnimesNode.innerHTML = "<p>Animes indisponíveis.</p>";
    }

    // Doramas
    try {
        const doramasData = await apiGet("/api/doramas/popular?page=1");
        const doramas = doramasData.results || [];
        renderCards(homeDoramasNode, doramas.slice(0, 8), "tv");
    } catch (e) {
        homeDoramasNode.innerHTML = "<p>Doramas indisponíveis.</p>";
    }

    showMessage("Catálogo carregado.");
    }
    // ==========================================
    // CATALOGO
    // ==========================================

    async function loadCatalogPage(reset = false) {
        if (!catalogNode) return;

        if (reset) {
            catalogNode.innerHTML = "";
            state.currentPage = 1;
            state.reachedEnd = false;
        }

        state.loading = true;
        state.currentMedia = mediaForPage();
        showMessage("Carregando...");

        const endpoint = state.pageType === "categorias" ? "/api/trending" : "/api/popular";
        const url = `${endpoint}?type=${state.currentMedia}&page=${state.currentPage}`;
        const data = await apiGet(url);
        const results = normalizeResults(data.results || [], state.currentMedia);

        appendCards(catalogNode, results, state.currentMedia);
        state.reachedEnd = state.currentPage >= Math.min(data.total_pages || MAX_AUTO_PAGES, MAX_AUTO_PAGES);
        state.currentPage++;
        state.loading = false;
        showMessage("");
    }

    // ==========================================
    // SEARCH CATALOG
    // ==========================================

    async function searchCatalog() {
        const media = mediaForPage();
        const query = encodeURIComponent(state.searchQuery);
        const year = yearInput && yearInput.value ? `&year=${encodeURIComponent(yearInput.value)}` : "";
        const data = await apiGet(`/api/search?type=${media}&query=${query}${year}`);
        const results = normalizeResults(data.results || [], media);
        renderCards(catalogNode, results, media);
        showMessage(`${results.length} resultado(s)`);
    }

    // ==========================================
    // DETALHES
    // ==========================================

    async function loadDetailsPage() {
        // Evita execução múltipla
        if (detailsRendered) {
            console.log('⏳ Detalhes já carregados, ignorando...');
            return;
        }

        const params = new URLSearchParams(window.location.search);
        const media = normalizeMedia(params.get("media") || "movie");
        const id = params.get("id");

        if (!id || !detailNode) {
            renderError("Título não encontrado.");
            return;
        }

        console.log('🔍 Carregando detalhes:', { media, id });

        const details = await apiGet(`/api/details/${media}/${id}`);

        if (details.error) {
            renderError("Erro ao carregar.");
            return;
        }

        detailsRendered = true;
        renderDetails(details, media);
        renderRelated(details, media);
        
        // Inicializa os players após um pequeno delay
        setTimeout(initPlayers, 300);
    }

    // ==========================================
    // RENDER DETAILS
    // ==========================================

    function renderDetails(item, media) {
        const title = item.title || item.name || "Título";
        const poster = posterUrl(item.poster_path);
        const backdrop = backdropUrl(item.backdrop_path || item.poster_path);
        const genres = (item.genres || []).map(g => g.name).join(", ");
        const seasons = item.seasons || [];
        const totalSeasons = item.number_of_seasons || 0;
        const totalEpisodes = item.number_of_episodes || 0;
        const lastEpisode = item.last_episode_to_air;

        console.log("🎬 Renderizando:", title, "| T", totalSeasons, "| E", totalEpisodes);

        detailNode.innerHTML = `
            <section class="bf-detail-hero section-text-white">
                <div class="bf-detail-backdrop" style="background-image:url('${backdrop}')"></div>
                <div class="container bf-detail-layout">
                    <div class="bf-detail-poster" style="background-image:url('${poster}')"></div>
                    <div class="bf-detail-copy">
                        <span class="bf-kicker text-uppercase">${media === "tv" ? "Série" : "Filme"}</span>
                        <h1>${escapeHtml(title)}</h1>
                        <div class="bf-detail-meta">
                            ${escapeHtml(genres)}
                            ${totalSeasons > 0 ? ` | ${totalSeasons} Temporada(s)` : ''}
                            ${totalEpisodes > 0 ? ` | ${totalEpisodes} Episódios` : ''}
                        </div>
                        <p>${escapeHtml(item.overview || "Sinopse indisponível.")}</p>
                        ${lastEpisode ? `
                            <div style="margin:10px 0;padding:10px;background:rgba(255,255,255,0.1);border-radius:5px;border-left:3px solid #007bff;">
                                <small>📺 Último episódio: ${escapeHtml(lastEpisode.name || '')} (T${lastEpisode.season_number}E${lastEpisode.episode_number})</small>
                            </div>
                        ` : ''}
                        
                    </div>
                </div>
            </section>
        `;

        // Adiciona o player
        const playerHTML = renderPlayer(media, item.id, seasons, totalSeasons);
        detailNode.insertAdjacentHTML('afterend', playerHTML);
    }

    // ==========================================
    // RENDER PLAYER
    // ==========================================

    // ==========================================
// RENDER PLAYER (CORRIGIDO)
// ==========================================

function renderPlayer(media, id, seasons, totalSeasons) {
    const isMovie = media === "movie";
    const embedUrls = embedsFor(media, id);

    // PARA FILMES: Player simples
    if (isMovie) {
        return `
            <section id="player" class="bf-player-section section-long">
                <div class="container">
                    <div class="bf-filter-row" id="player-buttons">
                        ${embedUrls.map((url, i) => `
                            <button class="bf-filter ${i === 0 ? 'active' : ''}" 
                                    data-embed-url="${url}">
                                Player ${i + 1}
                            </button>
                        `).join('')}
                    </div>
                    <div class="bf-player-shell">
                        <iframe id="bf-detail-player" 
                            src="${embedUrls[0]}" 
                            width="100%" height="450px" 
                            frameborder="0" allowfullscreen
                            sandbox="allow-scripts allow-same-origin allow-forms allow-popups>
                        </iframe>
                    </div>
                </div>
            </section>
        `;
    }

    // PARA SÉRIES/DORAMAS/ANIMES: Player com seletores
    const validSeasons = (seasons || []).filter(s => s.season_number > 0 && s.episode_count > 0);
    const seasonsList = validSeasons.length > 0 ? validSeasons : 
        Array.from({ length: totalSeasons || 1 }, (_, i) => ({
            season_number: i + 1,
            episode_count: 12,
            name: `Temporada ${i + 1}`
        }));

    const seasonOptions = seasonsList.map((s, i) => `
        <option value="${s.season_number}" data-episodes="${s.episode_count || 12}" ${i === 0 ? 'selected' : ''}>
            T${s.season_number} - ${escapeHtml(s.name || `Temporada ${s.season_number}`)} (${s.episode_count || 12} eps)
        </option>
    `).join('');

    const firstEpisodes = seasonsList[0]?.episode_count || 12;
    
    const episodeOptions = Array.from({ length: firstEpisodes }, (_, i) => `
        <option value="${i + 1}" ${i === 0 ? 'selected' : ''}>
            Episódio ${i + 1}
        </option>
    `).join('');

    // Gera URLs dos players com temporada 1, episódio 1
    const firstSeason = 1;
    const firstEpisode = 1;
    
    const playerButtonsHTML = embedUrls.map((url, i) => {
        let finalUrl = url;
        // Ajusta a URL para a primeira temporada/episódio
        finalUrl = finalUrl
            .replace(/season=\d+/g, `season=${firstSeason}`)
            .replace(/episode=\d+/g, `episode=${firstEpisode}`)
            .replace(/&s=\d+/g, `&s=${firstSeason}`)
            .replace(/&e=\d+/g, `&e=${firstEpisode}`)
            .replace(/\/\d+\/\d+$/g, `/${firstSeason}/${firstEpisode}`)
            .replace(/\/\d+\/\d+\//g, `/${firstSeason}/${firstEpisode}/`);
        
        return `
            <button class="bf-filter ${i === 0 ? 'active' : ''}" 
                    data-embed-url="${finalUrl}"
                    data-base-url="${url}">
                Player ${i + 1}
            </button>
        `;
    }).join('');

    // Primeiro player ativo
    let firstPlayerUrl = embedUrls[0];
    firstPlayerUrl = firstPlayerUrl
        .replace(/season=\d+/g, `season=${firstSeason}`)
        .replace(/episode=\d+/g, `episode=${firstEpisode}`)
        .replace(/&s=\d+/g, `&s=${firstSeason}`)
        .replace(/&e=\d+/g, `&e=${firstEpisode}`)
        .replace(/\/\d+\/\d+$/g, `/${firstSeason}/${firstEpisode}`)
        .replace(/\/\d+\/\d+\//g, `/${firstSeason}/${firstEpisode}/`);

    return `
        <section id="player" class="bf-player-section section-long">
            <div class="container">
                <!-- Seletor de Temporada e Episódio -->
                <div class="bf-season-controls" style="background:rgba(0,0,0,0.7); padding:20px; border-radius:10px; margin-bottom:20px; border:1px solid rgba(255,255,255,0.1);">
                    <div class="row">
                        <div class="col-md-6 mb-3">
                            <label style="color:white; font-weight:bold; display:block; margin-bottom:5px;">📺 Temporada</label>
                            <select id="season-select" style="background:#1a1a1a; color:white; border:1px solid #444; padding:10px; border-radius:5px; width:100%; cursor:pointer;">
                                ${seasonOptions}
                            </select>
                        </div>
                        <div class="col-md-6 mb-3">
                            <label style="color:white; font-weight:bold; display:block; margin-bottom:5px;">🎬 Episódio</label>
                            <select id="episode-select" style="background:#1a1a1a; color:white; border:1px solid #444; padding:10px; border-radius:5px; width:100%; cursor:pointer;">
                                ${episodeOptions}
                            </select>
                        </div>
                    </div>
                </div>

                <!-- Botões dos Players -->
                <div class="bf-filter-row" id="player-buttons">
                    ${playerButtonsHTML}
                </div>

                <!-- Iframe do Player -->
                <div class="bf-player-shell">
                    <iframe id="bf-detail-player" 
                        src="${firstPlayerUrl}" 
                        width="100%" height="450px" 
                        frameborder="0" allowfullscreen
                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups">
                    </iframe>
                </div>
            </div>
        </section>
    `;
}

// ==========================================
// INICIALIZAR CONTROLES (EXECUTA APÓS RENDER)
// ==========================================

function setupPlayerControls() {
    const seasonSelect = document.getElementById('season-select');
    const episodeSelect = document.getElementById('episode-select');
    
    if (!seasonSelect || !episodeSelect) {
        // Se não encontrou, é um filme (não precisa de controles)
        return;
    }

    console.log('🎮 Configurando controles de temporada/episódio');

    // Criar mapa: temporada -> número de episódios
    const seasonEpisodes = {};
    seasonSelect.querySelectorAll('option').forEach(opt => {
        seasonEpisodes[opt.value] = parseInt(opt.getAttribute('data-episodes')) || 12;
    });

    // Evento: mudar temporada
    seasonSelect.addEventListener('change', function() {
        const selSeason = this.value;
        const numEpisodes = seasonEpisodes[selSeason] || 12;

        // Atualiza dropdown de episódios
        episodeSelect.innerHTML = Array.from({ length: numEpisodes }, (_, i) => 
            `<option value="${i + 1}">Episódio ${i + 1}</option>`
        ).join('');

        // Atualiza os players
        updateAllPlayers();
    });

    // Evento: mudar episódio
    episodeSelect.addEventListener('change', function() {
        updateAllPlayers();
    });

    console.log('✅ Controles configurados');
}

// Atualiza todas as URLs dos players e o iframe
function updateAllPlayers() {
    const seasonSelect = document.getElementById('season-select');
    const episodeSelect = document.getElementById('episode-select');
    const iframe = document.getElementById('bf-detail-player');
    const allButtons = document.querySelectorAll('#player-buttons .bf-filter');

    if (!seasonSelect || !episodeSelect || !iframe) return;

    const season = seasonSelect.value;
    const episode = episodeSelect.value;

    console.log(`🔄 Atualizando players: T${season}E${episode}`);

    // Atualiza cada botão
    allButtons.forEach(btn => {
        const baseUrl = btn.getAttribute('data-base-url');
        if (!baseUrl) return;

        let newUrl = baseUrl
            .replace(/season=\d+/g, `season=${season}`)
            .replace(/episode=\d+/g, `episode=${episode}`)
            .replace(/&s=\d+/g, `&s=${season}`)
            .replace(/&e=\d+/g, `&e=${episode}`)
            .replace(/\/\d+\/\d+$/g, `/${season}/${episode}`)
            .replace(/\/\d+\/\d+\//g, `/${season}/${episode}/`);

        btn.setAttribute('data-embed-url', newUrl);
    });

    // Atualiza o iframe com o player ativo
    const activeBtn = document.querySelector('#player-buttons .bf-filter.active');
    if (activeBtn) {
        const activeUrl = activeBtn.getAttribute('data-embed-url');
        iframe.src = activeUrl;
        console.log('🎬 Player atualizado:', activeUrl);
    }
}

// ==========================================
// PLAYER SWITCH (CLIQUE NOS BOTÕES)
// ==========================================

document.addEventListener("click", function (event) {
    const option = event.target.closest("#player-buttons .bf-filter");
    if (!option) return;

    const iframe = document.getElementById("bf-detail-player");
    if (!iframe) return;

    // Remove active de todos
    document.querySelectorAll("#player-buttons .bf-filter").forEach(b => 
        b.classList.remove("active")
    );
    
    // Adiciona active no clicado
    option.classList.add("active");

    // Atualiza iframe
    const newUrl = option.getAttribute("data-embed-url");
    if (newUrl) {
        console.log("🔄 Trocando player:", newUrl);
        iframe.src = newUrl;
    }
});

// ==========================================
// SOBRESCREVE RENDER DETAILS (ADICIONA SETUP)
// ==========================================

const originalRenderDetails = renderDetails;
renderDetails = function(item, media) {
    originalRenderDetails(item, media);
    // Aguarda o DOM atualizar e configura os controles
    setTimeout(setupPlayerControls, 200);
};
    // ==========================================
    // INICIALIZAR PLAYERS
    // ==========================================

    function initPlayers() {
        const playerButtons = document.getElementById('player-buttons');
        const iframe = document.getElementById('bf-detail-player');
        const seasonSelect = document.getElementById('season-select');
        const episodeSelect = document.getElementById('episode-select');

        if (!playerButtons || !iframe) {
            console.log('⏳ Aguardando player...');
            setTimeout(initPlayers, 500);
            return;
        }

        // Se já tem botões, não recria
        if (playerButtons.children.length > 0) {
            console.log('✅ Players já inicializados');
            return;
        }

        const params = new URLSearchParams(window.location.search);
        const id = params.get('id');
        const media = params.get('media') || 'movie';
        const season = seasonSelect?.value || 1;
        const episode = episodeSelect?.value || 1;

        console.log('🎬 Inicializando players:', { media, id, season, episode });

        const embedUrls = embedsFor(media, id);

        // Renderiza botões
        playerButtons.innerHTML = embedUrls.map((url, i) => {
            let finalUrl = url;
            if (media === 'tv') {
                finalUrl = url
                    .replace(/season=\d+/g, `season=${season}`)
                    .replace(/episode=\d+/g, `episode=${episode}`)
                    .replace(/&s=\d+/g, `&s=${season}`)
                    .replace(/&e=\d+/g, `&e=${episode}`)
                    .replace(/\/\d+\/\d+$/g, `/${season}/${episode}`);
            }
            return `<button class="bf-filter ${i === 0 ? 'active' : ''}" data-embed-url="${finalUrl}">Player ${i + 1}</button>`;
        }).join('');

        // Define primeiro player
        if (embedUrls.length > 0) {
            let firstUrl = embedUrls[0];
            if (media === 'tv') {
                firstUrl = firstUrl
                    .replace(/season=\d+/g, `season=${season}`)
                    .replace(/episode=\d+/g, `episode=${episode}`)
                    .replace(/&s=\d+/g, `&s=${season}`)
                    .replace(/&e=\d+/g, `&e=${episode}`)
                    .replace(/\/\d+\/\d+$/g, `/${season}/${episode}`);
            }
            iframe.src = firstUrl;
            console.log('🎬 Player inicial:', firstUrl);
        }

        // Configura eventos de temporada/episódio
        setupSeasonControls(media, id);
        console.log('✅ Players inicializados');
    }

    // ==========================================
    // CONTROLES DE TEMPORADA/EPISÓDIO
    // ==========================================

    function setupSeasonControls(media, id) {
        const seasonSelect = document.getElementById('season-select');
        const episodeSelect = document.getElementById('episode-select');

        if (!seasonSelect || !episodeSelect) return;

        // Mapeia temporadas -> episódios
        const seasonEpisodes = {};
        seasonSelect.querySelectorAll('option').forEach(opt => {
            seasonEpisodes[opt.value] = parseInt(opt.getAttribute('data-episodes')) || 12;
        });

        seasonSelect.addEventListener('change', function() {
            const selSeason = this.value;
            const episodes = seasonEpisodes[selSeason] || 12;

            episodeSelect.innerHTML = Array.from({ length: episodes }, (_, i) =>
                `<option value="${i + 1}">Episódio ${i + 1}</option>`
            ).join('');

            updatePlayerUrls(media, id);
        });

        episodeSelect.addEventListener('change', function() {
            updatePlayerUrls(media, id);
        });
    }

    function updatePlayerUrls(media, id) {
        const season = document.getElementById('season-select')?.value || 1;
        const episode = document.getElementById('episode-select')?.value || 1;
        const iframe = document.getElementById('bf-detail-player');
        const buttons = document.querySelectorAll('#player-buttons .bf-filter');

        if (!iframe || !buttons.length) return;

        const embedUrls = embedsFor(media, id);

        buttons.forEach((btn, i) => {
            let url = embedUrls[i] || embedUrls[0];
            url = url.replace(/season=\d+/g, `season=${season}`)
                     .replace(/episode=\d+/g, `episode=${episode}`)
                     .replace(/&s=\d+/g, `&s=${season}`)
                     .replace(/&e=\d+/g, `&e=${episode}`)
                     .replace(/\/\d+\/\d+$/g, `/${season}/${episode}`);
            btn.setAttribute('data-embed-url', url);
        });

        const activeBtn = document.querySelector('#player-buttons .bf-filter.active');
        if (activeBtn) {
            iframe.src = activeBtn.getAttribute('data-embed-url');
        }
    }

    // ==========================================
    // PLAYER SWITCH
    // ==========================================

    document.addEventListener("click", function (event) {
        const option = event.target.closest("[data-embed-url]");
        if (!option) return;

        const iframe = document.getElementById("bf-detail-player");
        if (!iframe) return;

        document.querySelectorAll("#player-buttons .bf-filter").forEach(b => b.classList.remove("active"));
        option.classList.add("active");

        const newUrl = option.getAttribute("data-embed-url");
        console.log("🔄 Trocando player:", newUrl);
        iframe.src = newUrl;
    });

    // ==========================================
    // HELPERS
    // ==========================================

    function mediaForPage() {
        return ["series", "animes", "doramas"].includes(state.pageType) ? "tv" : "movie";
    }

    function normalizeMedia(m) {
        return m === "tv" || m === "series" ? "tv" : "movie";
    }

    function normalizeResults(results, media) {
        return (results || []).filter(i =>
            i && i.id && i.poster_path &&
            (i.media_type ? normalizeMedia(i.media_type) === media : true)
        );
    }

    function posterUrl(path) {
        return path ? IMAGE_BASE + path : FALLBACK_POSTER;
    }

    function backdropUrl(path) {
        return path ? BACKDROP_BASE + path : FALLBACK_POSTER;
    }

    function showMessage(text) {
        if (!messageNode) return;
        messageNode.textContent = text;
    }

    function renderError(text) {
        if (!detailNode) return;
        detailNode.innerHTML = `<div class="container"><p>${escapeHtml(text)}</p></div>`;
    }

    function escapeHtml(v) {
        return String(v || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    async function apiGet(url) {
        try {
            let fullUrl = url;
            if (!url.startsWith("http")) {
                fullUrl = window.location.origin + url;
    }
            const res = await fetch(fullUrl);
            if (!res.ok) return { results: [], error: true };
            return await res.json();
        } catch (e) {
            return { results: [], error: true };
        }
    }

    function renderCards(node, items, media) {
        if (!node) return;
        node.innerHTML = items.map(i => renderCard(i, media)).join("");
    }

    function appendCards(node, items, media) {
        if (!node) return;
        node.insertAdjacentHTML("beforeend", items.map(i => renderCard(i, media)).join(""));
    }

    function renderCard(item, media) {
        const title = item.title || item.name || "Título";
        const poster = posterUrl(item.poster_path);
        return `
            <article class="bf-card">
                <div class="bf-card-poster" style="background-image:url('${poster}')">
                    <a class="bf-card-info-link" href="detalhes.html?id=${item.id}&media=${media}"></a>
                </div>
                <div class="bf-card-body">
                    <h3>${escapeHtml(title)}</h3>
                    <a class="btn btn-theme" href="detalhes.html?id=${item.id}&media=${media}">Assistir</a>
                </div>
            </article>
        `;
    }

    function collectPages(endpoint, pages) {
        let all = [];
        return (async () => {
            for (let i = 1; i <= pages; i++) {
                const sep = endpoint.includes("?") ? "&" : "?";
                const data = await apiGet(`${endpoint}${sep}page=${i}`);
                all = all.concat(data.results || []);
            }
            return all;
        })();
    }

    // ==========================================
    // DEBUG FINAL
    // ==========================================

    console.log("🚀 BrasilFLIX iniciado");
    window.state = state;
    window.embedsFor = embedsFor;
    console.log("CHEGOU NO FINAL DO SCRIPT");
    window.__BRFLIX_DONE__ = true;

})();