# Meu Painel (dashboard do consultor) — Design

Data: 2026-10-02 · Projeto: gerproj-solutii · Status: IMPLEMENTADO (aprovado pelo usuário: "Pode implementar", com a restrição "nada em SVG, usar os gráficos do TanStack"). Guia de uso e regras em docs/painel-consultor.txt.

## Objetivo
Dar ao consultor, dentro do próprio sistema de apontamentos, dados sobre o seu trabalho: o que já fez no mês contra a meta, o que está pendente, onde o tempo vai e como está sendo medido (SLA, validação/faturamento, avaliações). O painel ajuda a **agir** (lançar horas, resolver pendências), não só mostrar números.

## Premissas e restrições
- O consultor só vê os próprios dados (sessão; `exigirSessao`), nunca de outro consultor.
- Aba nova "Meu Painel" na Home (ao lado de Chamados e Tarefas).
- Gráficos com **`@tanstack/charts`** (0.18.0), renderizador **canvas** (`@tanstack/charts/react/canvas`). Nenhum SVG escrito à mão e nenhum SVG gerado (o padrão da biblioteca é SVG; o canvas atende a restrição). Trocar para SVG, se um dia quiserem, é só mudar o caminho do import.
- Única dependência nova: `@tanstack/charts`. Sem commit (regra do usuário).
- Somente leitura no banco.

## Dados encontrados no banco (verificados em 02/10/2026)
- `RECURSO.HRDIA_RECURSO` = "0848" (HHMM, 8h48/dia); `PERCPROD_RECURSO` = 100; `DTLIMITE_RECURSO`/`PERMAPO_RECURSO` = período para apontar.
- `OS`: `DTINI_OS`, `HRINI_OS`/`HRFIM_OS` (HHMM), `CODREC_OS`, `CHAMADO_OS` (nulo = OS de tarefa), `CODTRF_OS`. `PRODUTIVO_OS` é "SIM" em 100% das OS → **não usar**. `VALCLI_OS` = "o cliente concorda em pagar" (padrão "SIM"; "NAO" = **contestação** do cliente, feita no portal). `FATURADO_OS` = hora **faturável** (vem de `FATURA_TAREFA`), não "já faturada"; o faturamento efetivo é `COD_FATURAMENTO` preenchido.
- `CHAMADO`: `STATUS_CHAMADO`, `DTENVIO_CHAMADO` (texto "DD/MM/AAAA HH:MM"), `DTINI_CHAMADO`, `COD_CLIENTE`, `COD_CLASSIFICACAO`, `CODTRF_CHAMADO`, `AVALIA_CHAMADO` (**1 = não avaliado**; avaliações reais > 1), `OBSAVAL_CHAMADO`. `PRIOR_CHAMADO` é inconsistente → não usar.
- `HISTCHAMADO` (`DATA_HISTCHAMADO`, `HORA_HISTCHAMADO` HHMM, `DESC_HISTCHAMADO`): o evento `FINALIZADO` dá a data de finalização; pode haver mais de um → usar o mais recente.
- `TAREFA`: `LIMMES_TAREFA` (limite mensal, 0/nulo = sem limite), `HRREAL_TAREFA`, `PERIMP_TAREFA` ("SIM" = pode exceder), `SLA_TAREFA` (horas: 24, 8, 0 ou nulo).
- Não há tabela de feriados; a tabela `META` é de orçamento por projeto (irrelevante).

## Regras de cálculo
- **Horas apontadas** = soma de (HRFIM−HRINI) das OS do consultor no mês (por `DTINI_OS`).
- **Dias úteis** = segunda a sexta menos feriados nacionais (fixos: 01/01, 21/04, 01/05, 07/09, 12/10, 02/11, 15/11, 20/11, 25/12; móveis a partir da Páscoa: Carnaval seg+ter, Sexta-feira Santa, Corpus Christi). Feriados locais ficam de fora.
- **Meta do mês** = `HRDIA_RECURSO` em horas × dias úteis do mês. No mês corrente mostra também a **meta até hoje** (dias úteis até hoje, inclusive).
- **Dias sem apontamento** = dias úteis já passados (até ontem; o dia de hoje não conta, ainda dá tempo de lançar) sem nenhuma OS do consultor.
- **Chamados parados** = chamados não finalizados sem apontamento há mais de 7 dias corridos (última OS por `CHAMADO_OS`; se nunca houve OS, a idade conta de `DTINI_CHAMADO`, ou de `DTENVIO_CHAMADO` se não iniciado).
- **OS contestadas pelo cliente** = OS do mês com `VALCLI_OS` = "NAO" (data, horas, cliente) — o consultor precisa revisar.
- **Tarefas no limite** = tarefas do consultor (mesma regra da aba Tarefas: `CODREC_TAREFA`, status 1/2/3) com `LIMMES_TAREFA` > 0 e consumo do mês (todas as OS da tarefa, de todos os consultores — mesma conta das travas) ≥ 80% do limite; mais as que **bloqueiam** apontamento (`HRREAL_TAREFA` = 0 e `PERIMP_TAREFA` ≠ "SIM").
- **Onde o tempo vai** = horas do mês por cliente (top 8 + "Outros"), por tarefa/chamado (top 8) e por classificação; **evolução** dos últimos 6 meses (horas por mês × meta de cada mês).
- **Resultado**:
  - **SLA** dos chamados finalizados no mês: horas úteis (8h–18h, seg–sex, sem feriados) entre `DTENVIO_CHAMADO` e a finalização; cumpriu se ≤ `SLA_TAREFA` (chamados sem SLA ou com SLA 0 ficam fora). Mostra % no prazo, quantidade e tempo médio.
  - **Faturamento** das OS do mês: horas faturáveis × não faturáveis (`FATURADO_OS`) e quanto já foi efetivamente faturado (`COD_FATURAMENTO`).
  - **Avaliações**: média e quantidade dos chamados do consultor com `AVALIA_CHAMADO` > 1 (no ano), e os últimos comentários; sem avaliações → "Ainda sem avaliações".
- **Período**: linha informativa "você pode apontar a partir de dd/mm" (`DTLIMITE_RECURSO` quando `PERMAPO_RECURSO` = "SIM", senão ontem).

## API
`GET /api/painel?mes=AAAA-MM` (mês omitido = mês atual no fuso de Brasília). Sessão obrigatória; `mes` validado (`^\d{4}-(0[1-9]|1[0-2])$`, não futuro além do mês atual). Resposta (JSON) com os blocos `resumo`, `pendencias`, `tempo`, `resultado`. Erros internos → 500 genérico (`respostaErroInterno`).

## Arquitetura
- `src/utils/painel/*` — funções puras e testadas: `horas` (HHMM↔minutos), `feriados` (nacionais + Páscoa), `dias-uteis`, `horas-uteis` (SLA), `agregacoes` (por dia/cliente/tarefa/mês, top N + outros), `resumo` (meta, progresso), `periodo-mes` (limites do mês, mês anterior/próximo).
- `src/services/painel/index.ts` — consultas (apenas leitura) e montagem do resultado usando as funções puras.
- `src/app/api/painel/route.ts` — rota fina.
- `src/app/(pages)/home/_components/painel/*` — `PainelAba`, `SeletorMes`, `ResumoMes`, `Pendencias`, `TempoPorDia`, `TempoPorCliente`, `EvolucaoMensal`, `Resultado`; `src/components/graficos/*` — wrappers dos gráficos TanStack (canvas) com tema claro/escuro.
- Aba nova no estado da Home (`tab` ganha o valor `"painel"`).

## Tela
Seletor de mês (anterior/próximo; não passa do mês atual). Blocos: **Meu mês** (horas × meta, progresso, dias sem apontamento), **Pendências**, **Onde meu tempo vai** (barras por dia, barras horizontais por cliente, linha de evolução 6 meses), **Resultado**. Visual igual ao sistema (profundidade, modo escuro). Estados de carregando, vazio e erro. Todo valor mostrado também em texto (gráficos de canvas não são lidos por leitor de tela): cada gráfico tem `ariaLabel`/descrição e uma tabela/lista com os mesmos números ao lado ou abaixo.

## Testes e verificação
- Unitários das funções puras (feriados móveis, dias úteis, horas úteis, agregações, meta, validação de `mes`).
- Serviço com banco simulado (como `regras-apontamento.test.ts`).
- Rota: sessão obrigatória, `mes` inválido, resposta mapeada.
- Verificação real em navegador (Playwright), somente leitura, nos dois temas, sem erros no console; `tsc`, lint, `vitest` e `next build`.

## Ajustes feitos durante a implementação
- Os gráficos usam `@tanstack/charts/react/canvas` (o pacote `@tanstack/react-charts` é só para projetos antigos). Cor por barra via acessor `fill: (linha) => linha.cor`; uma única marca por gráfico (várias marcas bagunçavam a ordem do eixo); nomes repetidos nas barras horizontais ganham sufixo "(2)"; tooltip via `tooltip: { use: tooltip, format }` dentro do `defineChart`.
- Faturamento: `FATURADO_OS` é "faturável" e `COD_FATURAMENTO` indica o faturamento efetivo; `VALCLI_OS = "NAO"` é contestação do cliente e virou pendência ("OS contestadas").
- SLA entrou na primeira versão (finalização via `HISTCHAMADO`, SLA via `TAREFA.SLA_TAREFA`).

## Fora do escopo
Exportar, comparar consultores, editar metas, notificações, feriados locais, histórico de metas.
