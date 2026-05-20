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

    const IMAGE_BASE = "https://image.tmdb.org/t/p/w780";
    const BACKDROP_BASE = "https://image.tmdb.org/t/p/original";

    const FALLBACK_POSTER =
        "https://via.placeholder.com/500x750?text=BrasilFLIX";

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

    // ==========================================
    // ELEMENTOS (SEGUROS)
    // ==========================================

    const catalogNode = $("bf-catalog");
    const homeMoviesNode = $("bf-home-movies");
    const homeSeriesNode = $("bf-home-series");

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
                `https://myembed.biz/filme/${id}`,
                `https://vidsrc.xyz/embed/movie/${id}`,
                `https://www.2embed.cc/embed/${id}`,
                `https://multiembed.mov/?video_id=${id}&tmdb=1`,
                `https://player.autoembed.cc/embed/movie/${id}`,
                `https://embed.su/embed/movie/${id}`,
                `https://vidsrc.to/embed/movie/${id}`,
                `https://embedplayapi.top/embed/${id}`,
                
            ];
        }

        return [
            `https://vidsrc.to/embed/tv/${id}/1/1`,
            `https://vidsrc.xyz/embed/tv/${id}/1/1`,
            `https://www.2embed.cc/embedtv/${id}`,
            `https://multiembed.mov/directstream.php?video_id=${id}&tmdb=1`,
            `https://player.autoembed.cc/embed/tv/${id}/1/1`,
            `https://embed.su/embed/tv/${id}/1/1`
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
    // SEARCH (CORRIGIDO)
    // ==========================================

    function setupSearch() {

        if (!titleInput) return;

        titleInput.addEventListener("input", function () {

            clearTimeout(state.searchTimer);

            state.searchTimer = setTimeout(function () {

                state.searchQuery = titleInput.value.trim();

                if (state.searchQuery) {
                    searchCatalog();
                } else {
                    if (state.pageType === "home") {
                        loadHomePage();
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
                searchCatalog();
            });
        }
    }

    // ==========================================
    // INFINITE SCROLL
    // ==========================================

    function setupInfiniteScroll() {

        window.addEventListener("scroll", function () {

            if (
                state.loading ||
                state.reachedEnd ||
                state.searchQuery ||
                state.pageType === "home" ||
                state.pageType === "detalhes"
            ) return;

            const nearBottom =
                window.innerHeight + window.scrollY >=
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

        showMessage("Carregando catálogo...", false);

        const movies = await collectPages("/api/popular?type=movie", INITIAL_HOME_PAGES);
        const series = await collectPages("/api/trending?type=tv", INITIAL_HOME_PAGES);

        renderCards(homeMoviesNode, movies.slice(0, 80), "movie");
        renderCards(homeSeriesNode, series.slice(0, 80), "tv");

        showMessage("Catálogo carregado.", false);
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

        showMessage("Carregando...", false);

        const endpoint =
            state.pageType === "categorias"
                ? "/api/trending"
                : "/api/popular";

        const url =
            `${endpoint}?type=${state.currentMedia}&page=${state.currentPage}`;

        const data = await apiGet(url);

        const results = normalizeResults(data.results || [], state.currentMedia);

        appendCards(catalogNode, results, state.currentMedia);

        state.reachedEnd =
            state.currentPage >= Math.min(data.total_pages || MAX_AUTO_PAGES, MAX_AUTO_PAGES);

        state.currentPage++;
        state.loading = false;

        showMessage("Catálogo carregado.", false);
    }

    // ==========================================
    // SEARCH CATALOG
    // ==========================================

    async function searchCatalog() {

        const media = mediaForPage();
        const query = encodeURIComponent(state.searchQuery);

        const year =
            yearInput && yearInput.value
                ? `&year=${encodeURIComponent(yearInput.value)}`
                : "";

        const data = await apiGet(`/api/search?type=${media}&query=${query}${year}`);

        const results = normalizeResults(data.results || [], media);

        renderCards(catalogNode, results, media);

        showMessage(`${results.length} resultado(s)`, false);
    }

    // ==========================================
    // DETALHES
    // ==========================================

    async function loadDetailsPage() {

        const params = new URLSearchParams(window.location.search);

        const media = normalizeMedia(params.get("media") || "movie");
        const id = params.get("id");

        if (!id || !detailNode) {
            renderError("Título não encontrado.");
            return;
        }

        const details = await apiGet(`/api/details/${media}/${id}`);

        if (details.error) {
            renderError("Erro ao carregar.");
            return;
        }

        renderDetails(details, media);
        renderRelated(details, media);
    }

    // ==========================================
    // RENDER DETAILS
    // ==========================================

    function renderDetails(item, media) {

        const title = item.title || item.name || "Título";
        const poster = posterUrl(item.poster_path);
        const backdrop = backdropUrl(item.backdrop_path || item.poster_path);

        const genres = (item.genres || []).map(g => g.name).join(", ");
        const embedUrls = embedsFor(media, item.id);

        detailNode.innerHTML = `
            <section class="bf-detail-hero section-text-white">

                <div class="bf-detail-backdrop" style="background-image:url('${backdrop}')"></div>

                <div class="container bf-detail-layout">

                    <div class="bf-detail-poster" style="background-image:url('${poster}')"></div>

                    <div class="bf-detail-copy">

                        <h1>${escapeHtml(title)}</h1>

                        <div class="bf-detail-meta">
                            ${escapeHtml(genres)}
                        </div>

                        <p>
                            ${escapeHtml(item.overview || "Sinopse indisponível.")}
                        </p>

                        <a class="btn btn-theme" href="#player">Assistir</a>

                    </div>

                </div>

            </section>

            ${renderPlayer(embedUrls)}
        `;
    }

    // ==========================================
    // PLAYER
    // ==========================================

    function renderPlayer(embedUrls) {

        if (!embedUrls.length) {
            return `<section class="bf-player-section"><div class="container"><h3>Player indisponível</h3></div></section>`;
        }

        const buttons = embedUrls.map((url, i) => `
            <button class="bf-filter ${i === 0 ? "active" : ""}" data-embed-url="${url}">
                Player ${i + 1}
            </button>
        `).join("");

        return `
            <section id="player" class="bf-player-section section-long">

                <div class="container">

                    <div class="bf-filter-row">
                        ${buttons}
                    </div>

                    <div class="bf-player-shell">

                        <iframe id="bf-detail-player"
                            src="${embedUrls[0]}"
                            width="100%" height="100%"
                            frameborder="0"
                            allowfullscreen>
                        </iframe>

                    </div>

                </div>

            </section>
        `;
    }

    // ==========================================
    // PLAYER SWITCH
    // ==========================================

    document.addEventListener("click", function (event) {

        const option = event.target.closest("[data-embed-url]");
        if (!option) return;

        const iframe = $("bf-detail-player");
        if (!iframe) return;

        document.querySelectorAll("[data-embed-url]").forEach(b => b.classList.remove("active"));

        option.classList.add("active");
        iframe.src = option.getAttribute("data-embed-url");
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
        return String(v || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    async function apiGet(url) {

        try {

            let fullUrl = url;

            if (!url.startsWith("http")) {
                fullUrl = "http://localhost:3000" + url;
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