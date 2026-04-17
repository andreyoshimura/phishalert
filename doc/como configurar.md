# Como Configurar

Este documento traz o snippet mínimo para colar no `head` da página oficial.

## Objetivo

- Registrar apenas `page_view`
- Capturar sinais básicos de origem
- Evitar dependências externas
- Permitir implantação rápida colando um único snippet no `head`

## Snippet Final

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

## Onde Colar

- No `head` da página oficial
- Antes do fechamento de `</head>`
- Sem importar bibliotecas externas

## O Que O Snippet Envia

- URL atual
- `document.referrer`
- token opcional em `?token=...`
- user-agent
- idioma
- timezone
- timestamp ISO

## Endpoint

- `POST /api/events`

## Observações

- O snippet foi mantido propositalmente pequeno.
- Ele não coleta senha nem dados de formulário.
- A página continua funcionando mesmo se o endpoint ainda não estiver disponível.
- Se você quiser implantar em produção, normalmente basta colar o snippet no `head` e apontar o `ENDPOINT` para o backend do `phishalert`.

## Implantação Em Produção

Checklist rápido:

1. Troque `ENDPOINT` pelo backend do `phishalert`.
2. Cole o snippet no `head` da página oficial de login.
3. Abra a página e confirme `POST /api/events` no DevTools.
