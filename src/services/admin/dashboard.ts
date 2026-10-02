import { agoraNoFuso } from "@/utils/horario-futuro";
import { dataLocalISO } from "@/utils/regras-apontamento";
import { diasUteisDoMes, somarDias } from "@/utils/painel/dias-uteis";
import { duracaoOsMinutos, hhmmParaMinutos } from "@/utils/painel/horas";
import { limitesDoMes, mesAnterior, nomeDoMes } from "@/utils/painel/periodo";
import { minutosPorDia } from "@/utils/painel/agregacoes";
import { calcularResumoMes } from "@/utils/painel/resumo";
import { calcularProjecao } from "@/utils/painel/projecao";
import { minutosAteDiaUtil, variacaoPercentual } from "@/utils/painel/comparacao";
import { chamadoParado, diasSemAtividade } from "@/utils/painel/pendencias";
import { parseDataHora, resumirSla, type SlaAvaliado } from "@/utils/painel/sla";
import {
  contarPor,
  indiceDaSemana,
  lancamentoAtrasado,
  ordemDeUrgencia,
  percentual,
  permissaoParaRever,
  semanasTerminandoEm,
  situacaoDaTarefaNoDashboard,
} from "@/utils/admin-dashboard";
import type {
  BlocoDeChamados,
  BlocoDeQualidade,
  ChamadoAbertoNoDashboard,
  ChamadoParadoNoDashboard,
  ConsultorNoDashboard,
  DashboardResposta,
  TarefaNoDashboard,
  VisaoGeral,
} from "@/types/admin-dashboard";
import { abrirConexao, consultar, emBlocos, texto } from "../painel/db";
import { avaliarFinalizacao, ultimasFinalizacoes, type EventoDeFinalizacao } from "../painel/sla-chamados";
import { paraTarefaAdmin, SELECT as SELECT_TAREFA_ADMIN, STATUS_ATIVOS } from "./tarefas";

// Dashboard do administrador. SOMENTE LEITURA (só SELECT): nada é gravado no banco.
// Reaproveita as regras do Meu Painel (duração de OS, dias úteis, meta, comparação com
// o mês anterior, chamado parado e SLA) para os números baterem com os do consultor.

const BLOCO_IN = 200;
const TOP_N = 8;
const MAX_LISTA = 15;

type Linha = Record<string, any>;
type EventoComRecurso = EventoDeFinalizacao & { COD_RECURSO: unknown };

type OsDoDashboard = { recurso: number; data: string; minutos: number; lancadaEm: string | null; chamado: string; tarefa: number | null };

const ehAdm = (tipo: unknown) => texto(tipo).toUpperCase() === "ADM";

export async function montarDashboard(mes: string, agora: Date = new Date()): Promise<DashboardResposta> {
  const { data: hoje } = agoraNoFuso(agora);
  const ehMesAtual = mes === hoje.slice(0, 7);
  const { inicio, fim } = limitesDoMes(mes);
  const anterior = mesAnterior(mes);
  const limitesAnterior = limitesDoMes(anterior);
  // Semanas do gráfico: terminam hoje (mês atual) ou no último dia do mês (mês passado).
  const fimDaJanela = ehMesAtual ? hoje : fim;
  const semanas = semanasTerminandoEm(fimDaJanela);
  const inicioDaJanela = semanas[0].inicio < inicio ? semanas[0].inicio : inicio;
  // busca sempre até o dia seguinte (exclusive): não depende de a coluna ter hora
  const limiteDaBusca = somarDias(fimDaJanela, 1);

  const db = await abrirConexao();

  try {
    // ── Consultores (todos, para os nomes; o dashboard usa os ativos que não são ADM) ──
    const recursos: Linha[] = await consultar(
      db,
      `SELECT R.COD_RECURSO, R.NOME_RECURSO, R.ATIVO_RECURSO, R.HRDIA_RECURSO, R.PERMAPO_RECURSO, R.DTLIMITE_RECURSO, U.TIPO_USUARIO
         FROM RECURSO R
         LEFT JOIN USUARIO U ON U.COD_USUARIO = R.CODUSR_RECURSO
        ORDER BY R.NOME_RECURSO`,
    );
    const nomeDoRecurso = new Map(recursos.map((r) => [Number(r.COD_RECURSO), texto(r.NOME_RECURSO)]));
    const consultoresAtivos = recursos.filter((r) => Number(r.ATIVO_RECURSO) === 1 && !ehAdm(r.TIPO_USUARIO));
    const codigosAtivos = new Set(consultoresAtivos.map((r) => Number(r.COD_RECURSO)));

    // ── OS do mês e do mês anterior (todos os consultores, só as colunas necessárias) ──
    const osBruta: Linha[] = await consultar(
      db,
      `SELECT OS.CODREC_OS, OS.DTINI_OS, OS.DTINC_OS, OS.HRINI_OS, OS.HRFIM_OS, OS.CHAMADO_OS, OS.CODTRF_OS
         FROM OS
        WHERE OS.DTINI_OS >= ? AND OS.DTINI_OS <= ?`,
      [limitesAnterior.inicio, fim],
    );
    const osDoPeriodo: OsDoDashboard[] = osBruta.map((r) => ({
      recurso: Number(r.CODREC_OS),
      data: dataLocalISO(r.DTINI_OS),
      minutos: duracaoOsMinutos(r.HRINI_OS, r.HRFIM_OS),
      lancadaEm: r.DTINC_OS ? dataLocalISO(r.DTINC_OS) : null,
      chamado: texto(r.CHAMADO_OS),
      tarefa: r.CODTRF_OS === null || r.CODTRF_OS === undefined ? null : Number(r.CODTRF_OS),
    }));
    const osDoMes = osDoPeriodo.filter((o) => o.data >= inicio && o.data <= fim);
    const osDoMesAnterior = osDoPeriodo.filter((o) => o.data >= limitesAnterior.inicio && o.data <= limitesAnterior.fim);

    const agrupar = (lista: OsDoDashboard[]) => {
      const mapa = new Map<number, OsDoDashboard[]>();
      for (const o of lista) mapa.set(o.recurso, [...(mapa.get(o.recurso) ?? []), o]);

      return mapa;
    };
    const osMesPorRecurso = agrupar(osDoMes);
    const osAnteriorPorRecurso = agrupar(osDoMesAnterior);

    // ── Chamados finalizados (SLA do mês e concluídos por semana) ────────────
    const eventos = (await consultar(
      db,
      `SELECT H.COD_CHAMADO, H.DATA_HISTCHAMADO, H.HORA_HISTCHAMADO, C.DTENVIO_CHAMADO, C.COD_RECURSO, T.SLA_TAREFA
         FROM HISTCHAMADO H
         JOIN CHAMADO C ON C.COD_CHAMADO = H.COD_CHAMADO
         LEFT JOIN TAREFA T ON T.COD_TAREFA = C.CODTRF_CHAMADO
        WHERE H.DESC_HISTCHAMADO = 'FINALIZADO' AND C.STATUS_CHAMADO = 'FINALIZADO'
          AND H.DATA_HISTCHAMADO >= ? AND H.DATA_HISTCHAMADO < ?`,
      [inicioDaJanela, limiteDaBusca],
    )) as EventoComRecurso[];
    // Mesmo critério do Meu Painel: dentro do mês, vale a finalização mais recente.
    const eventosDoMes = eventos.filter((e) => {
      const d = dataLocalISO(e.DATA_HISTCHAMADO);

      return d >= inicio && d <= fim;
    });
    const finalizadosDoMes = ultimasFinalizacoes(eventosDoMes);
    const slaPorRecurso = new Map<number, SlaAvaliado[]>();
    const finalizadosPorRecurso = new Map<number, number>();
    for (const [cod, e] of finalizadosDoMes) {
      const recurso = Number(e.COD_RECURSO);
      finalizadosPorRecurso.set(recurso, (finalizadosPorRecurso.get(recurso) ?? 0) + 1);

      const avaliado = avaliarFinalizacao(cod, e);
      if (avaliado) slaPorRecurso.set(recurso, [...(slaPorRecurso.get(recurso) ?? []), avaliado]);
    }

    // ── Chamados abertos (parados, por status e por consultor) ───────────────
    const abertos: Linha[] = await consultar(
      db,
      `SELECT C.COD_CHAMADO, C.ASSUNTO_CHAMADO, C.STATUS_CHAMADO, C.COD_RECURSO, C.DTENVIO_CHAMADO, C.DTINI_CHAMADO, CLIENTE.NOME_CLIENTE
         FROM CHAMADO C
         LEFT JOIN CLIENTE ON CLIENTE.COD_CLIENTE = C.COD_CLIENTE
        WHERE C.STATUS_CHAMADO <> ?`,
      ["FINALIZADO"],
    );
    const ultimaOsPorChamado = new Map<string, string>();
    for (const bloco of emBlocos(abertos.map((c) => String(c.COD_CHAMADO)), BLOCO_IN)) {
      for (const r of await consultar(
        db,
        `SELECT CHAMADO_OS, MAX(DTINI_OS) AS ULTIMA FROM OS WHERE CHAMADO_OS IN (${bloco.map(() => "?").join(",")}) GROUP BY CHAMADO_OS`,
        bloco,
      )) {
        if (texto(r.CHAMADO_OS) && r.ULTIMA) ultimaOsPorChamado.set(texto(r.CHAMADO_OS), dataLocalISO(r.ULTIMA));
      }
    }

    const chamadosAbertosPorRecurso = new Map<number, number>();
    for (const c of abertos) {
      const recurso = Number(c.COD_RECURSO);
      chamadosAbertosPorRecurso.set(recurso, (chamadosAbertosPorRecurso.get(recurso) ?? 0) + 1);
    }

    const paradosTodos: ChamadoParadoNoDashboard[] = abertos
      .map((c) => {
        const candidatas = [
          ultimaOsPorChamado.get(String(c.COD_CHAMADO)),
          c.DTINI_CHAMADO ? dataLocalISO(c.DTINI_CHAMADO) : undefined,
          parseDataHora(texto(c.DTENVIO_CHAMADO))?.data,
        ].filter((d): d is string => !!d);

        return { c, ultima: candidatas.sort().at(-1) };
      })
      .filter(({ ultima }) => !!ultima && chamadoParado(ultima, hoje))
      .map(({ c, ultima }) => ({
        codChamado: Number(c.COD_CHAMADO),
        assunto: texto(c.ASSUNTO_CHAMADO),
        cliente: texto(c.NOME_CLIENTE) || "Sem cliente",
        consultor: nomeDoRecurso.get(Number(c.COD_RECURSO)) ?? "Sem consultor",
        status: texto(c.STATUS_CHAMADO),
        diasParado: diasSemAtividade(ultima as string, hoje),
      }))
      .sort((a, b) => b.diasParado - a.diasParado);

    const contagemStatus = new Map<string, number>();
    for (const c of abertos) contagemStatus.set(texto(c.STATUS_CHAMADO), (contagemStatus.get(texto(c.STATUS_CHAMADO)) ?? 0) + 1);
    const abertosPorStatus = [...contagemStatus.entries()]
      .map(([status, quantidade]) => ({ status, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade);

    // ── Chamados abertos no período: por semana, por cliente e por área ──────
    const chamadosDaJanela: Linha[] = await consultar(
      db,
      `SELECT C.COD_CHAMADO, C.DATA_CHAMADO, C.COD_CLIENTE, CLIENTE.NOME_CLIENTE, C.COD_AREA, AREA.NOME_AREA
         FROM CHAMADO C
         LEFT JOIN CLIENTE ON CLIENTE.COD_CLIENTE = C.COD_CLIENTE
         LEFT JOIN AREA ON AREA.COD_AREA = C.COD_AREA
        WHERE C.DATA_CHAMADO >= ? AND C.DATA_CHAMADO < ?`,
      [inicioDaJanela, limiteDaBusca],
    );
    const semanasComContagem = semanas.map((s) => ({ ...s, abertos: 0, concluidos: 0 }));
    const chamadosDoMes: Linha[] = [];
    for (const c of chamadosDaJanela) {
      const data = dataLocalISO(c.DATA_CHAMADO);
      const i = indiceDaSemana(semanas, data);
      if (i >= 0) semanasComContagem[i].abertos++;
      if (data >= inicio && data <= fim) chamadosDoMes.push(c);
    }
    for (const [, e] of ultimasFinalizacoes(eventos)) {
      const i = indiceDaSemana(semanas, dataLocalISO(e.DATA_HISTCHAMADO));
      if (i >= 0) semanasComContagem[i].concluidos++;
    }

    // lista dos chamados abertos (a que abre ao clicar no badge de uma situação), do mais antigo para o mais novo
    const abertosLista: ChamadoAbertoNoDashboard[] = abertos
      .map((c) => ({
        codChamado: Number(c.COD_CHAMADO),
        assunto: texto(c.ASSUNTO_CHAMADO),
        cliente: texto(c.NOME_CLIENTE) || "Sem cliente",
        consultor: nomeDoRecurso.get(Number(c.COD_RECURSO)) ?? "Sem consultor",
        status: texto(c.STATUS_CHAMADO),
      }))
      .sort((a, b) => a.codChamado - b.codChamado);

    const blocoChamados: BlocoDeChamados = {
      abertosPorStatus,
      abertos: abertosLista,
      // todos os parados (a tela mostra 10 e expande para a lista inteira, com ordenação)
      parados: paradosTodos,
      totalParados: paradosTodos.length,
      porCliente: contarPor(chamadosDoMes, (c) => String(c.COD_CLIENTE ?? "0"), (c) => texto(c.NOME_CLIENTE) || "Sem cliente", TOP_N),
      porArea: contarPor(chamadosDoMes, (c) => String(c.COD_AREA ?? "sem"), (c) => texto(c.NOME_AREA) || "Sem área", TOP_N),
      semanas: semanasComContagem,
    };

    // ── Consultores: horas, meta, regularidade, chamados e lançamentos ───────
    const diasUteisDoPeriodo = diasUteisDoMes(mes);
    const diasUteisPassados = diasUteisDoPeriodo.filter((d) => d < hoje);
    const consultores: ConsultorNoDashboard[] = consultoresAtivos.map((r) => {
      const codigo = Number(r.COD_RECURSO);
      const jornadaDiariaMin = hhmmParaMinutos(r.HRDIA_RECURSO);
      const doMes = osMesPorRecurso.get(codigo) ?? [];
      const doMesAnterior = osAnteriorPorRecurso.get(codigo) ?? [];

      const porDia = minutosPorDia(mes, doMes);
      const resumo = calcularResumoMes({ mes, hoje, jornadaDiariaMin, porDia });
      const projecao = ehMesAtual
        ? calcularProjecao({ mes, hoje, metaMesMin: resumo.metaMesMin, horasApontadasMin: resumo.horasApontadasMin, porDia })
        : null;
      const horasMesAnteriorMin = minutosAteDiaUtil(anterior, minutosPorDia(anterior, doMesAnterior), projecao?.diasDecorridos ?? null);

      const minutosDoDia = new Map(porDia.map((d) => [d.data, d.minutos]));
      const sla = resumirSla(slaPorRecurso.get(codigo) ?? []);
      const comDataDeLancamento = doMes.filter((o) => o.lancadaEm);

      return {
        codigo,
        nome: texto(r.NOME_RECURSO),
        jornadaDiariaMin,
        horasMin: resumo.horasApontadasMin,
        metaMesMin: resumo.metaMesMin,
        metaAteHojeMin: resumo.metaAteHojeMin,
        percentualMeta: resumo.percentualMeta,
        percentualMetaAteHoje: resumo.percentualMetaAteHoje,
        horasMesAnteriorMin,
        variacao: variacaoPercentual(resumo.horasApontadasMin, horasMesAnteriorMin),
        osQtd: doMes.length,
        diasBateuJornada: jornadaDiariaMin > 0 ? diasUteisPassados.filter((d) => (minutosDoDia.get(d) ?? 0) >= jornadaDiariaMin).length : 0,
        diasUteisPassados: diasUteisPassados.length,
        diasSemApontamento: resumo.diasSemApontamento,
        chamadosAtendidos: new Set(doMes.map((o) => o.chamado).filter(Boolean)).size,
        chamadosAbertos: chamadosAbertosPorRecurso.get(codigo) ?? 0,
        chamadosFinalizados: finalizadosPorRecurso.get(codigo) ?? 0,
        sla: { total: sla.total, noPrazo: sla.noPrazo, percentualNoPrazo: sla.percentualNoPrazo, tempoMedioHoras: sla.tempoMedioHoras },
        lancamentosAtrasados: comDataDeLancamento.filter((o) => lancamentoAtrasado(o.data, o.lancadaEm as string)).length,
        lancamentosComData: comDataDeLancamento.length,
      };
    });

    // ── Tarefas: perto de estourar e com estouro liberado ────────────────────
    const consumoPorTarefa = new Map<number, number>();
    for (const o of osDoMes) if (o.tarefa !== null) consumoPorTarefa.set(o.tarefa, (consumoPorTarefa.get(o.tarefa) ?? 0) + o.minutos);

    const tarefasLidas = new Map<number, Linha>();
    for (const bloco of emBlocos([...consumoPorTarefa.keys()], BLOCO_IN)) {
      for (const t of await consultar(db, `${SELECT_TAREFA_ADMIN} WHERE T.COD_TAREFA IN (${bloco.map(() => "?").join(",")})`, bloco)) {
        tarefasLidas.set(Number(t.COD_TAREFA), t);
      }
    }
    for (const t of await consultar(db, `${SELECT_TAREFA_ADMIN} WHERE T.STATUS_TAREFA IN (${STATUS_ATIVOS.join(", ")}) AND T.PERIMP_TAREFA = 'SIM'`)) {
      tarefasLidas.set(Number(t.COD_TAREFA), t);
    }

    const emRiscoTodas: TarefaNoDashboard[] = [];
    const liberadasTodas: TarefaNoDashboard[] = [];
    for (const [codigo, linha] of tarefasLidas) {
      const tarefa = paraTarefaAdmin(linha);
      const consumoMesMin = consumoPorTarefa.get(codigo) ?? 0;
      const situacao = situacaoDaTarefaNoDashboard({ limiteMensalHoras: tarefa.limiteMensalHoras, consumoMesMin, permiteExceder: tarefa.permiteExceder });
      if (!situacao) continue;

      const item: TarefaNoDashboard = { tarefa, consumoMesMin, ...situacao };
      if (situacao.situacao === "liberada") {
        // estouro liberado de tarefa que já nem está em andamento e sem uso no mês não interessa
        if (STATUS_ATIVOS.includes(tarefa.status) || consumoMesMin > 0) liberadasTodas.push(item);
      } else {
        emRiscoTodas.push(item);
      }
    }
    emRiscoTodas.sort(ordemDeUrgencia);
    liberadasTodas.sort(ordemDeUrgencia);

    // ── Qualidade dos apontamentos ───────────────────────────────────────────
    const qualidade: BlocoDeQualidade = {
      diasSemApontamento: consultores
        .filter((c) => c.diasSemApontamento.length > 0)
        .map((c) => ({ codigo: c.codigo, nome: c.nome, quantidade: c.diasSemApontamento.length, dias: c.diasSemApontamento }))
        .sort((a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome, "pt-BR")),
      permissoesAntigas: consultoresAtivos
        .flatMap((r) => {
          const dataLimite = r.DTLIMITE_RECURSO ? dataLocalISO(r.DTLIMITE_RECURSO) : null;
          const rever = permissaoParaRever(texto(r.PERMAPO_RECURSO).toUpperCase() === "SIM", dataLimite, hoje);

          return rever ? [{ codigo: Number(r.COD_RECURSO), nome: texto(r.NOME_RECURSO), dataLimite, diasDesdeLimite: rever.diasDesdeLimite }] : [];
        })
        .sort((a, b) => (b.diasDesdeLimite ?? Number.MAX_SAFE_INTEGER) - (a.diasDesdeLimite ?? Number.MAX_SAFE_INTEGER)),
      lancamentosAtrasados: consultores
        .filter((c) => c.lancamentosAtrasados > 0)
        .map((c) => ({ codigo: c.codigo, nome: c.nome, atrasados: c.lancamentosAtrasados, total: c.lancamentosComData, percentual: percentual(c.lancamentosAtrasados, c.lancamentosComData) ?? 0 }))
        .sort((a, b) => b.percentual - a.percentual || b.atrasados - a.atrasados),
    };

    // ── Visão geral ──────────────────────────────────────────────────────────
    const soma = (f: (c: ConsultorNoDashboard) => number) => consultores.reduce((s, c) => s + f(c), 0);
    const horasMin = soma((c) => c.horasMin);
    const metaMesMin = soma((c) => c.metaMesMin);
    const horasMesAnteriorMin = soma((c) => c.horasMesAnteriorMin);
    const visao: VisaoGeral = {
      consultoresAtivos: consultores.length,
      horasMin,
      metaMesMin,
      metaAteHojeMin: soma((c) => c.metaAteHojeMin),
      percentualMeta: percentual(horasMin, metaMesMin),
      horasMesAnteriorMin,
      variacao: variacaoPercentual(horasMin, horasMesAnteriorMin),
      consultoresComPendencia: consultores.filter((c) => c.diasSemApontamento.length > 0).length,
      chamadosAbertos: abertos.length,
      chamadosParados: paradosTodos.length,
      chamadosFinalizadosNoMes: finalizadosDoMes.size,
      tarefasEmRisco: emRiscoTodas.length,
      tarefasComEstouroLiberado: liberadasTodas.length,
    };

    return {
      mes,
      nomeMes: nomeDoMes(mes),
      hoje,
      ehMesAtual,
      geradoEm: agora.toISOString(),
      visao,
      consultores,
      tarefas: { emRisco: emRiscoTodas.slice(0, MAX_LISTA), comEstouroLiberado: liberadasTodas.slice(0, MAX_LISTA) },
      chamados: blocoChamados,
      qualidade,
    };
  } finally {
    db.detach();
  }
}

