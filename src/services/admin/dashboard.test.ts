// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getConnection } = vi.hoisted(() => ({ getConnection: vi.fn() }));

vi.mock("../firebird", () => ({ getConnection }));

import { diasUteisDoMes } from "@/utils/painel/dias-uteis";
import { montarDashboard } from "./dashboard";

type Linha = Record<string, unknown>;

// Banco falso: responde pelo trecho do SQL e guarda o que foi pedido.
function bancoFalso(respostas: Record<string, Linha[]>) {
  const consultas: { sql: string; params: unknown[] }[] = [];
  const detach = vi.fn();

  getConnection.mockImplementation((cb: (err: unknown, db: unknown) => void) =>
    cb(null, {
      query: (sql: string, params: unknown[], done: (e: unknown, r: Linha[]) => void) => {
        consultas.push({ sql, params });
        const chave = Object.keys(respostas).find((k) => sql.includes(k));
        done(null, chave ? respostas[chave] : []);
      },
      detach,
    }),
  );

  return { consultas, detach };
}

// 2026-10-02 12:00 em Brasília: setembro é um mês fechado
const AGORA = new Date("2026-10-02T15:00:00Z");
const d = (mes: number, dia: number) => new Date(2026, mes - 1, dia);

const os = (recurso: number, data: Date, ini: string, fim: string, extra: Linha = {}) => ({
  CODREC_OS: recurso,
  DTINI_OS: data,
  DTINC_OS: data,
  HRINI_OS: ini,
  HRFIM_OS: fim,
  CHAMADO_OS: null,
  CODTRF_OS: null,
  ...extra,
});

const tarefa = (cod: number, nome: string, extra: Linha = {}) => ({
  COD_TAREFA: cod,
  NOME_TAREFA: nome,
  STATUS_TAREFA: 2,
  PERIMP_TAREFA: "NAO",
  LIMMES_TAREFA: null,
  HRREAL_TAREFA: 100,
  NOME_CLIENTE: "CLIENTE A",
  NOME_RECURSO: "ANA SOUZA",
  ...extra,
});

const BANCO: Record<string, Linha[]> = {
  "FROM RECURSO R": [
    { COD_RECURSO: 10, NOME_RECURSO: "ANA SOUZA", ATIVO_RECURSO: 1, HRDIA_RECURSO: "0800", PERMAPO_RECURSO: "SIM", DTLIMITE_RECURSO: d(9, 1), TIPO_USUARIO: "USU" },
    { COD_RECURSO: 20, NOME_RECURSO: "BRUNO LIMA", ATIVO_RECURSO: 1, HRDIA_RECURSO: "0800", PERMAPO_RECURSO: "NAO", DTLIMITE_RECURSO: d(9, 1), TIPO_USUARIO: "USU" },
    // administrador: não é consultor do dashboard
    { COD_RECURSO: 30, NOME_RECURSO: "ADMINISTRADOR", ATIVO_RECURSO: 1, HRDIA_RECURSO: "0800", PERMAPO_RECURSO: "SIM", DTLIMITE_RECURSO: d(1, 1), TIPO_USUARIO: "ADM" },
    // inativo: fica de fora
    { COD_RECURSO: 40, NOME_RECURSO: "INATIVO", ATIVO_RECURSO: 0, HRDIA_RECURSO: "0800", PERMAPO_RECURSO: "NAO", DTLIMITE_RECURSO: d(9, 1), TIPO_USUARIO: "USU" },
    // sem nenhuma OS e com a data-limite esquecida de julho
    { COD_RECURSO: 50, NOME_RECURSO: "CARLA DIAS", ATIVO_RECURSO: 1, HRDIA_RECURSO: "0800", PERMAPO_RECURSO: "SIM", DTLIMITE_RECURSO: d(7, 1), TIPO_USUARIO: null },
  ],
  // OS de agosto (mês anterior) e de setembro, de todos os consultores
  "OS.DTINC_OS": [
    os(10, d(8, 3), "0800", "1000"),
    os(10, d(9, 1), "0800", "1200", { CHAMADO_OS: "100", CODTRF_OS: 7 }),
    os(10, d(9, 2), "0800", "1600", { CHAMADO_OS: "100", CODTRF_OS: 7 }),
    // quinta 03/09 lançada na terça 08/09 (segunda 07/09 é feriado): 2 dias úteis = atrasada
    { ...os(10, d(9, 3), "0800", "1000", { CODTRF_OS: 7 }), DTINC_OS: d(9, 8) },
    os(20, d(9, 1), "0800", "1200", { CHAMADO_OS: "200", CODTRF_OS: 8 }),
    os(20, d(9, 2), "0800", "1630", { CODTRF_OS: 11 }),
    // OS sem data de lançamento: não entra na conta de atraso
    { ...os(20, d(9, 4), "0800", "0900"), DTINC_OS: null },
    // consultor ADM e inativo: ignorados no dashboard
    os(30, d(9, 1), "0800", "1800"),
  ],
  "FROM HISTCHAMADO H": [
    // chamado 300 tem dois eventos FINALIZADO: vale o mais recente (10/09 10:00), dentro do SLA de 24h
    { COD_CHAMADO: 300, DATA_HISTCHAMADO: d(9, 9), HORA_HISTCHAMADO: "1000", DTENVIO_CHAMADO: "10/09/2026 09:00", COD_RECURSO: 10, SLA_TAREFA: 24 },
    { COD_CHAMADO: 300, DATA_HISTCHAMADO: d(9, 10), HORA_HISTCHAMADO: "1000", DTENVIO_CHAMADO: "10/09/2026 09:00", COD_RECURSO: 10, SLA_TAREFA: 24 },
    // chamado 301 passou do SLA de 8h
    { COD_CHAMADO: 301, DATA_HISTCHAMADO: d(9, 11), HORA_HISTCHAMADO: "1800", DTENVIO_CHAMADO: "01/09/2026 08:00", COD_RECURSO: 10, SLA_TAREFA: 8 },
    // sem SLA definido: conta como finalizado, mas fica fora da conta do SLA
    { COD_CHAMADO: 302, DATA_HISTCHAMADO: d(9, 21), HORA_HISTCHAMADO: "1000", DTENVIO_CHAMADO: "20/09/2026 08:00", COD_RECURSO: 20, SLA_TAREFA: null },
    // finalizado em agosto: aparece no gráfico semanal, mas não no mês de setembro
    { COD_CHAMADO: 303, DATA_HISTCHAMADO: d(8, 20), HORA_HISTCHAMADO: "1000", DTENVIO_CHAMADO: "19/08/2026 08:00", COD_RECURSO: 20, SLA_TAREFA: 24 },
  ],
  "C.STATUS_CHAMADO <> ?": [
    { COD_CHAMADO: 400, ASSUNTO_CHAMADO: "Chamado parado", STATUS_CHAMADO: "ATRIBUIDO", COD_RECURSO: 10, DTENVIO_CHAMADO: "01/09/2026 10:00", DTINI_CHAMADO: null, NOME_CLIENTE: "CLIENTE A" },
    { COD_CHAMADO: 401, ASSUNTO_CHAMADO: "Chamado recente", STATUS_CHAMADO: "EM ATENDIMENTO", COD_RECURSO: 20, DTENVIO_CHAMADO: "30/09/2026 10:00", DTINI_CHAMADO: null, NOME_CLIENTE: "CLIENTE B" },
    { COD_CHAMADO: 402, ASSUNTO_CHAMADO: "Sem dono", STATUS_CHAMADO: "STANDBY", COD_RECURSO: 99, DTENVIO_CHAMADO: "01/08/2026 10:00", DTINI_CHAMADO: null, NOME_CLIENTE: null },
  ],
  "CHAMADO_OS IN": [{ CHAMADO_OS: "400", ULTIMA: d(9, 10) }],
  "C.DATA_CHAMADO >=": [
    { COD_CHAMADO: 1, DATA_CHAMADO: d(8, 20), COD_CLIENTE: 5, NOME_CLIENTE: "CLIENTE A", COD_AREA: null, NOME_AREA: null },
    { COD_CHAMADO: 2, DATA_CHAMADO: d(9, 2), COD_CLIENTE: 5, NOME_CLIENTE: "CLIENTE A", COD_AREA: null, NOME_AREA: null },
    { COD_CHAMADO: 3, DATA_CHAMADO: d(9, 3), COD_CLIENTE: 5, NOME_CLIENTE: "CLIENTE A", COD_AREA: 2, NOME_AREA: "SUPORTE" },
    { COD_CHAMADO: 4, DATA_CHAMADO: d(9, 15), COD_CLIENTE: 6, NOME_CLIENTE: "CLIENTE B", COD_AREA: 2, NOME_AREA: "SUPORTE" },
    { COD_CHAMADO: 5, DATA_CHAMADO: d(9, 15), COD_CLIENTE: 5, NOME_CLIENTE: "CLIENTE A", COD_AREA: null, NOME_AREA: null },
    { COD_CHAMADO: 6, DATA_CHAMADO: d(9, 29), COD_CLIENTE: null, NOME_CLIENTE: null, COD_AREA: null, NOME_AREA: null },
  ],
  // tarefas com consumo no mês
  "T.COD_TAREFA IN": [
    tarefa(7, "MIGRACAO", { LIMMES_TAREFA: 10 }), // 14h de 10h: estourada
    tarefa(8, "SUPORTE", { PERIMP_TAREFA: "SIM", NOME_RECURSO: "BRUNO LIMA" }), // liberada, sem limite
    tarefa(11, "RELATORIO", { LIMMES_TAREFA: 10, NOME_RECURSO: "BRUNO LIMA" }), // 8h30 de 10h: no limite
  ],
  // tarefas ativas com estouro liberado (mesmo sem consumo no mês)
  "T.PERIMP_TAREFA = 'SIM'": [tarefa(8, "SUPORTE", { PERIMP_TAREFA: "SIM", NOME_RECURSO: "BRUNO LIMA" }), tarefa(9, "PARADA", { PERIMP_TAREFA: "SIM", LIMMES_TAREFA: 20 })],
};

const diasUteisDeSetembro = diasUteisDoMes("2026-09").length;

beforeEach(() => {
  getConnection.mockReset();
});

describe("montarDashboard (setembro/2026, visto em 02/10)", () => {
  it("só consultores ativos e que não são administradores; fecha a conexão", async () => {
    const { detach } = bancoFalso(BANCO);

    const r = await montarDashboard("2026-09", AGORA);

    expect(r.consultores.map((c) => c.nome)).toEqual(["ANA SOUZA", "BRUNO LIMA", "CARLA DIAS"]);
    expect(r.visao.consultoresAtivos).toBe(3);
    expect(r.mes).toBe("2026-09");
    expect(r.nomeMes).toBe("setembro de 2026");
    expect(r.ehMesAtual).toBe(false);
    expect(r.geradoEm).toBe(AGORA.toISOString());
    expect(detach).toHaveBeenCalledTimes(1);
  });

  it("é SOMENTE LEITURA: toda consulta é um SELECT", async () => {
    const { consultas } = bancoFalso(BANCO);

    await montarDashboard("2026-09", AGORA);

    expect(consultas.length).toBeGreaterThan(5);
    for (const c of consultas) expect(c.sql.trimStart().toUpperCase().startsWith("SELECT"), c.sql).toBe(true);
    for (const c of consultas) expect(/\b(INSERT|UPDATE|DELETE|MERGE|EXECUTE)\b/i.test(c.sql), c.sql).toBe(false);
  });

  it("horas, meta, comparação com o mês anterior e regularidade de cada consultor", async () => {
    bancoFalso(BANCO);

    const r = await montarDashboard("2026-09", AGORA);
    const ana = r.consultores.find((c) => c.codigo === 10)!;
    const bruno = r.consultores.find((c) => c.codigo === 20)!;
    const carla = r.consultores.find((c) => c.codigo === 50)!;

    // 4h + 8h + 2h
    expect(ana.horasMin).toBe(840);
    expect(ana.metaMesMin).toBe(480 * diasUteisDeSetembro);
    expect(ana.percentualMeta).toBe(Math.round((840 / (480 * diasUteisDeSetembro)) * 100));
    expect(ana.osQtd).toBe(3);
    // agosto: 2h; mês fechado compara mês inteiro com mês inteiro
    expect(ana.horasMesAnteriorMin).toBe(120);
    expect(ana.variacao).toBe(600);
    // só 02/09 (8h) bateu a jornada de 8h
    expect(ana.diasBateuJornada).toBe(1);
    expect(ana.diasUteisPassados).toBe(diasUteisDeSetembro);
    expect(ana.chamadosAtendidos).toBe(1);

    expect(bruno.horasMin).toBe(240 + 510 + 60);
    expect(bruno.osQtd).toBe(3);

    expect(carla.horasMin).toBe(0);
    expect(carla.percentualMeta).toBe(0);
    expect(carla.diasSemApontamento).toHaveLength(diasUteisDeSetembro);
    expect(carla.variacao).toBeNull();
  });

  it("SLA e chamados finalizados por consultor (vale a finalização mais recente; sem SLA fica fora)", async () => {
    bancoFalso(BANCO);

    const r = await montarDashboard("2026-09", AGORA);
    const ana = r.consultores.find((c) => c.codigo === 10)!;
    const bruno = r.consultores.find((c) => c.codigo === 20)!;

    expect(ana.chamadosFinalizados).toBe(2);
    expect(ana.sla).toMatchObject({ total: 2, noPrazo: 1, percentualNoPrazo: 50 });
    // chamado 302 sem SLA: finalizado, mas não entra no SLA; o 303 é de agosto
    expect(bruno.chamadosFinalizados).toBe(1);
    expect(bruno.sla).toMatchObject({ total: 0, percentualNoPrazo: null });
    expect(r.visao.chamadosFinalizadosNoMes).toBe(3);
  });

  it("lançamentos atrasados: sexta lançada na segunda não conta; OS sem data de lançamento fica fora do total", async () => {
    bancoFalso(BANCO);

    const r = await montarDashboard("2026-09", AGORA);
    const ana = r.consultores.find((c) => c.codigo === 10)!;
    const bruno = r.consultores.find((c) => c.codigo === 20)!;

    expect(ana).toMatchObject({ lancamentosAtrasados: 1, lancamentosComData: 3 });
    expect(bruno).toMatchObject({ lancamentosAtrasados: 0, lancamentosComData: 2 });
    expect(r.qualidade.lancamentosAtrasados).toEqual([{ codigo: 10, nome: "ANA SOUZA", atrasados: 1, total: 3, percentual: 33 }]);
  });

  it("visão geral soma os consultores e compara com o mês anterior", async () => {
    bancoFalso(BANCO);

    const r = await montarDashboard("2026-09", AGORA);

    expect(r.visao.horasMin).toBe(840 + 810);
    expect(r.visao.metaMesMin).toBe(3 * 480 * diasUteisDeSetembro);
    expect(r.visao.horasMesAnteriorMin).toBe(120);
    expect(r.visao.consultoresComPendencia).toBe(3);
    expect(r.visao.chamadosAbertos).toBe(3);
    expect(r.visao.chamadosParados).toBe(2);
  });

  it("tarefas: estouradas e no limite (mais urgente primeiro) e as com estouro liberado", async () => {
    bancoFalso(BANCO);

    const r = await montarDashboard("2026-09", AGORA);

    expect(r.tarefas.emRisco.map((t) => [t.tarefa.nome, t.situacao, t.percentual, t.consumoMesMin])).toEqual([
      ["MIGRACAO", "estourada", 140, 840],
      ["RELATORIO", "no-limite", 85, 510],
    ]);
    // liberadas: a 8 aparece nas duas buscas e entra uma vez só; a 9 não teve consumo no mês
    expect(r.tarefas.comEstouroLiberado.map((t) => [t.tarefa.codigo, t.consumoMesMin]).sort()).toEqual([[8, 240], [9, 0]]);
    expect(r.visao.tarefasEmRisco).toBe(2);
    expect(r.visao.tarefasComEstouroLiberado).toBe(2);
    // o modal de edição recebe a tarefa no mesmo formato da aba Tarefas
    expect(r.tarefas.emRisco[0].tarefa).toMatchObject({ codigo: 7, cliente: "CLIENTE A", responsavel: "ANA SOUZA", statusTexto: "Desenvolvimento", limiteMensalHoras: 10, permiteExceder: false });
  });

  it("chamados abertos: por situação e os parados (do mais antigo), com o nome do consultor", async () => {
    bancoFalso(BANCO);

    const r = await montarDashboard("2026-09", AGORA);

    expect(r.chamados.abertosPorStatus).toHaveLength(3);
    expect(r.chamados.totalParados).toBe(2);
    expect(r.chamados.parados.map((c) => [c.codChamado, c.consultor, c.cliente, c.diasParado])).toEqual([
      [402, "Sem consultor", "Sem cliente", 62],
      // a última OS (10/09) é a atividade mais recente do chamado 400
      [400, "ANA SOUZA", "CLIENTE A", 22],
    ]);
    expect(r.consultores.find((c) => c.codigo === 10)!.chamadosAbertos).toBe(1);
    expect(r.consultores.find((c) => c.codigo === 20)!.chamadosAbertos).toBe(1);
  });

  it("devolve a lista dos chamados ABERTOS (número, assunto, cliente, consultor e situação), do mais antigo ao mais novo", async () => {
    bancoFalso(BANCO);

    const r = await montarDashboard("2026-09", AGORA);

    expect(r.chamados.abertos).toEqual([
      { codChamado: 400, assunto: "Chamado parado", cliente: "CLIENTE A", consultor: "ANA SOUZA", status: "ATRIBUIDO" },
      { codChamado: 401, assunto: "Chamado recente", cliente: "CLIENTE B", consultor: "BRUNO LIMA", status: "EM ATENDIMENTO" },
      // sem consultor cadastrado e sem cliente: textos padrão
      { codChamado: 402, assunto: "Sem dono", cliente: "Sem cliente", consultor: "Sem consultor", status: "STANDBY" },
    ]);
    // a lista bate com a contagem dos badges
    for (const { status, quantidade } of r.chamados.abertosPorStatus) expect(r.chamados.abertos.filter((c) => c.status === status)).toHaveLength(quantidade);
  });

  it("devolve TODOS os chamados parados (não só os 15 mais antigos), do mais parado para o menos", async () => {
    const abertos = Array.from({ length: 40 }, (_, i) => ({
      COD_CHAMADO: 600 + i,
      ASSUNTO_CHAMADO: `Parado ${i}`,
      STATUS_CHAMADO: "STANDBY",
      COD_RECURSO: 10,
      // quanto menor o índice, mais antigo
      DTENVIO_CHAMADO: `${String(1 + (i % 28)).padStart(2, "0")}/08/2026 10:00`,
      DTINI_CHAMADO: null,
      NOME_CLIENTE: "CLIENTE A",
    }));
    bancoFalso({ ...BANCO, "C.STATUS_CHAMADO <> ?": abertos, "CHAMADO_OS IN": [] });

    const r = await montarDashboard("2026-09", AGORA);

    expect(r.chamados.totalParados).toBe(40);
    expect(r.chamados.parados).toHaveLength(40);
    expect(r.chamados.abertos).toHaveLength(40); // e a lista dos abertos também é completa
    expect(r.visao.chamadosParados).toBe(40);
    const dias = r.chamados.parados.map((c) => c.diasParado);
    expect(dias).toEqual([...dias].sort((a, b) => b - a));
  });

  it("chamados por semana (8 semanas), por cliente e por área do mês", async () => {
    bancoFalso(BANCO);

    const r = await montarDashboard("2026-09", AGORA);

    expect(r.chamados.semanas).toHaveLength(8);
    expect(r.chamados.semanas[0].inicio).toBe("2026-08-10");
    expect(r.chamados.semanas[7].inicio).toBe("2026-09-28");

    const semana = (inicio: string) => r.chamados.semanas.find((s) => s.inicio === inicio)!;
    expect(semana("2026-08-17")).toMatchObject({ abertos: 1, concluidos: 1 }); // chamado de agosto
    expect(semana("2026-08-31")).toMatchObject({ abertos: 2, concluidos: 0 });
    expect(semana("2026-09-07")).toMatchObject({ abertos: 0, concluidos: 2 });
    expect(semana("2026-09-14")).toMatchObject({ abertos: 2, concluidos: 0 });
    expect(semana("2026-09-21")).toMatchObject({ abertos: 0, concluidos: 1 });
    expect(semana("2026-09-28")).toMatchObject({ abertos: 1, concluidos: 0 });

    // só os chamados abertos DENTRO de setembro (o de agosto fica de fora)
    expect(r.chamados.porCliente.map((i) => [i.rotulo, i.quantidade])).toEqual([["CLIENTE A", 3], ["CLIENTE B", 1], ["Sem cliente", 1]]);
    expect(r.chamados.porArea.map((i) => [i.rotulo, i.quantidade])).toEqual([["Sem área", 3], ["SUPORTE", 2]]);
  });

  it("qualidade: dias sem apontamento (mais dias primeiro) e permissão de apontar no passado esquecida", async () => {
    bancoFalso(BANCO);

    const r = await montarDashboard("2026-09", AGORA);

    expect(r.qualidade.diasSemApontamento[0]).toMatchObject({ codigo: 50, nome: "CARLA DIAS", quantidade: diasUteisDeSetembro });
    // lista TODOS os dias do mês sem apontamento (a tela mostra uma linha por consultor)
    expect(r.qualidade.diasSemApontamento[0].dias).toHaveLength(diasUteisDeSetembro);
    // ANA: data-limite renovada no dia 1º do mês passado = normal; CARLA: julho = esquecida
    expect(r.qualidade.permissoesAntigas.map((p) => [p.codigo, p.dataLimite])).toEqual([[50, "2026-07-01"]]);
  });

  it("mês em andamento: compara com o mês anterior no MESMO ponto e não conta hoje como dia passado", async () => {
    bancoFalso({
      ...BANCO,
      "OS.DTINC_OS": [
        // 01/10 e 02/10 (hoje) em outubro; setembro inteiro para comparar
        os(10, d(10, 1), "0800", "1200"),
        os(10, d(9, 1), "0800", "1200"),
        os(10, d(9, 2), "0800", "1600"),
        os(10, d(9, 30), "0800", "1600"),
      ],
    });

    const r = await montarDashboard("2026-10", AGORA);
    const ana = r.consultores.find((c) => c.codigo === 10)!;

    expect(r.ehMesAtual).toBe(true);
    expect(ana.horasMin).toBe(240);
    // 02/10 (hoje) ainda não tem OS: só 01/10 é "dia decorrido", então compara com o 1º dia útil de setembro (01/09)
    expect(ana.horasMesAnteriorMin).toBe(240);
    expect(ana.variacao).toBe(0);
    // dias úteis passados: só 01/10 (hoje não conta)
    expect(ana.diasUteisPassados).toBe(1);
    expect(ana.diasSemApontamento).toEqual([]);
    expect(r.chamados.semanas[7].inicio).toBe("2026-09-28");
  });

  it("banco vazio: tudo zerado, sem quebrar", async () => {
    bancoFalso({});

    const r = await montarDashboard("2026-09", AGORA);

    expect(r.consultores).toEqual([]);
    expect(r.visao).toMatchObject({ consultoresAtivos: 0, horasMin: 0, percentualMeta: null, chamadosAbertos: 0, tarefasEmRisco: 0 });
    expect(r.chamados.semanas).toHaveLength(8);
    expect(r.tarefas).toEqual({ emRisco: [], comEstouroLiberado: [] });
  });

  it("erro do banco sobe para quem chamou e ainda fecha a conexão", async () => {
    const detach = vi.fn();
    getConnection.mockImplementation((cb: (err: unknown, db: unknown) => void) =>
      cb(null, { query: (_s: string, _p: unknown[], done: (e: unknown) => void) => done(new Error("banco fora")), detach }),
    );

    await expect(montarDashboard("2026-09", AGORA)).rejects.toThrow("banco fora");
    expect(detach).toHaveBeenCalledTimes(1);
  });
});
