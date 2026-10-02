// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getConnection } = vi.hoisted(() => ({ getConnection: vi.fn() }));

vi.mock("../firebird", () => ({ getConnection }));

import { montarPainel } from "./index";

type Linha = Record<string, unknown>;

// Banco falso: responde pela consulta (trecho do SQL) e guarda o que foi pedido.
function bancoFalso(respostas: Record<string, Linha[]>) {
  const consultas: { sql: string; params: unknown[] }[] = [];

  getConnection.mockImplementation((cb: (err: unknown, db: unknown) => void) =>
    cb(null, {
      query: (sql: string, params: unknown[], done: (e: unknown, r: Linha[]) => void) => {
        consultas.push({ sql, params });
        const chave = Object.keys(respostas).find((k) => sql.includes(k));
        done(null, chave ? respostas[chave] : []);
      },
      detach: vi.fn(),
    }),
  );

  return consultas;
}

// 2026-10-02 12:00 em Brasília
const AGORA = new Date("2026-10-02T15:00:00Z");
const d = (mes: number, dia: number) => new Date(2026, mes - 1, dia);

const BANCO: Record<string, Linha[]> = {
  "FROM RECURSO": [{ HRDIA_RECURSO: "0848", DTLIMITE_RECURSO: d(9, 1), PERMAPO_RECURSO: "SIM" }],
  // OS do mês de setembro
  "LEFT JOIN CLASSIFICACAO": [
    { COD_OS: 1, DTINI_OS: d(9, 1), HRINI_OS: "0900", HRFIM_OS: "1200", CHAMADO_OS: "100", CODTRF_OS: 10, VALCLI_OS: "SIM", FATURADO_OS: "SIM", COD_FATURAMENTO: null, NOME_TAREFA: "T1", COD_CLIENTE: 5, NOME_CLIENTE: "Cliente A", NOME_CLASSIFICACAO: "INCIDENTE" },
    { COD_OS: 2, DTINI_OS: d(9, 2), HRINI_OS: "0900", HRFIM_OS: "1000", CHAMADO_OS: null, CODTRF_OS: 11, VALCLI_OS: "NAO", FATURADO_OS: "NAO", COD_FATURAMENTO: 77, NOME_TAREFA: "T2", COD_CLIENTE: 6, NOME_CLIENTE: "Cliente B", NOME_CLASSIFICACAO: null },
    { COD_OS: 3, DTINI_OS: d(9, 2), HRINI_OS: "1400", HRFIM_OS: "1500", CHAMADO_OS: "", CODTRF_OS: 11, VALCLI_OS: "SIM", FATURADO_OS: "SIM", COD_FATURAMENTO: 0, NOME_TAREFA: "T2", COD_CLIENTE: 6, NOME_CLIENTE: "Cliente B", NOME_CLASSIFICACAO: null },
  ],
  // janela dos últimos 6 meses (evolução)
  "SELECT DTINI_OS, HRINI_OS, HRFIM_OS FROM OS": [
    { DTINI_OS: d(8, 10), HRINI_OS: "0800", HRFIM_OS: "1000" },
    { DTINI_OS: d(9, 1), HRINI_OS: "0900", HRFIM_OS: "1200" },
    { DTINI_OS: d(9, 2), HRINI_OS: "0900", HRFIM_OS: "1000" },
    { DTINI_OS: d(9, 2), HRINI_OS: "1400", HRFIM_OS: "1500" },
  ],
  "GROUP BY CHAMADO_OS": [{ CHAMADO_OS: "100", ULTIMA: d(9, 29) }],
  "CHAMADO.STATUS_CHAMADO <> ?": [
    { COD_CHAMADO: 200, ASSUNTO_CHAMADO: "Chamado parado", STATUS_CHAMADO: "EM ATENDIMENTO", DTENVIO_CHAMADO: "01/09/2026 10:00", DTINI_CHAMADO: d(9, 2), CODTRF_CHAMADO: 11, NOME_CLIENTE: "Cliente B" },
    { COD_CHAMADO: 100, ASSUNTO_CHAMADO: "Chamado recente", STATUS_CHAMADO: "STANDBY", DTENVIO_CHAMADO: "01/09/2026 10:00", DTINI_CHAMADO: d(9, 1), CODTRF_CHAMADO: 10, NOME_CLIENTE: "Cliente A" },
    { COD_CHAMADO: 500, ASSUNTO_CHAMADO: "Esperando o cliente", STATUS_CHAMADO: "AGUARDANDO VALIDACAO", DTENVIO_CHAMADO: "15/09/2026 09:00", DTINI_CHAMADO: d(10, 1), CODTRF_CHAMADO: null, NOME_CLIENTE: "Cliente C" },
  ],
  "MAX(DATA_HISTCHAMADO) AS DESDE": [{ COD_CHAMADO: 500, DESDE: d(9, 20) }],
  "SELECT COD_TAREFA FROM TAREFA": [{ COD_TAREFA: 11 }],
  "ORDER BY OS.HRINI_OS": [{ COD_OS: 9, HRINI_OS: "0900", HRFIM_OS: "1100", NOME_CLIENTE: "Cliente A", NOME_TAREFA: "T1" }],
  "T.COD_TAREFA IN": [
    { COD_TAREFA: 11, NOME_TAREFA: "Tarefa sem horas", HREST_TAREFA: 10, DTPREVENT_TAREFA: d(9, 30), NOME_CLIENTE: "Cliente B" },
  ],
  "TAREFA.COD_TAREFA IN": [
    { COD_TAREFA: 11, NOME_TAREFA: "Tarefa sem horas", HRREAL_TAREFA: 0, LIMMES_TAREFA: 0, PERIMP_TAREFA: "NAO", NOME_CLIENTE: "Cliente B" },
    { COD_TAREFA: 10, NOME_TAREFA: "Tarefa quase no limite", HRREAL_TAREFA: 50, LIMMES_TAREFA: 10, PERIMP_TAREFA: "NAO", NOME_CLIENTE: "Cliente A" },
  ],
  // horas lançadas (desde o início) na tarefa 11: 2 OS de 10h = 20h
  "/* lancado */": [
    { CODTRF_OS: 11, HRINI_OS: "0800", HRFIM_OS: "1800" },
    { CODTRF_OS: 11, HRINI_OS: "0800", HRFIM_OS: "1800" },
  ],
  // consumo da tarefa 10 no mês corrente: 9h de um limite de 10h (90%)
  "CODTRF_OS IN": [{ CODTRF_OS: 10, HRINI_OS: "0800", HRFIM_OS: "1700" }],
  "FROM HISTCHAMADO H": [
    // chamado 300 tem dois eventos FINALIZADO: vale o mais recente (11/09 09:00)
    { COD_CHAMADO: 300, DATA_HISTCHAMADO: d(9, 10), HORA_HISTCHAMADO: "1000", DTENVIO_CHAMADO: "10/09/2026 09:00", SLA_TAREFA: 24 },
    { COD_CHAMADO: 300, DATA_HISTCHAMADO: d(9, 11), HORA_HISTCHAMADO: "0900", DTENVIO_CHAMADO: "10/09/2026 09:00", SLA_TAREFA: 24 },
    // chamado 301 passou muito do SLA de 8h
    { COD_CHAMADO: 301, DATA_HISTCHAMADO: d(9, 10), HORA_HISTCHAMADO: "1800", DTENVIO_CHAMADO: "01/09/2026 08:00", SLA_TAREFA: 8 },
    // sem SLA definido: fica fora da conta
    { COD_CHAMADO: 302, DATA_HISTCHAMADO: d(9, 10), HORA_HISTCHAMADO: "1800", DTENVIO_CHAMADO: "01/09/2026 08:00", SLA_TAREFA: null },
  ],
  "AVALIA_CHAMADO > 1": [
    { COD_CHAMADO: 400, AVALIA_CHAMADO: 5, OBSAVAL_CHAMADO: "Ótimo!", ASSUNTO_CHAMADO: "A" },
    { COD_CHAMADO: 401, AVALIA_CHAMADO: 4, OBSAVAL_CHAMADO: null, ASSUNTO_CHAMADO: "B" },
  ],
};

// com chaves: devolver o mock faria o Vitest chamá-lo como rotina de limpeza
beforeEach(() => {
  getConnection.mockReset();
});

describe("montarPainel", () => {
  it("resumo do mês: horas, meta (8h48 × dias úteis) e dias sem apontamento", async () => {
    bancoFalso(BANCO);
    const p = await montarPainel(152, "2026-09", AGORA);

    expect(p.mes).toBe("2026-09");
    expect(p.nomeMes).toBe("setembro de 2026");
    expect(p.hoje).toBe("2026-10-02");
    expect(p.ehMesAtual).toBe(false);
    expect(p.jornadaDiariaMin).toBe(528);
    expect(p.apontarAPartirDe).toBe("2026-09-01");

    expect(p.resumo.horasApontadasMin).toBe(300); // 3h + 1h + 1h
    expect(p.resumo.diasUteis).toBe(21);
    expect(p.resumo.metaMesMin).toBe(528 * 21);
    // mês passado: todos os 21 dias úteis já passaram; só 1/9 e 2/9 têm OS
    expect(p.resumo.diasSemApontamento).toHaveLength(19);
  });

  it("tempo: por dia, cliente, tarefa e tipo", async () => {
    bancoFalso(BANCO);
    const p = await montarPainel(152, "2026-09", AGORA);

    expect(p.tempo.porDia).toHaveLength(30);
    expect(p.tempo.porDia.find((x) => x.data === "2026-09-02")?.minutos).toBe(120);
    expect(p.tempo.porCliente.map((c) => [c.rotulo, c.minutos])).toEqual([["Cliente A", 180], ["Cliente B", 120]]);
    expect(p.tempo.porTarefa.map((c) => [c.rotulo, c.minutos])).toEqual([["T1", 180], ["T2", 120]]);
    expect(p.tempo.porClassificacao.map((c) => [c.rotulo, c.minutos])).toEqual([
      ["INCIDENTE", 180],
      ["Tarefa (sem chamado)", 120], // OS sem chamado (nulo ou vazio) = tarefa
    ]);
  });

  it("evolução dos últimos 6 meses, com a meta de cada mês", async () => {
    bancoFalso(BANCO);
    const p = await montarPainel(152, "2026-09", AGORA);

    expect(p.tempo.evolucao.map((e) => e.mes)).toEqual(["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]);
    expect(p.tempo.evolucao.find((e) => e.mes === "2026-08")?.minutos).toBe(120);
    expect(p.tempo.evolucao.find((e) => e.mes === "2026-09")?.minutos).toBe(300);
    expect(p.tempo.evolucao.find((e) => e.mes === "2026-09")?.metaMin).toBe(528 * 21);
  });

  it("faturamento e OS contestadas", async () => {
    bancoFalso(BANCO);
    const p = await montarPainel(152, "2026-09", AGORA);

    expect(p.resultado.faturamento).toEqual({ faturavelMin: 240, naoFaturavelMin: 60, faturadoMin: 60 });
    expect(p.pendencias.osContestadas).toEqual([{ codOs: 2, data: "2026-09-02", minutos: 60, cliente: "Cliente B" }]);
  });

  it("chamado parado: só o que passou de 7 dias sem apontar", async () => {
    bancoFalso(BANCO);
    const p = await montarPainel(152, "2026-09", AGORA);

    expect(p.pendencias.chamadosParados).toEqual([
      { codChamado: 200, assunto: "Chamado parado", cliente: "Cliente B", status: "EM ATENDIMENTO", diasParado: 30 },
    ]); // o 100 teve OS em 29/9 (3 dias)
  });

  it("tarefas em alerta: no limite (90%) e bloqueada (sem horas)", async () => {
    bancoFalso(BANCO);
    const p = await montarPainel(152, "2026-09", AGORA);

    const porNome = Object.fromEntries(p.pendencias.tarefas.map((t) => [t.nome, t]));
    expect(porNome["Tarefa quase no limite"]).toMatchObject({ situacao: "no-limite", percentual: 90, consumoMesMin: 540, limiteMensalHoras: 10 });
    expect(porNome["Tarefa sem horas"]).toMatchObject({ situacao: "bloqueada", percentual: null });
  });

  it("SLA: usa a finalização mais recente e ignora chamado sem SLA", async () => {
    bancoFalso(BANCO);
    const p = await montarPainel(152, "2026-09", AGORA);

    // 300: 10/9 09:00 -> 11/9 09:00 = 9h + 1h = 10h úteis (SLA 24) -> no prazo
    // 301: bem mais que 8h úteis -> fora; 302 sem SLA -> fora da conta
    expect(p.resultado.sla.total).toBe(2);
    expect(p.resultado.sla.noPrazo).toBe(1);
    expect(p.resultado.sla.foraDoPrazo).toBe(1);
    expect(p.resultado.sla.percentualNoPrazo).toBe(50);
  });

  it("avaliações: média e comentários (BLOB nulo vira texto vazio)", async () => {
    bancoFalso(BANCO);
    const p = await montarPainel(152, "2026-09", AGORA);

    expect(p.resultado.avaliacoes.quantidade).toBe(2);
    expect(p.resultado.avaliacoes.media).toBe(4.5);
    expect(p.resultado.avaliacoes.ultimas.map((a) => [a.codChamado, a.nota, a.comentario])).toEqual([
      [400, 5, "Ótimo!"],
      [401, 4, ""],
    ]);
  });

  it("consulta só dados do consultor informado, só leitura", async () => {
    const consultas = bancoFalso(BANCO);
    await montarPainel(152, "2026-09", AGORA);

    expect(consultas.length).toBeGreaterThan(5);
    for (const c of consultas) {
      expect(c.sql.trim().toUpperCase().startsWith("SELECT")).toBe(true);
    }
    // toda consulta de OS/chamado/recurso carrega o código do consultor
    const comRecurso = consultas.filter((c) => /CODREC_OS|COD_RECURSO|CODREC_TAREFA/.test(c.sql));
    expect(comRecurso.length).toBeGreaterThan(5);
    for (const c of comRecurso) expect(c.params).toContain(152);
  });

  it("mês corrente: marca ehMesAtual e conta o dia de hoje fora dos 'sem apontamento'", async () => {
    bancoFalso({ ...BANCO, "LEFT JOIN CLASSIFICACAO": [] });
    const p = await montarPainel(152, "2026-10", AGORA);

    expect(p.ehMesAtual).toBe(true);
    expect(p.resumo.diasUteisAteHoje).toBe(2); // 1/10 (quinta) e 2/10 (sexta)
    expect(p.resumo.diasSemApontamento).toEqual(["2026-10-01"]); // hoje (2/10) ainda dá tempo
  });

  it("consultor sem cadastro de jornada: meta zerada, sem quebrar", async () => {
    bancoFalso({ ...BANCO, "FROM RECURSO": [] });
    const p = await montarPainel(152, "2026-09", AGORA);

    expect(p.jornadaDiariaMin).toBe(0);
    expect(p.resumo.metaMesMin).toBe(0);
    expect(p.resumo.percentualMeta).toBeNull();
  });

  it("libera a conexão mesmo quando uma consulta falha", async () => {
    const detach = vi.fn();
    getConnection.mockImplementation((cb: (err: unknown, db: unknown) => void) =>
      cb(null, {
        query: (_s: string, _p: unknown[], done: (e: unknown, r: Linha[]) => void) => done(new Error("falha"), []),
        detach,
      }),
    );

    await expect(montarPainel(152, "2026-09", AGORA)).rejects.toThrow("falha");
    expect(detach).toHaveBeenCalledTimes(1);
  });
});

describe("montarPainel: blocos de ação e acompanhamento", () => {
  it("hoje: OS lançadas, falta para a jornada e horários livres até o 'agora'", async () => {
    bancoFalso(BANCO);
    const p = await montarPainel(152, "2026-09", AGORA); // sexta, 02/10 12:00

    expect(p.hojeBloco.data).toBe("2026-10-02");
    expect(p.hojeBloco.ehDiaUtil).toBe(true);
    expect(p.hojeBloco.agora).toBe("12:00");
    expect(p.hojeBloco.osDeHoje).toEqual([
      { codOs: 9, inicio: "09:00", fim: "11:00", minutos: 120, cliente: "Cliente A", tarefa: "T1" },
    ]);
    expect(p.hojeBloco.minutosHoje).toBe(120);
    expect(p.hojeBloco.faltaJornadaMin).toBe(528 - 120);
    // 09:00-11:00 ocupado; livre até 12:00 (agora) na grade de 30 min
    expect(p.hojeBloco.livres).toEqual([
      { inicio: "08:00", fim: "09:00", minutos: 60 },
      { inicio: "11:00", fim: "12:00", minutos: 60 },
    ]);
  });

  it("projeção só existe no mês corrente", async () => {
    bancoFalso(BANCO);
    const passado = await montarPainel(152, "2026-09", AGORA);
    expect(passado.projecao).toBeNull();

    bancoFalso({ ...BANCO, "LEFT JOIN CLASSIFICACAO": [] });
    const atual = await montarPainel(152, "2026-10", AGORA);
    expect(atual.projecao).not.toBeNull();
    expect(atual.projecao?.diasDecorridos).toBe(1); // 1/10; hoje (2/10) ainda sem OS no mês
    expect(atual.projecao?.situacao).toBe("abaixo");
  });

  it("chamados: contadores por status, mais antigos e aguardando validação", async () => {
    bancoFalso(BANCO);
    const p = await montarPainel(152, "2026-09", AGORA);

    expect(p.chamados.porStatus).toEqual([
      { status: "EM ATENDIMENTO", quantidade: 1 },
      { status: "STANDBY", quantidade: 1 },
      { status: "AGUARDANDO VALIDACAO", quantidade: 1 },
    ]);
    expect(p.chamados.maisAntigos.map((c) => [c.codChamado, c.diasAberto])).toEqual([
      [200, 31],
      [100, 31],
      [500, 17],
    ]);
    expect(p.chamados.aguardandoValidacao).toEqual([
      { codChamado: 500, assunto: "Esperando o cliente", cliente: "Cliente C", diasAguardando: 12 },
    ]);
  });

  it("o chamado recém-aguardando validação não vira 'parado'", async () => {
    bancoFalso(BANCO);
    const p = await montarPainel(152, "2026-09", AGORA);

    expect(p.pendencias.chamadosParados.map((c) => c.codChamado)).toEqual([200]);
  });

  it("tarefas da aba: horas lançadas × estimadas e prazo vencido", async () => {
    bancoFalso(BANCO);
    const p = await montarPainel(152, "2026-09", AGORA);

    expect(p.tarefasAndamento).toEqual([
      {
        codTarefa: 11,
        nome: "Tarefa sem horas",
        cliente: "Cliente B",
        horasEstimadas: 10,
        lancadoMin: 1200,
        percentual: 200,
        prazo: "2026-09-30",
        diasParaPrazo: -2,
      },
    ]);
  });

  it("alerta de tarefa indica se ela está na aba Tarefas (clicável)", async () => {
    bancoFalso(BANCO);
    const p = await montarPainel(152, "2026-09", AGORA);

    const porNome = Object.fromEntries(p.pendencias.tarefas.map((t) => [t.nome, t.naAbaTarefas]));
    expect(porNome["Tarefa sem horas"]).toBe(true); // tarefa 11 está na aba
    expect(porNome["Tarefa quase no limite"]).toBe(false); // veio de um chamado
  });

  it("comparação: mês passado inteiro × mês anterior inteiro", async () => {
    bancoFalso(BANCO);
    const p = await montarPainel(152, "2026-09", AGORA);

    expect(p.comparacao).toMatchObject({
      mesAnterior: "2026-08",
      nomeMesAnterior: "agosto de 2026",
      mesmoPeriodo: false,
      horas: { atualMin: 300, anteriorMin: 120, variacao: 150 },
      os: { atual: 3, anterior: 1, variacao: 200 },
    });
    expect(p.comparacao.sla.atualPercentual).toBe(50);
  });

  it("comparação no mês em andamento usa o MESMO ponto do mês anterior", async () => {
    bancoFalso({ ...BANCO, "LEFT JOIN CLASSIFICACAO": [] });
    const p = await montarPainel(152, "2026-10", AGORA);

    // outubro tem 1 dia útil decorrido -> compara com o 1º dia útil de setembro (1/9: 3h, 1 OS)
    expect(p.comparacao.mesmoPeriodo).toBe(true);
    expect(p.comparacao.horas).toEqual({ atualMin: 0, anteriorMin: 180, variacao: -100 });
    expect(p.comparacao.os).toEqual({ atual: 0, anterior: 1, variacao: -100 });
  });
});
