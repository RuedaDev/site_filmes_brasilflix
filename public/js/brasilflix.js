(function () {
    "use strict";

    // Configuracoes gerais do catalogo automatico.
    var IMAGE_BASE = "https://image.tmdb.org/t/p/w780";
    var FALLBACK_POSTER = "";
    var MAX_AUTO_PAGES = 50;
    var INITIAL_HOME_PAGES = 2;

    // Cadastre aqui apenas embeds que voce tem autorizacao para usar.
    // A chave usa o formato "movie:693134" ou "tv:1399".
    var manualEmbeds = {
        "movie:693134": ["https://myembed.biz/filme/693134"]
    };

    // Estado da aplicacao.
    var state = {
        pageType: document.body.getAttribute("data-bf-page") || "home",
        currentMedia: "movie",
        currentPage: 1,
        loading: false,
        reachedEnd: false,
        searchQuery: "",
        searchTimer: null
    };

    // Elementos existentes do layout atual.
    var catalogNode = document.getElementById("bf-catalog");
    var homeMoviesNode = document.getElementById("bf-home-movies");
    var homeSeriesNode = document.getElementById("bf-home-series");
    var titleForm = document.getElementById("bf-title-form");
    var titleInput = document.getElementById("bf-title-input");
    var yearInput = document.getElementById("bf-year-input");
    var messageNode = document.getElementById("bf-message");
    var detailNode = document.getElementById("bf-detail");
    var relatedNode = document.getElementById("bf-related");

    // Inicializacao principal.
    document.addEventListener("DOMContentLoaded", function () {
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

    // Liga busca em tempo real e submit manual.
    function setupSearch() {
        if (!titleInput) {
            return;
        }

        titleInput.addEventListener("input", function () {
            clearTimeout(state.searchTimer);
            state.searchTimer = setTimeout(function () {
                state.searchQuery = titleInput.value.trim();
                if (state.searchQuery) {
                    searchCatalog();
                } else if (state.pageType === "home") {
                    loadHomePage();
                } else {
                    loadCatalogPage(true);
                }
            }, 350);
        });

        if (titleForm) {
            titleForm.addEventListener("submit", function (event) {
                event.preventDefault();
                state.searchQuery = titleInput.value.trim();
                if (state.searchQuery) {
                    searchCatalog();
                }
            });
        }
    }

    // Carregamento infinito para paginas de catalogo.
    function setupInfiniteScroll() {
        window.addEventListener("scroll", function () {
            if (state.pageType === "home" || state.pageType === "detalhes" || state.searchQuery) {
                return;
            }

            var nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 600;
            if (nearBottom && !state.loading && !state.reachedEnd) {
                loadCatalogPage(false);
            }
        });
    }

    // Home com blocos separados de filmes e series.
    async function loadHomePage() {
        showMessage("Carregando destaques do TMDB...", false);

        var movies = await collectPages("/api/popular?type=movie", INITIAL_HOME_PAGES);
        var series = await collectPages("/api/trending?type=tv", INITIAL_HOME_PAGES);

        renderCards(homeMoviesNode, movies.slice(0, 12), "movie");
        renderCards(homeSeriesNode, series.slice(0, 12), "tv");
        if (catalogNode) {
            catalogNode.innerHTML = "";
        }

        showMessage("Destaques carregados.", false);
    }

    // Paginas de filmes, series e categorias.
    async function loadCatalogPage(reset) {
        if (!catalogNode) {
            return;
        }

        if (reset) {
            state.currentPage = 1;
            state.reachedEnd = false;
            catalogNode.innerHTML = "";
        }

        state.loading = true;
        state.currentMedia = mediaForPage();
        showMessage("Carregando catalogo automatico...", false);

        var endpoint = state.pageType === "categorias" ? "/api/trending" : "/api/popular";
        var url = endpoint + "?type=" + state.currentMedia + "&page=" + state.currentPage;
        var data = await apiGet(url);
        var results = normalizeResults(data.results || [], state.currentMedia);

        appendCards(catalogNode, results, state.currentMedia);

        state.reachedEnd = state.currentPage >= Math.min(data.total_pages || MAX_AUTO_PAGES, MAX_AUTO_PAGES);
        state.currentPage += 1;
        state.loading = false;

        showMessage("Catalogo automatico carregado.", false);
    }

    // Busca no TMDB usando o backend.
    async function searchCatalog() {
        var media = mediaForPage();
        var query = encodeURIComponent(state.searchQuery);
        var year = yearInput && yearInput.value ? "&year=" + encodeURIComponent(yearInput.value) : "";
        var data = await apiGet("/api/search?type=" + media + "&query=" + query + year);
        var results = normalizeResults(data.results || [], media);

        if (state.pageType === "home") {
            if (homeMoviesNode) {
                homeMoviesNode.innerHTML = "";
            }
            if (homeSeriesNode) {
                homeSeriesNode.innerHTML = "";
            }
        }

        renderCards(catalogNode || homeMoviesNode, results, media);
        showMessage(results.length + " resultado(s) encontrados.", false);
    }

    // Pagina de detalhes com sinopse, relacionados e player.
    async function loadDetailsPage() {
        var params = new URLSearchParams(window.location.search);
        var media = params.get("media") || params.get("type") || "movie";
        var id = params.get("id") || params.get("tmdbId");

        media = normalizeMedia(media);

        if (!id || !detailNode) {
            renderError("Titulo nao encontrado.");
            return;
        }

        var details = await apiGet("/api/details/" + media + "/" + encodeURIComponent(id));

        if (details.error) {
            renderError("Nao foi possivel carregar os detalhes.");
            return;
        }

        renderDetails(details, media);
        renderRelated(details, media);
    }

    // Renderiza a area principal de detalhes.
    function renderDetails(item, media) {
        var title = item.title || item.name || "Titulo";
        var year = extractYear(item);
        var genres = (item.genres || []).map(function (genre) { return genre.name; }).join(", ");
        var poster = posterUrl(item.poster_path);
        var backdrop = backdropUrl(item.backdrop_path || item.poster_path);
        var embedUrls = embedsFor(media, item.id);
        var playerHtml = embedUrls.length ? renderPlayer(title, embedUrls) : renderPlayerMissing();

        document.title = title + " - BrasilFLIX";

        detailNode.innerHTML = [
            '<section class="bf-detail-hero section-text-white">',
                '<div class="bf-detail-backdrop" style="background-image: url(\'' + backdrop + '\')"></div>',
                '<div class="container bf-detail-layout">',
                    '<div class="bf-detail-poster" style="background-image: url(\'' + poster + '\')"></div>',
                    '<div class="bf-detail-copy">',
                        '<span class="bf-kicker text-uppercase">' + escapeHtml(media === "tv" ? "Series" : "Filmes") + '</span>',
                        '<h1>' + escapeHtml(title) + '</h1>',
                        '<div class="bf-detail-meta">' + escapeHtml([year, genres, formatRating(item.vote_average)].filter(Boolean).join(" / ")) + '</div>',
                        '<p id="bf-detail-overview">' + escapeHtml(item.overview || "Sinopse em breve.") + '</p>',
                        '<div class="bf-detail-actions">',
                            '<a class="btn btn-theme" href="#player"><i class="fas fa-play"></i>&nbsp;&nbsp;Assistir agora</a>',
                            '<a class="btn btn-outline-light" href="' + (media === "tv" ? "series.html" : "filmes.html") + '"><i class="fas fa-th-large"></i>&nbsp;&nbsp;Voltar ao catalogo</a>',
                        '</div>',
                    '</div>',
                '</div>',
            '</section>',
            playerHtml
        ].join("");
    }

    // Player com fallback manual/autorizado.
    function renderPlayer(title, embedUrls) {
        var options = embedUrls.map(function (url, index) {
            return '<button class="bf-filter' + (index === 0 ? " active" : "") + '" type="button" data-embed-url="' + escapeAttr(url) + '">Player ' + (index + 1) + '</button>';
        }).join("");

        return [
            '<section id="player" class="bf-player-section section-long">',
                '<div class="container">',
                    '<div class="bf-section-head">',
                        '<span class="bf-kicker text-uppercase">Assistindo</span>',
                        '<h2 class="section-title text-uppercase">' + escapeHtml(title) + '</h2>',
                    '</div>',
                    '<div class="bf-filter-row" id="bf-embed-options">' + options + '</div>',
                    '<div class="bf-player-shell">',
                        '<iframe id="bf-detail-player" title="Player ' + escapeAttr(title) + '" src="' + escapeAttr(embedUrls[0]) + '" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>',
                    '</div>',
                '</div>',
            '</section>'
        ].join("");
    }

    // Aviso quando ainda nao existe embed cadastrado.
    function renderPlayerMissing() {
        return [
            '<section id="player" class="bf-player-section section-long">',
                '<div class="container">',
                    '<div class="bf-control-panel">',
                        '<h3>Player em breve</h3>',
                        '<p class="bf-panel-copy">Este titulo foi carregado automaticamente do TMDB. Cadastre embeds autorizados em manualEmbeds para liberar o player.</p>',
                    '</div>',
                '</div>',
            '</section>'
        ].join("");
    }

    // Relacionados vindos do TMDB.
    function renderRelated(item, media) {
        if (!relatedNode) {
            return;
        }

        var related = [];
        if (item.recommendations && Array.isArray(item.recommendations.results)) {
            related = item.recommendations.results;
        }
        if (!related.length && item.similar && Array.isArray(item.similar.results)) {
            related = item.similar.results;
        }

        relatedNode.innerHTML = [
            '<section class="bf-catalog-section section-long section-text-white">',
                '<div class="container">',
                    '<div class="bf-section-head">',
                        '<span class="bf-kicker text-uppercase">Relacionados</span>',
                        '<h2 class="section-title text-uppercase">Voce tambem pode gostar</h2>',
                    '</div>',
                    '<div class="bf-catalog-grid">',
                        renderCardList(normalizeResults(related.slice(0, 12), media), media),
                    '</div>',
                '</div>',
            '</section>'
        ].join("");
    }

    // Renderiza cards em um node, substituindo o conteudo.
    function renderCards(node, items, media) {
        if (!node) {
            return;
        }
        node.innerHTML = renderCardList(items, media);
    }

    // Adiciona cards ao final para infinite scroll.
    function appendCards(node, items, media) {
        if (!node) {
            return;
        }
        node.insertAdjacentHTML("beforeend", renderCardList(items, media));
    }

    // Converte uma lista de filmes/series em HTML.
    function renderCardList(items, media) {
        if (!items.length) {
            return '<p class="bf-empty">Nenhum titulo encontrado.</p>';
        }
        return items.map(function (item) {
            return renderCard(item, media);
        }).join("");
    }

    // Card com poster, titulo, nota, ano, hover e botao assistir.
    function renderCard(item, media) {
        var title = item.title || item.name || "Titulo";
        var poster = posterUrl(item.poster_path);
        var year = extractYear(item);
        var rating = formatRating(item.vote_average);
        var detailUrl = "detalhes.html?id=" + encodeURIComponent(item.id) + "&media=" + media + "&watch=1#player";

        return [
            '<article class="bf-card">',
                '<div class="bf-card-poster" style="background-image: url(\'' + poster + '\')">',
                    '<a class="bf-card-info-link" href="' + detailUrl + '" aria-label="Ver detalhes de ' + escapeAttr(title) + '"></a>',
                    '<a class="bf-card-play" href="' + detailUrl + '" aria-label="Assistir ' + escapeAttr(title) + '"><i class="fas fa-play"></i></a>',
                '</div>',
                '<div class="bf-card-body">',
                    '<h3 class="bf-card-title"><a href="' + detailUrl + '">' + escapeHtml(title) + '</a></h3>',
                    '<div class="bf-card-meta">' + escapeHtml([year, rating].filter(Boolean).join(" / ")) + '</div>',
                    '<a class="btn btn-theme bf-card-button" href="' + detailUrl + '"><i class="fas fa-play"></i>&nbsp;&nbsp;Assistir</a>',
                '</div>',
            '</article>'
        ].join("");
    }

    // Alterna entre embeds cadastrados para o mesmo titulo.
    document.addEventListener("click", function (event) {
        var option = event.target.closest("[data-embed-url]");
        if (!option) {
            return;
        }

        var iframe = document.getElementById("bf-detail-player");
        if (!iframe) {
            return;
        }

        document.querySelectorAll("[data-embed-url]").forEach(function (button) {
            button.classList.remove("active");
        });
        option.classList.add("active");
        iframe.src = option.getAttribute("data-embed-url");
    });

    // Coleta varias paginas do mesmo endpoint.
    async function collectPages(endpoint, pages) {
        var allResults = [];
        for (var page = 1; page <= pages; page++) {
            var separator = endpoint.indexOf("?") === -1 ? "?" : "&";
            var data = await apiGet(endpoint + separator + "page=" + page);
            allResults = allResults.concat(data.results || []);
        }
        return normalizeResults(allResults, endpoint.indexOf("type=tv") !== -1 ? "tv" : "movie");
    }

    // Chamada padrao ao backend.
    async function apiGet(url) {
        try {
            var response = await fetch(url);
            if (!response.ok) {
                return { results: [], error: true };
            }
            return response.json();
        } catch (error) {
            showMessage("Nao foi possivel conectar ao backend. Rode node server.js.", true);
            return { results: [], error: true };
        }
    }

    // Define o tipo de midia pela pagina atual.
    function mediaForPage() {
        if (state.pageType === "series" || state.pageType === "animes" || state.pageType === "doramas") {
            return "tv";
        }
        return "movie";
    }

    // Normaliza resultados para remover itens sem poster.
    function normalizeResults(results, media) {
        return (results || []).filter(function (item) {
            return item && item.id && item.poster_path && (item.media_type ? normalizeMedia(item.media_type) === media : true);
        });
    }

    // Normaliza nomes de media vindos do TMDB ou das paginas.
    function normalizeMedia(media) {
        return media === "tv" || media === "series" ? "tv" : "movie";
    }

    // Retorna embeds cadastrados para o item.
    function embedsFor(media, id) {
        return manualEmbeds[media + ":" + id] || [];
    }

    // Monta URL de poster.
    function posterUrl(path) {
        return path ? IMAGE_BASE + path : FALLBACK_POSTER;
    }

    // Monta URL de backdrop.
    function backdropUrl(path) {
        return path ? "https://image.tmdb.org/t/p/original" + path : FALLBACK_POSTER;
    }

    // Extrai o ano de filme ou serie.
    function extractYear(item) {
        var date = item.release_date || item.first_air_date || "";
        return date ? date.slice(0, 4) : "";
    }

    // Formata nota TMDB.
    function formatRating(value) {
        return value ? "TMDB " + Number(value).toFixed(1) : "";
    }

    // Mensagens pequenas no layout existente.
    function showMessage(text, isError) {
        if (!messageNode) {
            return;
        }
        messageNode.textContent = text;
        messageNode.classList.toggle("text-danger", Boolean(isError));
        messageNode.classList.toggle("text-theme", !isError);
    }

    // Renderiza erro na pagina de detalhes.
    function renderError(text) {
        if (detailNode) {
            detailNode.innerHTML = '<section class="bf-catalog-section section-long section-text-white"><div class="container"><p class="bf-empty">' + escapeHtml(text) + '</p></div></section>';
        }
    }

    // Escapa HTML vindo de APIs.
    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    // Escapa valores de atributos HTML.
    function escapeAttr(value) {
        return escapeHtml(value);
    }
}());
