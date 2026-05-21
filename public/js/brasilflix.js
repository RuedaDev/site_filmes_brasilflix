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
    const INITIAL_HOME_PAGES = 1;

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
        searchTimer: null,
        animeGenre: "all",
        animeSeason: "",
        desenhosType: "series",
        desenhosCountry: ""
    };

    // Flag para evitar renderização dupla
    let detailsRendered = false;

    // ==========================================
    // ELEMENTOS (SEGUROS)
    // ==========================================

    const catalogNode =
        $("bf-catalog") ||
        $("bf-dorama-catalog") ||
        $("bf-anime-catalog") ||
        $("catalog-grid");
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

    function embedsFor(media, id, details = null) {
    media = media === "tv" ? "tv" : "movie";

    // Obtém o IMDb ID, se disponível
    const imdbId = details?.external_ids?.imdb_id || null;

    if (media === "movie") {
        const urls = [
            `https://vidsrc.me/embed/movie?tmdb=${id}`,
            `https://vidlink.pro/movie/${id}`,
           // `https://embed.su/embed/movie/${id}`,
           // `https://vidsrc.icu/embed/movie/${id}`,
            `https://autoembed.co/movie/tmdb/${id}`,
            `https://vidsrc.xyz/embed/movie/${id}`,
            `https://www.2embed.cc/embed/${id}`,
            `https://betterflix.click/api/player?id=${id}&type=movie`,
            `https://embedplayapi.top/embed/${id}`,
            `https://myembed.biz/filme/${id}`,
            `https://superflixapi.best/filme/${id}#noLink#color:ff0000`,
        ];

        // Adiciona SuperFlixAPI com IMDb ID (preferencial) ou TMDB ID
        const superflixUrl = imdbId 
            ? `https://superflixapi.best/filme/${imdbId}#noLink#color:ff0000`
            : `https://superflixapi.best/filme/${id}#noLink#color:ff0000`;
        urls.unshift(superflixUrl); // coloca como primeira opção

        return urls;
    }

    // Para séries/doramas/animes
    const urls = [
        `https://vidsrc.me/embed/tv?tmdb=${id}&season=1&episode=1`,
        `https://vidlink.pro/tv/${id}/1/1`,
       // `https://embed.su/embed/tv/${id}/1/1`,
       // `https://vidsrc.icu/embed/tv/${id}/1/1`,
        `https://autoembed.co/tv/tmdb/${id}/1/1`,
       // `https://vidsrc.xyz/embed/tv/${id}/1/1`,
        `https://myembed.biz/serie/${id}/1/1`,
        `https://embedplayapi.top/embed/${id}/1/1`,
        `https://betterflix.click/api/player?id=${id}&type=tv&season=1&episode=1`,
        `https://superflixapi.best/serie/${id}/1/1#noEpList#noLink`,
    ];

    const superflixUrl = `https://superflixapi.best/serie/${id}/1/1#noEpList#noLink`;
    urls.unshift(superflixUrl);

    return urls;
}

    // ==========================================
    // INIT
    // ==========================================

    document.addEventListener("DOMContentLoaded", function () {
        console.log("🚀 BrasilFLIX carregado");

        setupSearch();
        setupInfiniteScroll();
        setupPageUi();

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
                    searchHome();
                } else {
                    if (state.pageType === "animes") updateAnimeSectionTitle();
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
                if (state.pageType === "animes") updateAnimeSectionTitle();
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
        if (!catalogNode) return;

        window.addEventListener("scroll", function () {
            if (state.loading || state.reachedEnd || state.searchQuery ||
                state.pageType === "home" || state.pageType === "detalhes" || state.pageType === "categorias") return;

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

        const url = catalogListUrl();
        const data = await apiGet(url);
        const results = filterCatalogResults(
            normalizeResults(data.results || [], state.currentMedia)
        );

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
        let data;

        if (state.pageType === "doramas") {
            data = await apiGet(`/api/doramas/search?query=${query}`);
        } else if (state.pageType === "animes") {
            data = await apiGet(`/api/animes/search?query=${query}`);
        } else if (state.pageType === "desenhos") {
            const type = state.desenhosType === "movies" ? "movie" : "tv";
            data = await apiGet(`/api/desenhos/search?query=${query}&type=${type}`);
        } else {
            const year = yearInput && yearInput.value ? `&year=${encodeURIComponent(yearInput.value)}` : "";
            data = await apiGet(`/api/search?type=${media}&query=${query}${year}`);
        }

        const results = filterCatalogResults(normalizeResults(data.results || [], media));
        state.reachedEnd = true;
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

        if (window.BFUpdatePageMeta) {
            const displayTitle = details.title || details.name || "Título";
            const overview = details.overview || "Assista online no BrasilFLIX.";
            const poster = posterUrl(details.poster_path);
            window.BFUpdatePageMeta({
                title: `${displayTitle} — Assistir Online | BrasilFLIX`,
                description: overview.length > 160 ? overview.slice(0, 157) + "..." : overview,
                image: poster
            });
            var canonical = document.querySelector('link[rel="canonical"]');
            if (canonical) {
                canonical.setAttribute("href", `/detalhes.html?id=${id}&media=${media}`);
            }

            var oldLd = document.getElementById("bf-structured-data");
            if (oldLd) oldLd.remove();
            var ld = document.createElement("script");
            ld.id = "bf-structured-data";
            ld.type = "application/ld+json";
            ld.textContent = JSON.stringify({
                "@context": "https://schema.org",
                "@type": media === "movie" ? "Movie" : "TVSeries",
                "name": displayTitle,
                "description": overview,
                "image": poster,
                "url": `${window.location.origin}/detalhes.html?id=${id}&media=${media}`
            });
            document.head.appendChild(ld);
        }
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
        setTimeout(setupPlayerControls, 0);
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
                            width="100%"
                            frameborder="0" allowfullscreen
                            >
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
                        width="100%"
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
        return;
    }

    if (seasonSelect.dataset.bfControlsReady === '1') {
        return;
    }
    seasonSelect.dataset.bfControlsReady = '1';

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
    // HELPERS
    // ==========================================

    function mediaForPage() {
        if (state.pageType === "desenhos") {
            return state.desenhosType === "movies" ? "movie" : "tv";
        }
        return ["series", "animes", "doramas"].includes(state.pageType) ? "tv" : "movie";
    }

    function catalogListUrl() {
        const page = state.currentPage;

        if (state.pageType === "doramas") {
            return `/api/doramas/popular?page=${page}`;
        }

        if (state.pageType === "animes") {
            if (state.animeGenre && state.animeGenre !== "all") {
                const params = new URLSearchParams({
                    type: "tv",
                    page: String(page),
                    sort_by: "popularity.desc",
                    genre: `16,${state.animeGenre}`,
                    language: "ja",
                    "vote_count.gte": "5"
                });
                return `/api/discover?${params.toString()}`;
            }
            return `/api/animes/popular?page=${page}`;
        }

        if (state.pageType === "desenhos") {
            const kind = state.desenhosType === "movies" ? "filmes" : "series";
            let url = `/api/desenhos/${kind}?page=${page}`;
            if (state.desenhosCountry) {
                url += `&country=${encodeURIComponent(state.desenhosCountry)}`;
            }
            return url;
        }

        const endpoint = state.pageType === "categorias" ? "/api/trending" : "/api/popular";
        return `${endpoint}?type=${mediaForPage()}&page=${page}`;
    }

    function filterCatalogResults(results) {
        if (state.pageType === "animes" && state.animeSeason) {
            const months = {
                winter: [12, 1, 2],
                spring: [3, 4, 5],
                summer: [6, 7, 8],
                fall: [9, 10, 11]
            };
            const allowed = months[state.animeSeason] || [];
            return results.filter(item => {
                const date = item.first_air_date || item.release_date || "";
                if (!date) return false;
                const month = parseInt(date.split("-")[1], 10);
                return allowed.includes(month);
            });
        }
        return results;
    }

    function setupPageUi() {
        if (state.pageType === "desenhos") {
            document.querySelectorAll(".tab-btn").forEach(btn => {
                btn.addEventListener("click", function () {
                    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
                    this.classList.add("active");
                    state.desenhosType = this.dataset.type === "movies" ? "movies" : "series";
                    state.searchQuery = "";
                    if (titleInput) titleInput.value = "";
                    loadCatalogPage(true);
                });
            });
        }

        if (state.pageType === "animes") {
            document.querySelectorAll(".genre-btn").forEach(btn => {
                btn.addEventListener("click", function () {
                    document.querySelectorAll(".genre-btn").forEach(b => b.classList.remove("active"));
                    this.classList.add("active");
                    state.animeGenre = this.dataset.genre || "all";
                    state.animeSeason = "";
                    state.searchQuery = "";
                    document.querySelectorAll(".season-badge").forEach(b => { b.style.opacity = "0.6"; });
                    if (titleInput) titleInput.value = "";
                    updateAnimeSectionTitle();
                    loadCatalogPage(true);
                });
            });

            document.querySelectorAll(".season-badge").forEach(badge => {
                badge.addEventListener("click", function () {
                    document.querySelectorAll(".season-badge").forEach(b => { b.style.opacity = "0.6"; });
                    this.style.opacity = "1";
                    state.animeSeason = this.dataset.season || "";
                    state.animeGenre = "all";
                    document.querySelectorAll(".genre-btn").forEach(b => b.classList.remove("active"));
                    const allBtn = document.querySelector('.genre-btn[data-genre="all"]');
                    if (allBtn) allBtn.classList.add("active");
                    state.searchQuery = "";
                    if (titleInput) titleInput.value = "";
                    updateAnimeSectionTitle();
                    loadCatalogPage(true);
                });
            });
        }
    }

    function updateAnimeSectionTitle() {
        const titleNode = $("section-title");
        if (!titleNode) return;
        const seasonNames = {
            winter: "Inverno",
            spring: "Primavera",
            summer: "Verão",
            fall: "Outono"
        };
        if (state.animeSeason) {
            titleNode.textContent = `📺 Animes — Temporada de ${seasonNames[state.animeSeason] || state.animeSeason}`;
            return;
        }
        if (state.animeGenre && state.animeGenre !== "all") {
            const active = document.querySelector(".genre-btn.active");
            titleNode.textContent = active ? `📺 ${active.textContent.trim()}` : "📺 Animes";
            return;
        }
        if (state.searchQuery) {
            titleNode.textContent = `🔍 Resultados para: "${state.searchQuery}"`;
            return;
        }
        titleNode.textContent = "📺 Animes Populares";
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
            <article class="bf-card" data-bf-id="${item.id}" data-bf-media="${media}">
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