# AGENTS.md

## Contexto

Este repositório implementa um sistema de detecção e resposta para páginas de phishing que redirecionam usuários para a página real de login.

## Objetivo do projeto

- Capturar sinais de origem em acessos ao site oficial
- Correlacionar esses sinais com páginas suspeitas observadas fora do site
- Disparar alerta quando houver evidência de redirecionamento malicioso
- Preparar material para takedown

## Regras de trabalho

- Não assumir que `referrer` estará sempre presente.
- Tratar token, `referrer`, IP, user-agent, horário e cadeia de redirect como sinais complementares.
- Priorizar implementações pequenas e verificáveis.
- Preferir estruturas simples no começo, com evolução por módulos.
- Não remover alterações do usuário ou de outros agentes sem necessidade explícita.

## Convenções

- Código novo deve ser ASCII por padrão.
- Comentários devem ser curtos e só quando ajudarem a entender lógica não óbvia.
- Novos arquivos devem seguir nomes curtos e descritivos.

## Ordem sugerida de implementação

1. Definir o modelo de evento
2. Criar o endpoint de ingestão
3. Criar o snippet do site oficial
4. Implementar correlação básica
5. Adicionar alerta e dossiê

