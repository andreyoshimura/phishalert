# Página oficial local

Esta pasta contém a versão local da página oficial usada para testes do `phishalert`.

Arquivos:

- `index.html`: página oficial simples
- `collector.js`: referência de snippet, equivalente ao código inline do `head`
- `../server.js`: servidor local para servir a página, receber eventos e exportar dossiês em JSON/Markdown

## Evento capturado

O snippet registra:

- URL atual
- `document.referrer`
- token opcional em `?token=...`
- user-agent
- idioma
- timezone
- timestamp ISO

Se o endpoint ainda não existir, o payload é mantido em `window.__PHISHALERT__` e tentado com `fetch` de forma segura.

## Formato recomendado

O ideal é colar o snippet diretamente no `head` da página oficial, sem dependências externas. Isso reduz atrito de implantação e facilita vender/ativar o recurso como uma mudança simples no lado do cliente.

O snippet pronto está em [doc/como configurar](../../doc/como%20configurar.md).

## Execução local

```bash
node src/server.js
```

Depois abra:

```text
http://localhost:3003
```
