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

## MVP inicial

O primeiro recorte do projeto vai focar em:

- snippet leve para a página oficial
- endpoint para receber eventos
- armazenamento de eventos e evidências
- regra simples de correlação por token, `referrer` e IP
- alerta básico quando um redirecionamento suspeito for identificado

## Rodando localmente

```bash
node src/server.js
```

Abra:

```text
http://localhost:3001
```

## Estrutura

- `src/`: implementação principal
- `docs/`: documentação técnica
- `tests/`: testes automatizados

## Princípios

- Preferir sinais verificáveis a suposições
- Registrar evidência com carimbo de tempo
- Evitar dependência de um único indicador
- Manter o sistema útil mesmo quando o `referrer` vier ausente
