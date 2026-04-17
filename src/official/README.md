# Página oficial local

Esta pasta contém a versão local da página oficial usada para testes do `phishalert`.

Arquivos:

- `index.html`: página oficial simples
- `collector.js`: snippet que captura sinais básicos e tenta enviar um evento para `/api/events`
- `../server.js`: servidor local para servir a página, receber eventos e expor `GET /api/cases`

## Evento capturado

O snippet registra:

- URL atual
- `document.referrer`
- token opcional em `?token=...`
- user-agent
- idioma
- timezone
- dimensões de tela e viewport
- timestamp ISO

Se o endpoint ainda não existir, o payload é mantido em `window.__PHISHALERT__` e tentado com `fetch` de forma segura.

## Execução local

```bash
node src/server.js
```

Depois abra:

```text
http://localhost:3003
```
