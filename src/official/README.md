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

O ideal é colar o snippet diretamente no `head` da página oficial, sem dependências externas. Isso reduz atrito de implantação e combina melhor com páginas corporativas já protegidas por WAF.

### Snippet pronto para colar

```html
<script>
  (() => {
    const ENDPOINT = "/api/events";

    function getToken() {
      try {
        return new URL(window.location.href).searchParams.get("token") || "";
      } catch {
        return "";
      }
    }

    function send(payload) {
      const body = JSON.stringify(payload);
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, blob)) return;
      fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }

    window.addEventListener("DOMContentLoaded", () => {
      send({
        event_type: "official_page_view",
        page_url: window.location.href,
        referrer: document.referrer || "",
        campaign_token: getToken(),
        user_agent: navigator.userAgent || "",
        language: navigator.language || "",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
        timestamp: new Date().toISOString(),
      });
    });
  })();
</script>
```

Use esse bloco como está ou ajuste apenas o `ENDPOINT` para o domínio interno do coletor.

## Execução local

```bash
node src/server.js
```

Depois abra:

```text
http://localhost:3003
```
