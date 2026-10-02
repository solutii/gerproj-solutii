import { agoraNoFuso } from "@/utils/horario-futuro";
import { dataLocalISO, dataMinimaPermitida } from "@/utils/regras-apontamento";
import { diasEntre, diasUteisDoMes, ehDiaUtil } from "@/utils/painel/dias-uteis";
import { duracaoOsMinutos, hhmmParaMinutos } from "@/utils/painel/horas";
import {
  limitesDoMes,
  mesAnterior,
  nomeDoMes,
  rotuloCurtoDoMes,
  ultimosMeses,
} from "@/utils/painel/periodo";
import { minutosPorDia, somarPorChave, topComOutros } from "@/utils/painel/agregacoes";
import { calcularResumoMes } from "@/utils/painel/resumo";
import { chamadoParado, diasSemAtividade, situacaoDaTarefa } from "@/utils/painel/pendencias";
import { calcularProjecao } from "@/utils/painel/projecao";
import { horariosLivres, intervalosDasOs, minutosParaHHMM } from "@/utils/painel/agenda";
import { minutosAteDiaUtil, variacaoPercentual } from "@/utils/painel/comparacao";
import { parseDataHora, resumirSla, type SlaAvaliado } from "@/utils/painel/sla";
import type {
  Avaliacao,
  BlocoChamados,
  BlocoHoje,
  ChamadoAberto,
  ChamadoAguardando,
  ChamadoParado,
  Comparacao,
  EvolucaoMes,
  OsContestada,
  PainelResposta,
  TarefaAndamento,
  TarefaEmAlerta,
} from "@/types/painel";
import { abrirConexao, consultar, emBlocos, lerTexto, texto, type Db } from "./db";
import { avaliarFinalizacao, ultimasFinalizacoes } from "./sla-chamados";

const TOP_N = 8;
const MAX_PENDENCIAS = 10;
const MAX_LISTA = 5;
const BLOCO_IN = 200;
const MESES_EVOLUCAO = 6;

// Ordem em que os status aparecem nos contadores de chamados.
const ORDEM_STATUS = ["ATRIBUIDO", "EM ATENDIMENTO", "STANDBY", "AGUARDANDO VALIDACAO"];

// SLA dos chamados finalizados no mês (finalização = evento mais recente no histórico).
async function calcularSlaDoMes(db: Db, recurso: number, mes: string) {
  const { inicio, fim } = limitesDoMes(mes);

  const eventos = await consultar(
    db,
    `SELECT H.COD_CHAMADO, H.DATA_HISTCHAMADO, H.HORA_HISTCHAMADO, C.DTENVIO_CHAMADO, T.SLA_TAREFA
       FROM HISTCHAMADO H
       JOIN CHAMADO C ON C.COD_CHAMADO = H.COD_CHAMADO
       LEFT JOIN TAREFA T ON T.COD_TAREFA = C.CODTRF_CHAMADO
      WHERE H.DESC_HISTCHAMADO = 'FINALIZADO' AND C.COD_RECURSO = ? AND C.STATUS_CHAMADO = 'FINALIZADO'
        AND H.DATA_HISTCHAMADO >= ? AND H.DATA_HISTCHAMADO <= ?`,
    [recurso, inicio, fim],
  );

  // um chamado pode ter mais de um evento FINALIZADO: vale o mais recente
  const avaliados: SlaAvaliado[] = [];
  for (const [cod, e] of ultimasFinalizacoes(eventos)) {
    const avaliado = avaliarFinalizacao(cod, e);
    if (avaliado) avaliados.push(avaliado);
  }

  return resumirSla(avaliados);
}

// Monta o painel do consultor `recurso` para o mês `mes` ("AAAA-MM"). Só leitura.
export async function montarPainel(
  recurso: number,
  mes: string,
  agora: Date = new Date(),
): Promise<PainelResposta> {
  const { data: hoje, hora: horaAgora } = agoraNoFuso(agora);
  const mesCorrente = hoje.slice(0, 7);
  const ehMesAtual = mes === mesCorrente;
  const { inicio, fim } = limitesDoMes(mes);
  const mesesEvolucao = ultimosMeses(mes, MESES_EVOLUCAO);
  const anterior = mesAnterior(mes);

  const db = await abrirConexao();

  try {
    // ── Consultor ─────────────────────────────────────────────────────────
    const [rec] = await consultar(
      db,
      "SELECT HRDIA_RECURSO, DTLIMITE_RECURSO, PERMAPO_RECURSO FROM RECURSO WHERE COD_RECURSO = ?",
      [recurso],
    );
    const jornadaDiariaMin = hhmmParaMinutos(rec?.HRDIA_RECURSO);
    const apontarAPartirDe = dataMinimaPermitida(
      texto(rec?.PERMAPO_RECURSO).toUpperCase() === "SIM",
      rec?.DTLIMITE_RECURSO,
      hoje,
    );

    // ── OS do mês (com cliente, tarefa e classificação) ───────────────────
    const osDoMes = (
      await consultar(
        db,
        `SELECT OS.COD_OS, OS.DTINI_OS, OS.HRINI_OS, OS.HRFIM_OS, OS.CHAMADO_OS, OS.CODTRF_OS,
                OS.VALCLI_OS, OS.FATURADO_OS, OS.COD_FATURAMENTO,
                TAREFA.NOME_TAREFA, CLIENTE.COD_CLIENTE, CLIENTE.NOME_CLIENTE,
                CLASSIFICACAO.NOME_CLASSIFICACAO
           FROM OS
           LEFT JOIN CHAMADO ON (OS.CHAMADO_OS = CHAMADO.COD_CHAMADO)
           LEFT JOIN CLASSIFICACAO ON (CLASSIFICACAO.COD_CLASSIFICACAO = CHAMADO.COD_CLASSIFICACAO)
           LEFT JOIN TAREFA ON (TAREFA.COD_TAREFA = OS.CODTRF_OS)
           LEFT JOIN PROJETO ON (PROJETO.COD_PROJETO = TAREFA.CODPRO_TAREFA)
           LEFT JOIN CLIENTE ON (CLIENTE.COD_CLIENTE = PROJETO.CODCLI_PROJETO)
          WHERE OS.CODREC_OS = ? AND OS.DTINI_OS >= ? AND OS.DTINI_OS <= ?`,
        [recurso, inicio, fim],
      )
    ).map((r) => ({
      codOs: Number(r.COD_OS),
      data: dataLocalISO(r.DTINI_OS),
      minutos: duracaoOsMinutos(r.HRINI_OS, r.HRFIM_OS),
      cliente: texto(r.NOME_CLIENTE) || "Sem cliente",
      clienteId: String(r.COD_CLIENTE ?? "0"),
      tarefa: texto(r.NOME_TAREFA) || "Sem tarefa",
      tarefaId: String(r.CODTRF_OS ?? "0"),
      classificacao: texto(r.CHAMADO_OS) ? texto(r.NOME_CLASSIFICACAO) || "Sem classificação" : "Tarefa (sem chamado)",
      faturavel: texto(r.FATURADO_OS).toUpperCase() === "SIM",
      faturada: Number(r.COD_FATURAMENTO ?? 0) > 0,
      contestada: texto(r.VALCLI_OS).toUpperCase() === "NAO",
    }));

    const porDia = minutosPorDia(mes, osDoMes);
    const resumo = calcularResumoMes({ mes, hoje, jornadaDiariaMin, porDia });
    const projecao = ehMesAtual
      ? calcularProjecao({
          mes,
          hoje,
          metaMesMin: resumo.metaMesMin,
          horasApontadasMin: resumo.horasApontadasMin,
          porDia,
        })
      : null;

    const tempo = {
      porDia,
      porCliente: topComOutros(somarPorChave(osDoMes, (o) => o.clienteId, (o) => o.cliente, (o) => o.minutos), TOP_N),
      porTarefa: topComOutros(somarPorChave(osDoMes, (o) => o.tarefaId, (o) => o.tarefa, (o) => o.minutos), TOP_N),
      porClassificacao: topComOutros(
        somarPorChave(osDoMes, (o) => o.classificacao, (o) => o.classificacao, (o) => o.minutos),
        TOP_N,
      ),
    };

    const faturamento = {
      faturavelMin: osDoMes.filter((o) => o.faturavel).reduce((s, o) => s + o.minutos, 0),
      naoFaturavelMin: osDoMes.filter((o) => !o.faturavel).reduce((s, o) => s + o.minutos, 0),
      faturadoMin: osDoMes.filter((o) => o.faturada).reduce((s, o) => s + o.minutos, 0),
    };

    const osContestadas: OsContestada[] = osDoMes
      .filter((o) => o.contestada)
      .sort((a, b) => (a.data < b.data ? 1 : -1))
      .slice(0, MAX_PENDENCIAS)
      .map((o) => ({ codOs: o.codOs, data: o.data, minutos: o.minutos, cliente: o.cliente }));

    // ── Hoje: o que foi lançado e onde ainda cabe apontamento ─────────────
    const osHoje = await consultar(
      db,
      `SELECT OS.COD_OS, OS.HRINI_OS, OS.HRFIM_OS, CLIENTE.NOME_CLIENTE, TAREFA.NOME_TAREFA
         FROM OS
         LEFT JOIN TAREFA ON (TAREFA.COD_TAREFA = OS.CODTRF_OS)
         LEFT JOIN PROJETO ON (PROJETO.COD_PROJETO = TAREFA.CODPRO_TAREFA)
         LEFT JOIN CLIENTE ON (CLIENTE.COD_CLIENTE = PROJETO.CODCLI_PROJETO)
        WHERE OS.CODREC_OS = ? AND OS.DTINI_OS = ?
        ORDER BY OS.HRINI_OS`,
      [recurso, hoje],
    );
    const minutosHoje = osHoje.reduce((s, r) => s + duracaoOsMinutos(r.HRINI_OS, r.HRFIM_OS), 0);
    const hojeBloco: BlocoHoje = {
      data: hoje,
      ehDiaUtil: ehDiaUtil(hoje),
      agora: horaAgora,
      osDeHoje: osHoje.map((r) => ({
        codOs: Number(r.COD_OS),
        inicio: minutosParaHHMM(hhmmParaMinutos(r.HRINI_OS)),
        fim: minutosParaHHMM(hhmmParaMinutos(r.HRFIM_OS)),
        minutos: duracaoOsMinutos(r.HRINI_OS, r.HRFIM_OS),
        cliente: texto(r.NOME_CLIENTE) || "Sem cliente",
        tarefa: texto(r.NOME_TAREFA) || "Sem tarefa",
      })),
      minutosHoje,
      faltaJornadaMin: Math.max(0, jornadaDiariaMin - minutosHoje),
      livres: horariosLivres(intervalosDasOs(osHoje), hhmmParaMinutos(horaAgora)).map((i) => ({
        inicio: minutosParaHHMM(i.inicio),
        fim: minutosParaHHMM(i.fim),
        minutos: i.fim - i.inicio,
      })),
    };

    // ── Evolução e comparação (janela dos últimos meses) ──────────────────
    const osJanela = (
      await consultar(
        db,
        "SELECT DTINI_OS, HRINI_OS, HRFIM_OS FROM OS WHERE CODREC_OS = ? AND DTINI_OS >= ? AND DTINI_OS <= ?",
        [recurso, limitesDoMes(mesesEvolucao[0]).inicio, fim],
      )
    ).map((r) => ({ data: dataLocalISO(r.DTINI_OS), minutos: duracaoOsMinutos(r.HRINI_OS, r.HRFIM_OS) }));

    const minutosDoMes = new Map<string, number>();
    for (const r of osJanela) {
      const m = r.data.slice(0, 7);
      minutosDoMes.set(m, (minutosDoMes.get(m) ?? 0) + r.minutos);
    }
    const evolucao: EvolucaoMes[] = mesesEvolucao.map((m) => ({
      mes: m,
      rotulo: rotuloCurtoDoMes(m),
      minutos: minutosDoMes.get(m) ?? 0,
      metaMin: jornadaDiariaMin * diasUteisDoMes(m).length,
    }));

    // Mês em andamento: compara com o MESMO ponto do mês anterior (mesmo nº de dias úteis).
    const diasParaComparar = ehMesAtual ? (projecao?.diasDecorridos ?? 0) : null;
    const osDoMesAnterior = osJanela.filter((r) => r.data.startsWith(anterior));
    const osDoMesAtual = osJanela.filter((r) => r.data.startsWith(mes));
    const horasAnteriorMin = minutosAteDiaUtil(anterior, minutosPorDia(anterior, osDoMesAnterior), diasParaComparar);
    const horasAtualMin = resumo.horasApontadasMin;
    const contagem = (mesRef: string, linhas: { data: string }[]) =>
      minutosAteDiaUtil(mesRef, minutosPorDia(mesRef, linhas.map((l) => ({ data: l.data, minutos: 1 }))), diasParaComparar);
    const osAnterior = contagem(anterior, osDoMesAnterior);
    const osAtual = osDoMesAtual.length;
    const slaDoMes = await calcularSlaDoMes(db, recurso, mes);
    const slaAnterior = await calcularSlaDoMes(db, recurso, anterior);

    const comparacao: Comparacao = {
      mesAnterior: anterior,
      nomeMesAnterior: nomeDoMes(anterior),
      mesmoPeriodo: ehMesAtual,
      horas: { atualMin: horasAtualMin, anteriorMin: horasAnteriorMin, variacao: variacaoPercentual(horasAtualMin, horasAnteriorMin) },
      os: { atual: osAtual, anterior: osAnterior, variacao: variacaoPercentual(osAtual, osAnterior) },
      sla: { atualPercentual: slaDoMes.percentualNoPrazo, anteriorPercentual: slaAnterior.percentualNoPrazo },
    };

    // ── Chamados abertos: parados, por status e aguardando validação ──────
    const abertos = await consultar(
      db,
      `SELECT CHAMADO.COD_CHAMADO, CHAMADO.ASSUNTO_CHAMADO, CHAMADO.STATUS_CHAMADO, CHAMADO.DTENVIO_CHAMADO,
              CHAMADO.DTINI_CHAMADO, CHAMADO.CODTRF_CHAMADO, CLIENTE.NOME_CLIENTE
         FROM CHAMADO
         LEFT JOIN CLIENTE ON CLIENTE.COD_CLIENTE = CHAMADO.COD_CLIENTE
        WHERE CHAMADO.COD_RECURSO = ? AND CHAMADO.STATUS_CHAMADO <> ?`,
      [recurso, "FINALIZADO"],
    );
    const ultimaOsPorChamado = new Map<string, string>();
    for (const r of await consultar(
      db,
      "SELECT CHAMADO_OS, MAX(DTINI_OS) AS ULTIMA FROM OS WHERE CODREC_OS = ? AND CHAMADO_OS IS NOT NULL GROUP BY CHAMADO_OS",
      [recurso],
    )) {
      if (texto(r.CHAMADO_OS) && r.ULTIMA) ultimaOsPorChamado.set(texto(r.CHAMADO_OS), dataLocalISO(r.ULTIMA));
    }

    const chamadosParados: ChamadoParado[] = abertos
      .map((c) => {
        const candidatas = [
          ultimaOsPorChamado.get(String(c.COD_CHAMADO)),
          c.DTINI_CHAMADO ? dataLocalISO(c.DTINI_CHAMADO) : undefined,
          parseDataHora(c.DTENVIO_CHAMADO)?.data,
        ].filter((d): d is string => !!d);
        const ultima = candidatas.sort().at(-1);

        return { c, ultima };
      })
      .filter(({ ultima }) => !!ultima && chamadoParado(ultima, hoje))
      .map(({ c, ultima }) => ({
        codChamado: Number(c.COD_CHAMADO),
        assunto: texto(c.ASSUNTO_CHAMADO),
        cliente: texto(c.NOME_CLIENTE) || "Sem cliente",
        status: texto(c.STATUS_CHAMADO),
        diasParado: diasSemAtividade(ultima as string, hoje),
      }))
      .sort((a, b) => b.diasParado - a.diasParado)
      .slice(0, MAX_PENDENCIAS);

    const contagemStatus = new Map<string, number>();
    for (const c of abertos) {
      const s = texto(c.STATUS_CHAMADO);
      contagemStatus.set(s, (contagemStatus.get(s) ?? 0) + 1);
    }
    const porStatus = [...contagemStatus.entries()]
      .map(([status, quantidade]) => ({ status, quantidade }))
      .sort((a, b) => {
        const ia = ORDEM_STATUS.indexOf(a.status);
        const ib = ORDEM_STATUS.indexOf(b.status);

        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      });

    const maisAntigos: ChamadoAberto[] = abertos
      .map((c) => ({
        codChamado: Number(c.COD_CHAMADO),
        assunto: texto(c.ASSUNTO_CHAMADO),
        cliente: texto(c.NOME_CLIENTE) || "Sem cliente",
        status: texto(c.STATUS_CHAMADO),
        diasAberto: Math.max(0, diasEntre(parseDataHora(c.DTENVIO_CHAMADO)?.data ?? hoje, hoje)),
      }))
      .sort((a, b) => b.diasAberto - a.diasAberto)
      .slice(0, MAX_LISTA);

    // Há quanto tempo cada chamado "aguardando validação" está nesse status
    // (último evento desse status no histórico).
    const aguardando = abertos.filter((c) => texto(c.STATUS_CHAMADO) === "AGUARDANDO VALIDACAO");
    const desdePorChamado = new Map<number, string>();
    for (const bloco of emBlocos(aguardando.map((c) => Number(c.COD_CHAMADO)), BLOCO_IN)) {
      for (const r of await consultar(
        db,
        `SELECT COD_CHAMADO, MAX(DATA_HISTCHAMADO) AS DESDE FROM HISTCHAMADO
          WHERE DESC_HISTCHAMADO = 'AGUARDANDO VALIDACAO' AND COD_CHAMADO IN (${bloco.map(() => "?").join(",")})
          GROUP BY COD_CHAMADO`,
        bloco,
      )) {
        if (r.DESDE) desdePorChamado.set(Number(r.COD_CHAMADO), dataLocalISO(r.DESDE));
      }
    }
    const aguardandoValidacao: ChamadoAguardando[] = aguardando
      .map((c) => ({
        codChamado: Number(c.COD_CHAMADO),
        assunto: texto(c.ASSUNTO_CHAMADO),
        cliente: texto(c.NOME_CLIENTE) || "Sem cliente",
        diasAguardando: Math.max(0, diasEntre(desdePorChamado.get(Number(c.COD_CHAMADO)) ?? hoje, hoje)),
      }))
      .sort((a, b) => b.diasAguardando - a.diasAguardando)
      .slice(0, MAX_LISTA);

    const blocoChamados: BlocoChamados = { porStatus, maisAntigos, aguardandoValidacao };

    // ── Tarefas: no limite / bloqueadas (mês corrente) ────────────────────
    const idsDaAba = new Set<number>(
      (
        await consultar(
          db,
          "SELECT COD_TAREFA FROM TAREFA WHERE CODREC_TAREFA = ? AND STATUS_TAREFA IN (?, ?, ?)",
          [recurso, 3, 2, 1],
        )
      ).map((r) => Number(r.COD_TAREFA)),
    );
    const idsTarefas = new Set<number>(idsDaAba);
    for (const c of abertos) if (c.CODTRF_CHAMADO) idsTarefas.add(Number(c.CODTRF_CHAMADO));

    const limitesCorrente = limitesDoMes(mesCorrente);
    const tarefasEmAlerta: TarefaEmAlerta[] = [];

    for (const bloco of emBlocos([...idsTarefas], BLOCO_IN)) {
      const marcas = bloco.map(() => "?").join(",");
      const tarefas = await consultar(
        db,
        `SELECT TAREFA.COD_TAREFA, TAREFA.NOME_TAREFA, TAREFA.HRREAL_TAREFA, TAREFA.LIMMES_TAREFA,
                TAREFA.PERIMP_TAREFA, CLIENTE.NOME_CLIENTE
           FROM TAREFA
           LEFT JOIN PROJETO ON PROJETO.COD_PROJETO = TAREFA.CODPRO_TAREFA
           LEFT JOIN CLIENTE ON CLIENTE.COD_CLIENTE = PROJETO.CODCLI_PROJETO
          WHERE TAREFA.COD_TAREFA IN (${marcas})`,
        bloco,
      );
      const consumo = new Map<number, number>();
      for (const r of await consultar(
        db,
        `SELECT CODTRF_OS, HRINI_OS, HRFIM_OS FROM OS
          WHERE CODTRF_OS IN (${marcas}) AND DTINI_OS >= ? AND DTINI_OS <= ?`,
        [...bloco, limitesCorrente.inicio, limitesCorrente.fim],
      )) {
        const id = Number(r.CODTRF_OS);
        consumo.set(id, (consumo.get(id) ?? 0) + duracaoOsMinutos(r.HRINI_OS, r.HRFIM_OS));
      }

      for (const t of tarefas) {
        const id = Number(t.COD_TAREFA);
        const limiteMensalHoras = t.LIMMES_TAREFA === null ? null : Number(t.LIMMES_TAREFA);
        const consumoMesMin = consumo.get(id) ?? 0;
        const situacao = situacaoDaTarefa({
          limiteMensalHoras,
          // "bloqueada" só vale para as tarefas da aba Tarefas (o apontamento em tarefa usa HRREAL)
          horasContratadas: idsDaAba.has(id) ? Number(t.HRREAL_TAREFA ?? NaN) : null,
          consumoMesMin,
          permiteExceder: texto(t.PERIMP_TAREFA).toUpperCase() === "SIM",
        });

        if (situacao) {
          tarefasEmAlerta.push({
            codTarefa: id,
            nome: texto(t.NOME_TAREFA),
            cliente: texto(t.NOME_CLIENTE) || "Sem cliente",
            situacao: situacao.tipo,
            percentual: situacao.tipo === "no-limite" ? situacao.percentual : null,
            consumoMesMin,
            limiteMensalHoras,
            naAbaTarefas: idsDaAba.has(id),
          });
        }
      }
    }
    tarefasEmAlerta.sort((a, b) => (b.percentual ?? 999) - (a.percentual ?? 999));

    // ── Tarefas da aba: horas lançadas × estimadas e prazo ────────────────
    const tarefasAndamento: TarefaAndamento[] = [];
    for (const bloco of emBlocos([...idsDaAba], BLOCO_IN)) {
      const marcas = bloco.map(() => "?").join(",");
      const detalhes = await consultar(
        db,
        `SELECT T.COD_TAREFA, T.NOME_TAREFA, T.HREST_TAREFA, T.DTPREVENT_TAREFA, CLIENTE.NOME_CLIENTE
           FROM TAREFA T
           LEFT JOIN PROJETO ON PROJETO.COD_PROJETO = T.CODPRO_TAREFA
           LEFT JOIN CLIENTE ON CLIENTE.COD_CLIENTE = PROJETO.CODCLI_PROJETO
          WHERE T.COD_TAREFA IN (${marcas})`,
        bloco,
      );
      const lancado = new Map<number, number>();
      for (const r of await consultar(
        db,
        `SELECT /* lancado */ CODTRF_OS, HRINI_OS, HRFIM_OS FROM OS WHERE CODTRF_OS IN (${marcas})`,
        bloco,
      )) {
        const id = Number(r.CODTRF_OS);
        lancado.set(id, (lancado.get(id) ?? 0) + duracaoOsMinutos(r.HRINI_OS, r.HRFIM_OS));
      }

      for (const t of detalhes) {
        const id = Number(t.COD_TAREFA);
        const horasEstimadas = Number(t.HREST_TAREFA ?? 0) > 0 ? Number(t.HREST_TAREFA) : null;
        const lancadoMin = lancado.get(id) ?? 0;
        const prazo = t.DTPREVENT_TAREFA ? dataLocalISO(t.DTPREVENT_TAREFA) : null;

        tarefasAndamento.push({
          codTarefa: id,
          nome: texto(t.NOME_TAREFA),
          cliente: texto(t.NOME_CLIENTE) || "Sem cliente",
          horasEstimadas,
          lancadoMin,
          percentual: horasEstimadas ? Math.round((lancadoMin / (horasEstimadas * 60)) * 100) : null,
          prazo,
          diasParaPrazo: prazo ? diasEntre(hoje, prazo) : null,
        });
      }
    }
    tarefasAndamento.sort((a, b) => (b.percentual ?? -1) - (a.percentual ?? -1));

    // ── Resultado: avaliações dos clientes (1 = não avaliado) ─────────────
    const avaliadas = await consultar(
      db,
      `SELECT COD_CHAMADO, AVALIA_CHAMADO, OBSAVAL_CHAMADO, ASSUNTO_CHAMADO
         FROM CHAMADO WHERE COD_RECURSO = ? AND AVALIA_CHAMADO > 1 ORDER BY COD_CHAMADO DESC`,
      [recurso],
    );
    const ultimasAvaliacoes: Avaliacao[] = await Promise.all(
      avaliadas.slice(0, 5).map(async (r) => ({
        codChamado: Number(r.COD_CHAMADO),
        nota: Number(r.AVALIA_CHAMADO),
        assunto: texto(r.ASSUNTO_CHAMADO),
        comentario: await lerTexto(r.OBSAVAL_CHAMADO),
      })),
    );
    const notas = avaliadas.map((r) => Number(r.AVALIA_CHAMADO));

    return {
      mes,
      nomeMes: nomeDoMes(mes),
      hoje,
      ehMesAtual,
      jornadaDiariaMin,
      apontarAPartirDe,
      resumo,
      projecao,
      hojeBloco,
      chamados: blocoChamados,
      tarefasAndamento,
      comparacao,
      pendencias: { chamadosParados, tarefas: tarefasEmAlerta, osContestadas },
      tempo: { ...tempo, evolucao },
      resultado: {
        sla: slaDoMes,
        faturamento,
        avaliacoes: {
          quantidade: notas.length,
          media: notas.length ? Math.round((notas.reduce((s, n) => s + n, 0) / notas.length) * 10) / 10 : null,
          ultimas: ultimasAvaliacoes,
        },
      },
    };
  } finally {
    db.detach();
  }
}
