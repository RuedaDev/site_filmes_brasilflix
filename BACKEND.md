# Backend BrasilFLIX

Este backend serve o site e esconde o token do TMDB no servidor.

## Como configurar

1. Copie `.env.example` para `.env`.
2. No `.env`, troque `cole_seu_token_read_access_aqui` pelo seu token do TMDB.
3. Rode:

```powershell
node server.js
```

4. Abra:

```txt
http://localhost:3000
```

## Endpoints

Checar se o backend esta funcionando:

```txt
GET /api/health
```

Pesquisar filmes:

```txt
GET /api/tmdb/search?type=movie&query=matrix
```

Filmes populares:

```txt
GET /api/tmdb/popular?type=movie&page=1
```

Series populares:

```txt
GET /api/tmdb/popular?type=tv&page=1
```

Pesquisar series:

```txt
GET /api/tmdb/search?type=tv&query=breaking%20bad
```

Buscar filme por ID TMDB:

```txt
GET /api/tmdb/movie/550
```

Buscar serie por ID TMDB:

```txt
GET /api/tmdb/tv/1396
```

Encontrar dados pelo ID IMDb:

```txt
GET /api/tmdb/find/tt0137523
```

## Como usar no catalogo

O usuario continua apenas clicando em `Assistir`.

Voce pode usar o backend para descobrir nome, ano e poster, mas o catalogo do site ainda fica em `js/brasilflix.js`.
