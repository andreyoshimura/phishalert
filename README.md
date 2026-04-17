# phishalert

`phishalert` é uma ferramenta para monitorar páginas de phishing que redirecionam usuários para uma página real de login, capturar sinais de origem e automatizar alerta e takedown.

## Problema

Ataques de phishing nem sempre mantêm a vítima na página falsa. Em muitos casos, o atacante:

- clona a página de login
- coleta o clique ou a sessão
- redireciona a vítima para o site legítimo

Isso reduz a suspeita do usuário e dificulta a investigação. O objetivo do `phishalert` é registrar esses eventos e correlacionar a origem do acesso com a evidência da página maliciosa.

## Objetivos

- Detectar páginas falsas e domínios suspeitos
- Registrar origem de acesso e contexto de redirecionamento
- Correlacionar sinais entre página falsa e página oficial
- Gerar alertas automáticos
- Organizar evidências para takedown

## Estratégia

O sistema será dividido em quatro partes:

1. `collector`
   - recebe eventos da página oficial
   - registra `referrer`, IP, user-agent, horário e parâmetros de campanha

2. `detector`
   - monitora URLs, domínios e páginas suspeitas
   - identifica padrões de clone, redirect e impersonação

3. `correlator`
   - junta o evento do site oficial com a evidência coletada fora dele
   - tenta reconstruir a cadeia de ataque

4. `alerting`
   - envia alertas para e-mail, Slack, SIEM ou fila interna
   - cria dossiê para takedown

## Ambiente-alvo

O `phishalert` foi desenhado para ser implantado sem mexer na borda do site.

O padrão de adoção é:

- colar um snippet pequeno no `head` da página oficial
- enviar apenas metadados básicos de navegação
- evitar captura de credenciais
- manter o backend simples e previsível

Ele continua compatível com ambientes que usam ferramentas de segurança como `Veracode` e `Wiz`, mas isso não é um requisito para a implantação.

## MVP inicial

O primeiro recorte do projeto vai focar em:

- snippet leve para a página oficial, colado diretamente no `head`
- endpoint para receber eventos
- armazenamento de eventos e evidências
- regra simples de correlação por token, `referrer` e IP
- alerta básico quando um redirecionamento suspeito for identificado
- endpoint de casos correlacionados com score de risco
- heurísticas de origem suspeita por domínio, TLD e padrão de redirect
- snippet único e fácil de colar no `head` da página oficial, focado em `page_view`

## Rodando localmente

```bash
node src/server.js
```

Abra:

```text
http://localhost:3003
```

Endpoints úteis:

- `POST /api/events`
- `GET /api/events`
- `GET /api/cases`
- `GET /api/dossiers?min_risk=medium`

Veja o guia completo em [doc/como configurar](./doc/como%20configurar.md).
Veja também a análise de mercado em [docs/market-analysis](./docs/market-analysis.md).

## Implantação Rápida

1. Troque `ENDPOINT` pelo backend do `phishalert`.
2. Cole o snippet no `head` da página oficial de login.
3. Abra a página e confirme `POST /api/events` no DevTools.

Os dossiês exportados ficam em `data/dossiers/` como:

- `<dossier_id>.json`
- `<dossier_id>.md`

Cada dossiê também pode incluir contexto de rede e geo quando o WAF fornecer cabeçalhos confiáveis, como IP encaminhado, país, região, cidade, ASN e organização.
Esse contexto é opcional; o produto continua funcionando só com os sinais do navegador.

## Estrutura

- `src/`: implementação principal
- `docs/`: documentação técnica
- `tests/`: testes automatizados

## Princípios

- Preferir sinais verificáveis a suposições
- Registrar evidência com carimbo de tempo
- Evitar dependência de um único indicador
- Manter o sistema útil mesmo quando o `referrer` vier ausente
