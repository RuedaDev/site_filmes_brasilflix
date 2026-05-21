(function() {
    const pageType = document.body.getAttribute('data-bf-page');
    const validPages = ['filmes', 'series', 'animes', 'doramas', 'desenhos'];
    if (!pageType || !validPages.includes(pageType)) return;

    const config = {
        filmes: {
            defaultBg: 'https://image.tmdb.org/t/p/w1280/8YFL5QQVPy3AgvEQpNYH9BfF5Mq.jpg'
        },
        series: {
            defaultBg: 'https://image.tmdb.org/t/p/w1280/5DgZ1UUtQK5fPb7jeBJ6nq3Vh9N.jpg'
        },
        animes: {
            defaultBg: 'https://image.tmdb.org/t/p/w1280/q3Z4QHjzWV7QBzMVMEqDEHjT7MV.jpg'
        },
        doramas: {
            defaultBg: 'https://image.tmdb.org/t/p/w1280/A6tM5oE2TCl0Ak5DZ0Lz7JqLw1W.jpg'
        },
        desenhos: {
            defaultBg: 'https://image.tmdb.org/t/p/w1280/bGZn5RVzMMXjuhCUgV2Q9PgFmF.jpg'
        }
    };

    const cfg = config[pageType];
    if (!cfg) return;

    function getBackdropFromCard() {
        const firstCard = document.querySelector('.bf-card-poster');
        if (firstCard) {
            const bg = firstCard.style.backgroundImage;
            const match = bg.match(/url\(["']?([^"')]+)["']?\)/);
            if (match) {
                return match[1].replace(/w\d+/, 'w1280');
            }
        }
        return null;
    }

    function applyBanner() {
        // Tenta encontrar a seção hero da página
        let hero = document.querySelector('.bf-page-hero');
        if (!hero) {
            // Fallback para páginas que usam classes diferentes (ex: animes tem .anime-hero, desenhos .desenho-hero)
            hero = document.querySelector('.anime-hero, .desenho-hero, .bf-category-banner');
        }
        if (!hero) {
            // Se não existir nenhuma seção hero, tenta novamente em 300ms
            setTimeout(applyBanner, 300);
            return;
        }

        const backdrop = getBackdropFromCard() || cfg.defaultBg;
        hero.style.backgroundImage = `url('${backdrop}')`;
        hero.style.backgroundSize = 'cover';
        hero.style.backgroundPosition = 'center';
        // Adiciona um overlay se não existir um shade dentro
        if (!hero.querySelector('.bf-hero-shade, .bf-banner-overlay')) {
            const overlay = document.createElement('div');
            overlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;background:linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0.3));z-index:1;';
            hero.style.position = 'relative';
            hero.insertBefore(overlay, hero.firstChild);
        }
    }

    // Aguarda a página carregar e os cards serem renderizados
    if (document.readyState === 'complete') {
        setTimeout(applyBanner, 500);
    } else {
        window.addEventListener('load', () => {
            setTimeout(applyBanner, 500);
        });
    }

    // Tenta novamente após 3 segundos (caso os cards demorem)
    setTimeout(() => {
        if (!document.querySelector('.bf-page-hero, .anime-hero, .desenho-hero')?.style.backgroundImage) {
            applyBanner();
        }
    }, 3000);
})();