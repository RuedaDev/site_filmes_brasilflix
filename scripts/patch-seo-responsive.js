const fs = require("fs");
const path = require("path");

const publicDir = path.join(__dirname, "..", "public");

const pages = {
    "filmes.html": {
        title: "Filmes Online Grátis | BrasilFLIX",
        description: "Assista filmes online grátis no BrasilFLIX. Catálogo popular, busca por título e ano, sinopses e múltiplos players.",
        canonical: "/filmes.html",
        keywords: "filmes online, filmes grátis, assistir filme, BrasilFLIX"
    },
    "series.html": {
        title: "Séries Online Grátis | BrasilFLIX",
        description: "Séries e novelas online grátis no BrasilFLIX. Explore temporadas, episódios e assista com busca inteligente.",
        canonical: "/series.html",
        keywords: "séries online, séries grátis, assistir série, BrasilFLIX"
    },
    "animes.html": {
        title: "Animes Online Grátis | BrasilFLIX",
        description: "Animes em português e legendados no BrasilFLIX. Filtros por gênero, temporada e busca por título.",
        canonical: "/animes.html",
        keywords: "animes online, anime grátis, assistir anime, BrasilFLIX"
    },
    "doramas.html": {
        title: "Doramas Online Grátis | BrasilFLIX",
        description: "Doramas asiáticos populares no BrasilFLIX. Séries coreanas, japonesas e chinesas com busca e catálogo atualizado.",
        canonical: "/doramas.html",
        keywords: "doramas online, dorama grátis, k-drama, BrasilFLIX"
    },
    "desenhos.html": {
        title: "Desenhos Animados Online | BrasilFLIX",
        description: "Desenhos animados ocidentais: séries e filmes de animação (não anime) para assistir online no BrasilFLIX.",
        canonical: "/desenhos.html",
        keywords: "desenhos animados, cartoons online, animação infantil, BrasilFLIX"
    },
    "categorias.html": {
        title: "Categorias e Gêneros | BrasilFLIX",
        description: "Navegue por gêneros de filmes, séries, animes e doramas no BrasilFLIX e encontre títulos por categoria.",
        canonical: "/categorias.html",
        keywords: "gêneros filmes, categorias séries, catálogo BrasilFLIX"
    },
    "detalhes.html": {
        title: "Assistir Online | BrasilFLIX",
        description: "Página de detalhes do título no BrasilFLIX: sinopse, elenco, trailer e opções de reprodução.",
        canonical: "/detalhes.html",
        keywords: "assistir online, sinopse, trailer, BrasilFLIX",
        ogGeneric: true
    },
    "login.html": {
        title: "Entrar na Conta | BrasilFLIX",
        description: "Faça login na sua conta BrasilFLIX para sincronizar favoritos e histórico de visualização.",
        canonical: "/login.html",
        robots: "noindex, follow"
    },
    "cadastro.html": {
        title: "Criar Conta | BrasilFLIX",
        description: "Cadastre-se no BrasilFLIX e salve favoritos, histórico e personalize sua experiência.",
        canonical: "/cadastro.html",
        robots: "noindex, follow"
    },
    "perfil.html": {
        title: "Meu Perfil | BrasilFLIX",
        description: "Gerencie favoritos e histórico na sua conta BrasilFLIX.",
        canonical: "/perfil.html",
        robots: "noindex, nofollow"
    }
};

function buildHead(meta) {
    const robots = meta.robots || "index, follow, max-image-preview:large";
    const ogTitle = meta.title;
    return `    <meta charset="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="${robots}" />
    <meta name="theme-color" content="#090c10" />
    <title>${ogTitle}</title>
    <meta name="description" content="${meta.description}" />
    ${meta.keywords ? `<meta name="keywords" content="${meta.keywords}" />` : ""}
    <link rel="canonical" href="${meta.canonical}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="BrasilFLIX" />
    <meta property="og:locale" content="pt_BR" />
    <meta property="og:title" content="${ogTitle}" />
    <meta property="og:description" content="${meta.description}" />
    ${meta.ogGeneric ? '<meta property="og:image" content="https://image.tmdb.org/t/p/w500/wwemzKWzjKYJFfCeiB57v3vH1Xg.jpg" />' : ""}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${ogTitle}" />
    <meta name="twitter:description" content="${meta.description}" />
    <link href="./bootstrap/css/bootstrap.css" rel="stylesheet" />
    <link href="./fontawesome/css/fontawesome-all.css" rel="stylesheet" />
    <link href="https://fonts.googleapis.com/css?family=Oswald:300,400,500,700&display=swap" rel="stylesheet" />
    <link href="https://fonts.googleapis.com/css?family=Open+Sans:300,400,600,700&display=swap" rel="stylesheet" />
    <link href="./css/dot-icons.css" rel="stylesheet" />
    <link href="./css/theme.css" rel="stylesheet" />
    <link href="./css/brasilflix.css" rel="stylesheet" />
    <link href="./css/extras.css" rel="stylesheet" />
    <link href="./css/responsive.css" rel="stylesheet" />`;
}

function patchFile(filename, meta) {
    const filePath = path.join(publicDir, filename);
    let html = fs.readFileSync(filePath, "utf8");

    html = html.replace(/<head>[\s\S]*?<\/head>/i, `<head>\n${buildHead(meta)}\n</head>`);

    if (!html.includes('bf-skip-link')) {
        html = html.replace(
            /<body([^>]*)>/i,
            '<body$1>\n    <a class="bf-skip-link" href="#conteudo-principal">Ir para o conteúdo</a>'
        );
    }

    if (!html.includes('id="conteudo-principal"')) {
        html = html.replace(/<main(\s|>)/i, '<main id="conteudo-principal"$1');
    }

    if (html.includes('role="banner"') === false && html.includes("<header")) {
        html = html.replace(/<header class="/, '<header role="banner" class="');
    }

    if (!html.includes("site.js")) {
        html = html.replace(
            /<script src="\.\/js\/jquery-3\.3\.1\.js"/,
            '<script src="./js/site.js" defer></script>\n    <script src="./js/jquery-3.3.1.js"'
        );
        if (!html.includes("site.js")) {
            html = html.replace(
                /(<script src="\.\/bootstrap\/js\/bootstrap\.js"[^>]*>)/,
                '<script src="./js/site.js" defer></script>\n    $1'
            );
        }
    }

    html = html.replace(
        /<button class="navbar-toggler" type="button"(?! aria-label)/g,
        '<button class="navbar-toggler" type="button" aria-label="Abrir ou fechar menu" aria-expanded="false"'
    );

    fs.writeFileSync(filePath, html, "utf8");
    console.log("OK", filename);
}

Object.keys(pages).forEach((file) => patchFile(file, pages[file]));

// index.html
const indexPath = path.join(publicDir, "index.html");
fs.writeFileSync(
    indexPath,
    `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="index, follow" />
    <title>BrasilFLIX — Redirecionando</title>
    <meta name="description" content="BrasilFLIX: filmes, séries, animes e doramas online grátis." />
    <link rel="canonical" href="/homepage-1.html" />
    <meta http-equiv="refresh" content="0; url=homepage-1.html" />
    <link rel="stylesheet" href="./css/brasilflix.css" />
</head>
<body>
    <p><a href="homepage-1.html">Ir para BrasilFLIX — filmes, séries, animes e doramas online</a></p>
</body>
</html>
`,
    "utf8"
);
console.log("OK index.html");
