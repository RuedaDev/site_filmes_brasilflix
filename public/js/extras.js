// ==========================================
// FUNCIONALIDADES EXTRAS - BRASILFLIX (COM AUTH)
// ==========================================
(function() {
    "use strict";
    console.log("🌟 Funcionalidades Extras carregadas");

    // ---------- UTILITÁRIOS ----------
    const getToken = () => localStorage.getItem('bf_token');
    const getUser = () => JSON.parse(localStorage.getItem('bf_user') || 'null');
    const isLoggedIn = () => !!getToken();

    // ---------- SISTEMA DE FAVORITOS (com sincronização) ----------
    const Favorites = {
        get() {
            try { return JSON.parse(localStorage.getItem('bf_favorites') || '[]'); } catch(e) { return []; }
        },
        add(item) {
            const favs = this.get();
            if (!favs.find(f => f.id === item.id)) {
                favs.push({
                    id: item.id,
                    title: item.title || item.name,
                    poster: item.poster_path || '',
                    media: item.media_type || item.media || 'movie',
                    addedAt: new Date().toISOString()
                });
                localStorage.setItem('bf_favorites', JSON.stringify(favs));
                showToast('❤️ Adicionado aos favoritos!');
                // Sincroniza com servidor se logado
                this.addToServer(item);
            }
        },
        remove(id) {
            let favs = this.get().filter(f => f.id !== id);
            localStorage.setItem('bf_favorites', JSON.stringify(favs));
            showToast('💔 Removido dos favoritos');
            this.removeFromServer(id);
        },
        isFavorited(id) {
            return this.get().some(f => f.id === id);
        },
        async syncWithServer() {
            const token = getToken();
            if (!token) return;
            try {
                const response = await fetch('/api/favorites', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const serverFavs = await response.json();
                const localFavs = this.get();
                for (const fav of serverFavs) {
                    if (!localFavs.find(lf => lf.id === fav.tmdb_id)) {
                        localFavs.push({
                            id: fav.tmdb_id,
                            title: fav.title,
                            poster: fav.poster_path,
                            media: fav.media_type
                        });
                    }
                }
                localStorage.setItem('bf_favorites', JSON.stringify(localFavs));
            } catch (error) {
                console.log('Usando favoritos locais');
            }
        },
        async addToServer(item) {
            const token = getToken();
            if (!token) return;
            try {
                await fetch('/api/favorites', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        tmdb_id: item.id,
                        title: item.title,
                        poster_path: item.poster_path || '',
                        media_type: item.media || 'movie'
                    })
                });
            } catch (error) {}
        },
        async removeFromServer(id) {
            const token = getToken();
            if (!token) return;
            try {
                await fetch(`/api/favorites/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            } catch (error) {}
        }
    };

    // ---------- HISTÓRICO (com servidor) ----------
    const History = {
        get() {
            try { return JSON.parse(localStorage.getItem('bf_history') || '[]'); } catch(e) { return []; }
        },
        add(item) {
            let history = this.get().filter(h => h.id !== item.id);
            history.unshift({
                id: item.id,
                title: item.title || item.name,
                poster: item.poster_path || '',
                media: item.media_type || 'movie',
                watchedAt: new Date().toISOString()
            });
            if (history.length > 50) history.pop();
            localStorage.setItem('bf_history', JSON.stringify(history));
            this.addToServer(item);
        },
        async addToServer(item) {
            const token = getToken();
            if (!token) return;
            try {
                await fetch('/api/history', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        tmdb_id: item.id,
                        title: item.title,
                        poster_path: item.poster_path || '',
                        media_type: item.media || 'movie'
                    })
                });
            } catch (error) {}
        }
    };

    // ---------- TEMA ----------
    const Theme = {
        init() {
            const saved = localStorage.getItem('bf_theme') || 'dark';
            this.apply(saved);
        },
        apply(theme) {
            document.body.classList.toggle('light-mode', theme === 'light');
            localStorage.setItem('bf_theme', theme);
            this.updateIcon();
        },
        toggle() {
            const current = localStorage.getItem('bf_theme') || 'dark';
            this.apply(current === 'dark' ? 'light' : 'dark');
        },
        updateIcon() {
            const btn = document.getElementById('theme-toggle-btn');
            if (btn) {
                const isLight = localStorage.getItem('bf_theme') === 'light';
                btn.innerHTML = isLight ? '☀️<span class="floating-label">Tema</span>' : '🌙<span class="floating-label">Tema</span>';
            }
        }
    };

    // ---------- HEADER DINÂMICO (LOGIN/LOGOUT) ----------
    function updateHeader() {
        const user = getUser();
        const navbarExtra = document.querySelector('.navbar-extra');
        if (!navbarExtra) return;

        if (user && user.name) {
            navbarExtra.innerHTML = `
                <div class="dropdown">
                    <button class="btn btn-sm btn-outline-light dropdown-toggle" type="button" id="userDropdown" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                        👤 ${user.name}
                    </button>
                    <div class="dropdown-menu dropdown-menu-right" aria-labelledby="userDropdown">
                        <a class="dropdown-item" href="perfil.html"><i class="fas fa-user"></i> Perfil</a>
                        <a class="dropdown-item" href="#" id="logout-link"><i class="fas fa-sign-out-alt"></i> Sair</a>
                    </div>
                </div>
            `;
            document.getElementById('logout-link').addEventListener('click', (e) => {
                e.preventDefault();
                logout();
            });
        } else {
            navbarExtra.innerHTML = `
                <a class="btn-theme btn" href="login.html"><i class="fas fa-user"></i>&nbsp;&nbsp;Login</a>
            `;
        }
    }

    function logout() {
        localStorage.removeItem('bf_token');
        localStorage.removeItem('bf_user');
        // Opcional: limpar favoritos locais ou manter
        window.location.href = 'homepage-1.html';
    }

    // ---------- BOTÕES FLUTUANTES ----------
    function createFloatingButtons() {
        const existing = document.querySelector('.floating-actions');
        if (existing) existing.remove();

        const div = document.createElement('div');
        div.className = 'floating-actions';
        div.innerHTML = `
            <button class="floating-btn theme" id="theme-toggle-btn" title="Alternar tema">🌙<span class="floating-label">Tema</span></button>
            <button class="floating-btn favorites" id="fav-btn" title="Favoritos">❤️<span class="floating-label">Favoritos</span></button>
            <button class="floating-btn history" id="hist-btn" title="Histórico">🕐<span class="floating-label">Histórico</span></button>
            <button class="floating-btn share" id="share-btn" title="Compartilhar">📤<span class="floating-label">Compartilhar</span></button>
            <button class="floating-btn top" id="top-btn" title="Voltar ao topo">⬆️<span class="floating-label">Topo</span></button>
        `;
        document.body.appendChild(div);

        document.getElementById('theme-toggle-btn').addEventListener('click', () => Theme.toggle());
        document.getElementById('fav-btn').addEventListener('click', () => window.showFavorites());
        document.getElementById('hist-btn').addEventListener('click', () => window.showHistory());
        document.getElementById('share-btn').addEventListener('click', () => window.toggleShareMenu());
        document.getElementById('top-btn').addEventListener('click', () => window.scrollTo({top:0,behavior:'smooth'}));
        Theme.updateIcon();
    }

    // ---------- MENU COMPARTILHAR ----------
    function createShareMenu() {
        const existing = document.getElementById('share-menu');
        if (existing) existing.remove();
        const menu = document.createElement('div');
        menu.className = 'share-menu';
        menu.id = 'share-menu';
        const currentUrl = encodeURIComponent(window.location.href);
        const title = encodeURIComponent(document.title);
        menu.innerHTML = `
            <div class="share-menu-header"><span>📤 Compartilhar</span><button class="share-close-btn" onclick="document.getElementById('share-menu').classList.remove('show')">✕</button></div>
            <button class="share-btn whatsapp" onclick="window.open('https://wa.me/?text=${title}%20${currentUrl}')">📱 WhatsApp</button>
            <button class="share-btn facebook" onclick="window.open('https://facebook.com/sharer/sharer.php?u=${currentUrl}')">📘 Facebook</button>
            <button class="share-btn twitter" onclick="window.open('https://twitter.com/intent/tweet?url=${currentUrl}&text=${title}')">🐦 Twitter</button>
            <button class="share-btn telegram" onclick="window.open('https://t.me/share/url?url=${currentUrl}&text=${title}')">✈️ Telegram</button>
            <button class="share-btn copy" onclick="copyToClipboard()">📋 Copiar Link</button>
        `;
        document.body.appendChild(menu);
    }
    function copyToClipboard() {
        navigator.clipboard.writeText(window.location.href).then(() => {
            showToast('📋 Link copiado!');
            document.getElementById('share-menu').classList.remove('show');
        }).catch(() => showToast('❌ Erro ao copiar link'));
    }
    window.toggleShareMenu = () => {
        const m = document.getElementById('share-menu');
        if (m) m.classList.toggle('show');
    };

    // ---------- MODAL TRAILER ----------
    function createTrailerModal() {
        const existing = document.getElementById('trailer-modal');
        if (existing) existing.remove();
        const modal = document.createElement('div');
        modal.className = 'modal-trailer';
        modal.id = 'trailer-modal';
        modal.innerHTML = `
            <div class="modal-trailer-content">
                <button class="modal-trailer-close" onclick="document.getElementById('trailer-modal').classList.remove('show')">✕</button>
                <iframe id="trailer-iframe" src="" allowfullscreen></iframe>
            </div>
        `;
        document.body.appendChild(modal);
    }
    window.playTrailer = async (mediaType, id) => {
        try {
            const resp = await fetch(`/api/trailers/${mediaType}/${id}`);
            const data = await resp.json();
            if (data.results && data.results.length > 0) {
                const trailer = data.results.find(v => v.type === 'Trailer' && v.site === 'YouTube') || data.results[0];
                document.getElementById('trailer-iframe').src = `https://www.youtube.com/embed/${trailer.key}?autoplay=1`;
                document.getElementById('trailer-modal').classList.add('show');
            } else showToast('😔 Trailer indisponível');
        } catch (e) { showToast('❌ Erro ao carregar trailer'); }
    };

    // ---------- BOTÃO FAVORITAR NA PÁGINA DE DETALHES ----------
    function createDetailFavoriteButton() {
        if (document.body.getAttribute('data-bf-page') !== 'detalhes') return;
        setTimeout(() => {
            const btnContainer = document.querySelector('.bf-detail-copy');
            if (!btnContainer) return;
            const params = new URLSearchParams(window.location.search);
            const id = parseInt(params.get('id'));
            const media = params.get('media') || 'movie';
            const title = document.querySelector('.bf-detail-copy h1')?.textContent || 'Título';
            const favBtn = document.createElement('button');
            favBtn.className = 'btn-fav-detail';
            favBtn.setAttribute('data-id', id);
            const update = () => {
                const isFav = Favorites.isFavorited(id);
                favBtn.innerHTML = isFav ? '❤️ Remover dos Favoritos' : '🤍 Adicionar aos Favoritos';
                favBtn.classList.toggle('favorited', isFav);
            };
            favBtn.addEventListener('click', () => {
                if (Favorites.isFavorited(id)) Favorites.remove(id);
                else Favorites.add({ id, title, poster_path: '', media_type: media });
                update();
            });
            update();
            const assistirBtn = btnContainer.querySelector('.btn-theme');
            if (assistirBtn) assistirBtn.parentNode.insertBefore(favBtn, assistirBtn.nextSibling);
            else btnContainer.appendChild(favBtn);
        }, 800);
    }

    // ---------- TOAST ----------
    function showToast(msg, dur = 3000) {
        const old = document.querySelector('.toast-notification');
        if (old) old.remove();
        const t = document.createElement('div');
        t.className = 'toast-notification';
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), dur);
    }
    window.showToast = showToast;

    // ---------- MODAIS DE FAVORITOS/HISTÓRICO ----------
    window.showFavorites = function() {
        const favs = Favorites.get();
        if (!favs.length) { showToast('📭 Nenhum favorito'); return; }
        showModalGrid('❤️ Meus Favoritos', favs);
    };
    window.showHistory = function() {
        const hist = History.get().slice(0, 20);
        if (!hist.length) { showToast('📭 Nenhum histórico'); return; }
        showModalGrid('🕐 Histórico', hist);
    };
    function showModalGrid(title, items) {
        const modal = document.createElement('div');
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:10000;overflow-y:auto;padding:20px;';
        modal.innerHTML = `
            <div style="max-width:1200px;margin:0 auto;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                    <h2 style="color:white;">${title} (${items.length})</h2>
                    <button onclick="this.closest('div').parentElement.parentElement.remove()" style="background:red;color:white;border:none;padding:10px 20px;border-radius:5px;cursor:pointer;">Fechar</button>
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:15px;">
                    ${items.map(item => `
                        <div style="background:#1a1a1a;border-radius:10px;overflow:hidden;cursor:pointer;" onclick="window.location.href='detalhes.html?id=${item.id}&media=${item.media}'">
                            <img src="https://image.tmdb.org/t/p/w300${item.poster || ''}" style="width:100%;height:225px;object-fit:cover;" onerror="this.src='https://via.placeholder.com/300x450?text=Sem+Poster'">
                            <div style="padding:10px;"><p style="color:white;font-size:0.8rem;margin:0;">${item.title}</p></div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // ---------- OBSERVAR CARDS PARA BOTÃO FAVORITO ----------
    function observeCards() {
    // Em vez de observar todo o DOM, apenas adiciona os botões quando novos cards são inseridos via funções já existentes.
    // Mas para não quebrar, vamos usar um observer limitado à #catalogo ou similar.
    const target = document.getElementById('catalogo') || document.body;
    const observer = new MutationObserver((mutations) => {
        mutations.forEach(m => {
            m.addedNodes.forEach(node => {
                if (node.nodeType === 1) {
                    if (node.matches && node.matches('.bf-card')) addFavButtonToCard(node);
                    if (node.querySelectorAll) node.querySelectorAll('.bf-card').forEach(addFavButtonToCard);
                }
            });
        });
    });
    observer.observe(target, { childList: true, subtree: true });
    document.querySelectorAll('.bf-card').forEach(addFavButtonToCard);
}

    // ---------- INICIALIZAÇÃO ----------
    async function init() {
        Theme.init();
        updateHeader();
        createFloatingButtons();
        createShareMenu();
        createTrailerModal();
        createDetailFavoriteButton();
        observeCards();

        if (isLoggedIn()) {
            await Favorites.syncWithServer();
        }

        // Verifica mensagem de cadastro via URL
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('registered') === 'true') {
            showToast('✅ Cadastro efetuado com sucesso! Bem-vindo!');
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        console.log("✅ Extras inicializados");
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    window.Favorites = Favorites;
    window.History = History;
    window.Theme = Theme;
    window.logout = logout;
})();