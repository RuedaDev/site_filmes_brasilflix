// ==========================================
// FUNCIONALIDADES EXTRAS - BRASILFLIX (OTIMIZADO)
// ==========================================

(function() {
    "use strict";

    console.log("🌟 Funcionalidades Extras carregadas");

    // ---------- SISTEMA DE FAVORITOS ----------
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
            }
        },
        remove(id) {
            let favs = this.get().filter(f => f.id !== id);
            localStorage.setItem('bf_favorites', JSON.stringify(favs));
            showToast('💔 Removido dos favoritos');
        },
        isFavorited(id) {
            return this.get().some(f => f.id === id);
        }
    };

    // ---------- HISTÓRICO ----------
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
        },
        getLastWatched() { return this.get().slice(0, 10); }
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

    window.toggleShareMenu = function() {
        const menu = document.getElementById('share-menu');
        if (menu) menu.classList.toggle('show');
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

    window.playTrailer = async function(mediaType, id) {
        try {
            const response = await fetch(`/api/trailers/${mediaType}/${id}`);
            const data = await response.json();
            if (data.results && data.results.length > 0) {
                const trailer = data.results.find(v => v.type === 'Trailer' && v.site === 'YouTube') || data.results[0];
                document.getElementById('trailer-iframe').src = `https://www.youtube.com/embed/${trailer.key}?autoplay=1`;
                document.getElementById('trailer-modal').classList.add('show');
            } else {
                showToast('😔 Trailer não disponível');
            }
        } catch (error) {
            showToast('❌ Erro ao carregar trailer');
        }
    };

    // ---------- BOTÃO DE FAVORITAR (DETALHES) ----------
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

            function updateFavButton() {
                const isFav = Favorites.isFavorited(id);
                favBtn.innerHTML = isFav ? '❤️ Remover dos Favoritos' : '🤍 Adicionar aos Favoritos';
                favBtn.classList.toggle('favorited', isFav);
            }

            favBtn.addEventListener('click', () => {
                if (Favorites.isFavorited(id)) {
                    Favorites.remove(id);
                } else {
                    Favorites.add({
                        id,
                        title,
                        poster_path: document.querySelector('.bf-detail-poster')?.style.backgroundImage?.match(/url\("(.+)"\)/)?.[1] || '',
                        media_type: media
                    });
                }
                updateFavButton();
            });

            updateFavButton();
            const assistirBtn = btnContainer.querySelector('.btn-theme');
            if (assistirBtn) {
                assistirBtn.parentNode.insertBefore(favBtn, assistirBtn.nextSibling);
            } else {
                btnContainer.appendChild(favBtn);
            }
        }, 800);
    }

    // ---------- TOAST ----------
    function showToast(message, duration = 3000) {
        const old = document.querySelector('.toast-notification');
        if (old) old.remove();
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), duration);
    }
    window.showToast = showToast;

    // ---------- EXIBIR FAVORITOS ----------
    window.showFavorites = function() {
        const favs = Favorites.get();
        if (favs.length === 0) { showToast('📭 Nenhum favorito ainda'); return; }
        const modal = document.createElement('div');
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:10000;overflow-y:auto;padding:20px;';
        modal.innerHTML = `
            <div style="max-width:1200px;margin:0 auto;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                    <h2 style="color:white;">❤️ Meus Favoritos (${favs.length})</h2>
                    <button onclick="this.closest('div').parentElement.parentElement.remove()" style="background:red;color:white;border:none;padding:10px 20px;border-radius:5px;cursor:pointer;">Fechar</button>
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:15px;">
                    ${favs.map(f => `
                        <div style="background:#1a1a1a;border-radius:10px;overflow:hidden;cursor:pointer;" onclick="window.location.href='detalhes.html?id=${f.id}&media=${f.media}'">
                            <img src="https://image.tmdb.org/t/p/w300${f.poster}" style="width:100%;height:225px;object-fit:cover;" onerror="this.src='https://via.placeholder.com/300x450?text=Sem+Poster'">
                            <div style="padding:10px;"><p style="color:white;font-size:0.8rem;margin:0;">${f.title}</p></div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    };

    // ---------- EXIBIR HISTÓRICO ----------
    window.showHistory = function() {
        const history = History.getLastWatched();
        if (history.length === 0) { showToast('📭 Nenhum histórico ainda'); return; }
        const modal = document.createElement('div');
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:10000;overflow-y:auto;padding:20px;';
        modal.innerHTML = `
            <div style="max-width:1200px;margin:0 auto;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                    <h2 style="color:white;">🕐 Histórico Recente</h2>
                    <button onclick="this.closest('div').parentElement.parentElement.remove()" style="background:red;color:white;border:none;padding:10px 20px;border-radius:5px;cursor:pointer;">Fechar</button>
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:15px;">
                    ${history.map(h => `
                        <div style="background:#1a1a1a;border-radius:10px;overflow:hidden;cursor:pointer;" onclick="window.location.href='detalhes.html?id=${h.id}&media=${h.media}'">
                            <img src="https://image.tmdb.org/t/p/w300${h.poster}" style="width:100%;height:225px;object-fit:cover;" onerror="this.src='https://via.placeholder.com/300x450?text=Sem+Poster'">
                            <div style="padding:10px;"><p style="color:white;font-size:0.8rem;margin:0;">${h.title}</p><small style="color:#aaa;">${new Date(h.watchedAt).toLocaleDateString()}</small></div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    };

    // ---------- ADICIONAR FAVORITOS NOS CARDS (com MutationObserver) ----------
    function observeCards() {
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.addedNodes.length) {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1) { // Elemento
                            if (node.matches && node.matches('.bf-card')) addFavButtonToCard(node);
                            // Verifica descendentes
                            const cards = node.querySelectorAll ? node.querySelectorAll('.bf-card') : [];
                            cards.forEach(card => addFavButtonToCard(card));
                        }
                    });
                }
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        // Adiciona nos cards já existentes
        document.querySelectorAll('.bf-card').forEach(card => addFavButtonToCard(card));
    }

    function addFavButtonToCard(card) {
        if (card.querySelector('.fav-btn')) return;
        const link = card.querySelector('a[href*="detalhes.html"]');
        if (!link) return;
        const url = new URL(link.href, window.location.origin);
        const id = url.searchParams.get('id');
        const media = url.searchParams.get('media') || 'movie';
        const favBtn = document.createElement('button');
        favBtn.className = 'fav-btn';
        favBtn.innerHTML = Favorites.isFavorited(parseInt(id)) ? '❤️' : '🤍';
        favBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            const title = card.querySelector('h3')?.textContent || 'Título';
            if (Favorites.isFavorited(parseInt(id))) {
                Favorites.remove(parseInt(id));
                favBtn.innerHTML = '🤍';
            } else {
                Favorites.add({ id: parseInt(id), title, poster_path: '', media_type: media });
                favBtn.innerHTML = '❤️';
            }
        });
        card.style.position = 'relative';
        card.appendChild(favBtn);
    }

    // ---------- INICIALIZAÇÃO ----------
    function init() {
        Theme.init();
        createFloatingButtons();
        // Esconde botões flutuantes quando player está visível (mobile)
        const playerSection = document.getElementById('player');
        if (playerSection && window.innerWidth <= 768) {
        const observer = new IntersectionObserver((entries) => {
        const floating = document.querySelector('.floating-actions');
        if (!floating) return;
        if (entries[0].isIntersecting) {
            floating.style.opacity = '0';
            floating.style.pointerEvents = 'none';
        } else {
            floating.style.opacity = '1';
            floating.style.pointerEvents = 'auto';
        }
    }, { threshold: 0.3 });
    observer.observe(playerSection);
}
        createShareMenu();
        createTrailerModal();
        createDetailFavoriteButton();
        observeCards(); // substitui o setInterval

        console.log("✅ Funcionalidades extras inicializadas");
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.Favorites = Favorites;
    window.History = History;
    window.Theme = Theme;
})();