// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Banco falso COM ESTADO ──────────────────────────────────────────────────
// Guarda linhas de verdade, tem chave primária e reproduz a regra do Firebird
// que importa aqui: um INSERT com a mesma chave de uma transação AINDA ABERTA
// espera essa transação terminar e, se ela confirmou, falha com 335544665.
// (A leitura NÃO espera: é o pior caso, em que dois gravadores leem o mesmo MAX.)

type Linha = Record<string, any>;
type TabelaDef = { pk: string; linhas: Linha[] };

const { banco, getConnection, regras, validHours, emails } = vi.hoisted(() => {
  const banco = {
    tabelas: {} as Record<string, TabelaDef>,
    transacoes: [] as any[],
    atraso: 4,
    eventos: [] as string[],
    // imita o driver real: INSERT que perde a disputa pela chave devolve "ok" e a linha some
    silencioso: false,
  };

  return {
    banco,
    getConnection: vi.fn(),
    regras: {
      validarApontamento: vi.fn(),
      validarPosseChamado: vi.fn(),
      validarPosseOs: vi.fn(),
    },
    validHours: vi.fn(),
    emails: vi.fn(),
  };
});

vi.mock("./firebird", () => ({ Firebird: { ISOLATION_READ_COMMITTED: [] }, getConnection }));
vi.mock("./email/email", () => ({ sendEmail: emails }));
vi.mock("./tarefa/valid-hours", () => ({ default: validHours }));
vi.mock("./call/valid-hours", () => ({ default: validHours }));
// só as validações que vão ao banco são trocadas; a conferência dentro da transação é a de verdade
vi.mock("./os/regras-apontamento", async (original) => ({
  ...(await original<typeof import("./os/regras-apontamento")>()),
  validarApontamento: regras.validarApontamento,
  validarPosseChamado: regras.validarPosseChamado,
  validarPosseOs: regras.validarPosseOs,
}));

import ApointService from "./os/apoint";
import DeleteOsService from "./os/delete";
import UpdateOsService from "./os/update";
import StartCallService from "./call/start";
import ChangeStatusService from "./call/change-status";
import StandbyService from "./call/standby";
import UpdateCallTaskService from "./call/update";
import UpdateCallClassService from "./call/updateClassificacao";
import UpdateAcesso from "./tarefa/acesso";
import { CODIGO_CHAVE_DUPLICADA } from "./transacao";
import { ErroDeRegra } from "./erro-regra";

const chaveDuplicada = (tabela: string) =>
  Object.assign(new Error(`Violation of PRIMARY or UNIQUE KEY constraint "PK_${tabela}" on table "${tabela}"`), { gdscode: CODIGO_CHAVE_DUPLICADA });

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

function nova(tabela: string, pk: string, linhas: Linha[] = []) {
  banco.tabelas[tabela] = { pk, linhas };
}

function maximo(tabela: string, coluna: string, extra: Linha[] = []) {
  const valores = [...banco.tabelas[tabela].linhas, ...extra].map((l) => l[coluna]).filter((v) => v !== null && v !== undefined);

  return valores.length ? valores.reduce((a, b) => (a > b ? a : b)) : null;
}

// Interpreta só os SQLs que os serviços usam
async function executarSql(tx: any, sql: string, p: any[]): Promise<any[]> {
  const s = sql.replace(/\s+/g, " ").trim();
  await dormir(banco.atraso);

  let m: RegExpMatchArray | null;

  if ((m = s.match(/^SELECT MAX\((\w+)\) AS (\w+) FROM (\w+)$/i))) {
    const [, coluna, alias, tabela] = m;

    return [{ [alias]: maximo(tabela.toUpperCase(), coluna.toUpperCase(), tx.pendentes[tabela.toUpperCase()] ?? []) }];
  }
  if ((m = s.match(/^SELECT COUNT\(\*\) AS N FROM OS WHERE COD_OS = \? AND CODREC_OS = \?$/i))) {
    return [{ N: banco.tabelas.OS.linhas.filter((l) => l.COD_OS === p[0] && String(l.CODREC_OS) === String(p[1])).length }];
  }
  if ((m = s.match(/^SELECT COUNT\(\*\) AS N FROM HISTCHAMADO WHERE COD_HISTCHAMADO = \? AND COD_CHAMADO = \?$/i))) {
    return [{ N: banco.tabelas.HISTCHAMADO.linhas.filter((l) => l.COD_HISTCHAMADO === p[0] && String(l.COD_CHAMADO) === String(p[1])).length }];
  }
  if (/^SELECT MAX\(DTINI_OS\) AS DATA, MAX\(HRFIM_OS\) AS HORA FROM OS WHERE CHAMADO_OS/i.test(s)) return [{ DATA: null, HORA: null }];
  if (/^SELECT Max\(OS\.num_os\) as num_os/i.test(s)) return [{ NUM_OS: null }];
  if (/^SELECT STATUS_CHAMADO FROM CHAMADO/i.test(s)) {
    const c = banco.tabelas.CHAMADO.linhas.find((l) => String(l.COD_CHAMADO) === String(p[0]));

    return c ? [{ STATUS_CHAMADO: c.STATUS_CHAMADO }] : [];
  }
  if (/^SELECT DTINI_CHAMADO FROM CHAMADO/i.test(s)) {
    const c = banco.tabelas.CHAMADO.linhas.find((l) => String(l.COD_CHAMADO) === String(p[0]));

    return c ? [{ DTINI_CHAMADO: c.DTINI_CHAMADO ?? null }] : [];
  }
  if (/^SELECT COD_OS, HRINI_OS, HRFIM_OS FROM OS WHERE CODREC_OS/i.test(s)) {
    // enxerga o que já foi CONFIRMADO + o que esta própria transação gravou
    return [...banco.tabelas.OS.linhas, ...(tx.pendentes.OS ?? [])].filter((l) => String(l.CODREC_OS) === String(p[0]) && l.DIA === p[1]);
  }

  if ((m = s.match(/^INSERT INTO (\w+) \(([^)]+)\) VALUES/i))) {
    const tabela = m[1].toUpperCase();
    const colunas = m[2].split(",").map((c) => c.trim().toUpperCase());
    const linha: Linha = {};
    colunas.forEach((c, i) => (linha[c] = p[i]));
    if (tabela === "OS") linha.DIA = new Date(`${String(p[2]).slice(6, 10)}-${String(p[2]).slice(3, 5)}-${String(p[2]).slice(0, 2)}T00:00`).toISOString().slice(0, 10);

    const def = banco.tabelas[tabela];

    // espera qualquer outra transação ABERTA que já gravou a mesma chave
    for (const outra of banco.transacoes) {
      if (outra !== tx && !outra.finalizada && (outra.pendentes[tabela] ?? []).some((l: Linha) => l[def.pk] === linha[def.pk])) await outra.fim;
    }
    if (def.linhas.some((l) => l[def.pk] === linha[def.pk])) {
      // o driver real devolve "ok" e perde a gravação quando a disputa foi com uma transação em andamento
      if (banco.silencioso) return [];
      throw chaveDuplicada(tabela);
    }

    (tx.pendentes[tabela] ??= []).push(linha);
    banco.eventos.push(`insert ${tabela} ${linha[def.pk]}`);

    return [];
  }
  if ((m = s.match(/^UPDATE CHAMADO SET STATUS_CHAMADO = \?/i))) {
    // standby: (status, cod) | início e troca de status: (status, data, cod, ...)
    const cod = /DTINI_CHAMADO|CONCLUSAO_CHAMADO/i.test(s) ? p[2] : p[1];

    tx.alteracoes.push({ tabela: "CHAMADO", chave: ["COD_CHAMADO", cod], campos: { STATUS_CHAMADO: p[0] } });

    return [];
  }
  if (/^UPDATE OS SET/i.test(s)) {
    tx.alteracoes.push({ tabela: "OS", chave: ["COD_OS", p[4]], campos: { HRINI_OS: p[1], HRFIM_OS: p[2] } });

    return [];
  }
  if (/^UPDATE CLIENTE SET ACESSO_CLIENTE=\? WHERE COD_CLIENTE=\?$/i.test(s) || /^UPDATE CHAMADO SET CHAMADO\.(CODTRF_CHAMADO|COD_CLASSIFICACAO) =\? WHERE CHAMADO\.COD_CHAMADO =\?$/i.test(s)) {
    return [];
  }
  if (/^DELETE FROM OS WHERE COD_OS = \?/i.test(s)) {
    tx.exclusoes.push({ tabela: "OS", chave: ["COD_OS", p[0]] });

    return [];
  }

  throw new Error(`SQL não previsto no banco falso: ${s.slice(0, 80)}`);
}

function abrirTransacao() {
  let finalizar!: () => void;
  const tx: any = {
    pendentes: {} as Record<string, Linha[]>,
    alteracoes: [] as any[],
    exclusoes: [] as any[],
    finalizada: false,
    fim: new Promise<void>((r) => (finalizar = r)),
    query(sql: string, params: any[], cb: (e: unknown, r?: any[]) => void) {
      executarSql(tx, sql, params).then((r) => cb(null, r), (e) => cb(e));
    },
    commit(cb: (e?: unknown) => void) {
      setTimeout(() => {
        for (const [tabela, linhas] of Object.entries(tx.pendentes)) banco.tabelas[tabela].linhas.push(...(linhas as Linha[]));
        for (const a of tx.alteracoes) {
          const l = banco.tabelas[a.tabela].linhas.find((x) => String(x[a.chave[0]]) === String(a.chave[1]));
          if (l) Object.assign(l, a.campos);
        }
        for (const e of tx.exclusoes) {
          const t = banco.tabelas[e.tabela];
          t.linhas = t.linhas.filter((x) => String(x[e.chave[0]]) !== String(e.chave[1]));
        }
        tx.finalizada = true;
        finalizar();
        banco.eventos.push("commit");
        cb();
      }, banco.atraso);
    },
    rollback(cb: () => void) {
      tx.finalizada = true;
      finalizar();
      banco.eventos.push("rollback");
      cb();
    },
  };
  banco.transacoes.push(tx);

  return tx;
}

const ENTRADA = { COD_TAREFA: 1771, NOME_TAREFA: "TESTES", RESPCLI_PROJETO: "X", FATURA_TAREFA: "SIM" };
const CHAMADO = { COD_CHAMADO: 100, CODTRF_CHAMADO: 1771, ASSUNTO_CHAMADO: "Assunto", EMAIL_CHAMADO: "c@x.com" };
const TAREFA = [{ COD_TAREFA: 1771, RESPCLI_PROJETO: "X" }];

beforeEach(() => {
  banco.tabelas = {};
  banco.transacoes = [];
  banco.eventos = [];
  banco.atraso = 4;
  banco.silencioso = false;
  nova("OS", "COD_OS", [{ COD_OS: 100, NUM_OS: "000010", CODREC_OS: 152, DIA: "2026-09-01", HRINI_OS: "0800", HRFIM_OS: "0900" }]);
  nova("HISTCHAMADO", "COD_HISTCHAMADO", [{ COD_HISTCHAMADO: 500 }]);
  nova("CHAMADO", "COD_CHAMADO", [{ COD_CHAMADO: 100, STATUS_CHAMADO: "EM ATENDIMENTO", DTINI_CHAMADO: null }]);

  getConnection.mockReset();
  getConnection.mockImplementation((cb: (e: unknown, db: unknown) => void) =>
    cb(null, {
      transaction: (_i: unknown, c: (e: unknown, t: unknown) => void) => c(null, abrirTransacao()),
      query: (sql: string, params: any[], done: (e: unknown, r?: any[]) => void) => {
        executarSql({ pendentes: {}, alteracoes: [], exclusoes: [] }, sql, params).then((r) => done(null, r), (e) => done(e));
      },
      detach: () => {},
    }),
  );
  Object.values(regras).forEach((f) => f.mockReset());
  validHours.mockReset().mockResolvedValue([600, 60]);
  emails.mockReset().mockResolvedValue(undefined);
});

const ids = (tabela: string, pk: string) => banco.tabelas[tabela].linhas.map((l) => l[pk]);

describe("apontamento em tarefa (os/apoint)", () => {
  it("grava a OS com o próximo número e só responde depois do commit", async () => {
    await expect(ApointService(ENTRADA, "descricao", "2026-10-02", "09:00", "10:00", "152", TAREFA)).resolves.toBe(true);

    expect(ids("OS", "COD_OS")).toEqual([100, 101]);
    expect(banco.eventos).toEqual(["insert OS 101", "commit"]);
  });

  it("DOIS consultores gravando ao mesmo tempo: os dois dão certo, com números diferentes e sem tentativa perdida (as gravações andam em fila)", async () => {
    await Promise.all([
      ApointService(ENTRADA, "a", "2026-10-02", "09:00", "10:00", "152", TAREFA),
      ApointService({ ...ENTRADA, COD_TAREFA: 1099 }, "b", "2026-10-02", "09:00", "10:00", "153", TAREFA),
    ]);

    expect(ids("OS", "COD_OS").sort()).toEqual([100, 101, 102]);
    expect(banco.eventos.filter((e) => e === "rollback")).toHaveLength(0); // ninguém perdeu a disputa
  });

  it("DEZ consultores simultâneos: todos terminam e nenhum número se repete", async () => {
    await Promise.all(
      Array.from({ length: 10 }, (_, i) => ApointService(ENTRADA, `d${i}`, "2026-10-02", "09:00", "10:00", String(200 + i), TAREFA)),
    );

    const numeros = ids("OS", "COD_OS");

    expect(numeros).toHaveLength(11);
    expect(new Set(numeros).size).toBe(11);
  });

  it("clique duplo no mesmo horário: grava UMA vez; a segunda recebe o aviso de conflito (sem OS duplicada)", async () => {
    const resultados = await Promise.allSettled([
      ApointService(ENTRADA, "a", "2026-10-02", "09:00", "10:00", "152", TAREFA),
      ApointService(ENTRADA, "a", "2026-10-02", "09:00", "10:00", "152", TAREFA),
    ]);

    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const recusada = resultados.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(recusada.reason).toBeInstanceOf(ErroDeRegra);
    expect(recusada.reason.message).toContain("Conflito de horário");
    expect(ids("OS", "COD_OS")).toEqual([100, 101]); // só uma OS nova
  });

  it("três cliques seguidos em horários diferentes do mesmo dia: todos gravam, em ordem, sem disputa de número", async () => {
    await Promise.all(
      ["08:00", "09:00", "10:00"].map((h, i) => ApointService(ENTRADA, "x", "2026-10-02", h, `${h.slice(0, 2)}:30`, "152", TAREFA)),
    );

    expect(ids("OS", "COD_OS")).toEqual([100, 101, 102, 103]);
    expect(banco.eventos.filter((e) => e === "rollback")).toHaveLength(0); // a trava evitou o empate
  });

  it("horário já ocupado por OS confirmada: recusa DENTRO da transação, faz rollback e não grava", async () => {
    banco.tabelas.OS.linhas.push({ COD_OS: 101, CODREC_OS: 152, DIA: "2026-10-02", HRINI_OS: "0900", HRFIM_OS: "1000" });

    await expect(ApointService(ENTRADA, "a", "2026-10-02", "09:30", "10:30", "152", TAREFA)).rejects.toBeInstanceOf(ErroDeRegra);

    expect(ids("OS", "COD_OS")).toEqual([100, 101]);
    expect(banco.eventos).toEqual(["rollback"]);
  });

  it("limite de horas estourado: recusa antes de abrir qualquer transação", async () => {
    validHours.mockResolvedValue([60, 120, "NAO"]); // limite 60 min, total 120 e a tarefa não pode exceder

    await expect(ApointService(ENTRADA, "a", "2026-10-02", "09:00", "10:00", "152", TAREFA)).rejects.toBeInstanceOf(ErroDeRegra);
    expect(getConnection).not.toHaveBeenCalled();
  });

  it("erro de regra das validações prévias é repassado sem tocar no banco", async () => {
    regras.validarApontamento.mockRejectedValue(new ErroDeRegra("descrição curta"));

    await expect(ApointService(ENTRADA, "a", "2026-10-02", "09:00", "10:00", "152", TAREFA)).rejects.toThrow("descrição curta");
    expect(getConnection).not.toHaveBeenCalled();
  });
});

describe("disputa com outro programa (ex.: sistema legado em Delphi) que a trava do processo não cobre", () => {
  it("o driver perde o INSERT em silêncio: a confirmação percebe, refaz com outro número e a OS fica gravada", async () => {
    banco.silencioso = true;

    // o outro programa já inseriu a OS 101 e ainda não confirmou
    const externo = abrirTransacao();
    externo.pendentes.OS = [{ COD_OS: 101, CODREC_OS: 999, DIA: "2026-10-02", HRINI_OS: "0300", HRFIM_OS: "0330" }];
    setTimeout(() => externo.commit(() => {}), 40);

    await expect(ApointService(ENTRADA, "descricao", "2026-10-02", "09:00", "10:00", "152", TAREFA)).resolves.toBe(true);

    // a OS 101 é do outro programa; a nossa ficou com o número seguinte (nada se perdeu)
    expect(banco.tabelas.OS.linhas.map((l) => [l.COD_OS, String(l.CODREC_OS)])).toEqual([[100, "152"], [101, "999"], [102, "152"]]);
    // a 1ª tentativa "deu certo" no banco falso mas a OS sumiu: duas confirmações de transação
    expect(banco.eventos.filter((e) => e === "commit").length).toBeGreaterThanOrEqual(2);
  });

  it("o mesmo vale para o histórico do chamado (iniciar chamado)", async () => {
    banco.silencioso = true;
    const externo = abrirTransacao();
    externo.pendentes.HISTCHAMADO = [{ COD_HISTCHAMADO: 501, COD_CHAMADO: 777 }];
    setTimeout(() => externo.commit(() => {}), 40);

    await expect(StartCallService("100")).resolves.toBe(true);

    expect(banco.tabelas.HISTCHAMADO.linhas.map((l) => [l.COD_HISTCHAMADO, String(l.COD_CHAMADO)])).toEqual([[500, undefined], [501, "777"], [502, "100"]].map(([a, b]) => [a, b === undefined ? "undefined" : b]));
  });
});

describe("standby do chamado (call/standby)", () => {
  it("atualiza o status, grava histórico e OS numa transação só", async () => {
    await StandbyService(CHAMADO, "desc", "2026-10-02", "09:00", "10:00", "STANDBY", TAREFA, 152);

    expect(ids("OS", "COD_OS")).toEqual([100, 101]);
    expect(ids("HISTCHAMADO", "COD_HISTCHAMADO")).toEqual([500, 501]);
    expect(banco.tabelas.CHAMADO.linhas[0].STATUS_CHAMADO).toBe("STANDBY");
    expect(banco.eventos.filter((e) => e === "commit")).toHaveLength(1);
  });

  it("dois standbys de consultores diferentes ao mesmo tempo: números de OS e de histórico não se repetem", async () => {
    banco.tabelas.CHAMADO.linhas.push({ COD_CHAMADO: 200, STATUS_CHAMADO: "EM ATENDIMENTO" });

    await Promise.all([
      StandbyService(CHAMADO, "a", "2026-10-02", "09:00", "10:00", "STANDBY", TAREFA, 152),
      StandbyService({ ...CHAMADO, COD_CHAMADO: 200 }, "b", "2026-10-02", "09:00", "10:00", "STANDBY", TAREFA, 153),
    ]);

    expect(new Set(ids("OS", "COD_OS")).size).toBe(3);
    expect(new Set(ids("HISTCHAMADO", "COD_HISTCHAMADO")).size).toBe(3);
  });

  it("chamado finalizado: recusa, faz rollback e não grava nada", async () => {
    banco.tabelas.CHAMADO.linhas[0].STATUS_CHAMADO = "FINALIZADO";

    await expect(StandbyService(CHAMADO, "d", "2026-10-02", "09:00", "10:00", "STANDBY", TAREFA, 152)).rejects.toThrow("Chamado já finalizado");

    expect(ids("OS", "COD_OS")).toEqual([100]);
    expect(ids("HISTCHAMADO", "COD_HISTCHAMADO")).toEqual([500]);
  });

  it("e-mail de validação só sai DEPOIS do commit, e só para 'Aguardando validação'", async () => {
    await StandbyService(CHAMADO, "d", "2026-10-02", "09:00", "10:00", "STANDBY", TAREFA, 152);
    expect(emails).not.toHaveBeenCalled();

    banco.tabelas.CHAMADO.linhas[0].STATUS_CHAMADO = "EM ATENDIMENTO";
    await StandbyService(CHAMADO, "d", "2026-10-02", "11:00", "12:00", "AGUARDANDO VALIDACAO", TAREFA, 152);
    expect(emails).toHaveBeenCalledTimes(1);
    expect(banco.eventos.lastIndexOf("commit")).toBeGreaterThan(-1);
  });

  it("falha no e-mail não derruba a gravação já confirmada", async () => {
    emails.mockRejectedValue(new Error("smtp fora"));
    const espiao = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(StandbyService(CHAMADO, "d", "2026-10-02", "09:00", "10:00", "AGUARDANDO VALIDACAO", TAREFA, 152)).resolves.toBe(true);
    espiao.mockRestore();
  });
});

describe("iniciar chamado e trocar status", () => {
  it("iniciar: Em atendimento + histórico com número novo; chamado inexistente é recusado", async () => {
    await StartCallService("100");

    expect(ids("HISTCHAMADO", "COD_HISTCHAMADO")).toEqual([500, 501]);
    await expect(StartCallService("999")).rejects.toBeInstanceOf(ErroDeRegra);
  });

  it("dois históricos simultâneos (início e troca de status) não repetem número", async () => {
    banco.tabelas.CHAMADO.linhas.push({ COD_CHAMADO: 200, STATUS_CHAMADO: "STANDBY" });

    await Promise.all([StartCallService("100"), ChangeStatusService("200", "AGUARDANDO VALIDACAO", "c@x.com")]);

    expect(new Set(ids("HISTCHAMADO", "COD_HISTCHAMADO")).size).toBe(3);
  });

  it("transição proibida de status vira erro de regra, sem gravar", async () => {
    // para FINALIZADO o chamado precisa estar em AGUARDANDO VALIDACAO
    await expect(ChangeStatusService("100", "FINALIZADO")).rejects.toBeInstanceOf(ErroDeRegra);

    expect(ids("HISTCHAMADO", "COD_HISTCHAMADO")).toEqual([500]);
  });
});

describe("editar e excluir OS", () => {
  it("excluir só responde depois do commit e a OS some do banco", async () => {
    await expect(DeleteOsService(100, 152)).resolves.toBe(true);

    expect(ids("OS", "COD_OS")).toEqual([]);
    expect(banco.eventos).toEqual(["commit"]);
  });

  it("excluir de OS que não é do consultor: erro de regra e nada é apagado", async () => {
    regras.validarPosseOs.mockRejectedValue(new ErroDeRegra("não é sua"));

    await expect(DeleteOsService(100, 152)).rejects.toThrow("não é sua");
    expect(ids("OS", "COD_OS")).toEqual([100]);
  });

  it("editar: conferência de conflito dentro da transação ignora a própria OS", async () => {
    regras.validarPosseOs.mockResolvedValue({ HRINI_OS: "0800", HRFIM_OS: "0900", CHAMADO_OS: null, CODTRF_OS: 1771 });

    await expect(UpdateOsService(100, "nova descricao", "2026-09-01", "08:00", "09:00", 152)).resolves.toBe(true);
    expect(banco.eventos).toEqual(["commit"]);
  });

  it("editar para cima de outra OS: recusa e faz rollback", async () => {
    banco.tabelas.OS.linhas.push({ COD_OS: 101, CODREC_OS: 152, DIA: "2026-09-01", HRINI_OS: "1000", HRFIM_OS: "1100" });
    regras.validarPosseOs.mockResolvedValue({ HRINI_OS: "0800", HRFIM_OS: "0900", CHAMADO_OS: null, CODTRF_OS: 1771 });

    await expect(UpdateOsService(100, "x", "2026-09-01", "10:30", "11:30", 152)).rejects.toThrow("Conflito de horário");
    expect(banco.eventos).toEqual(["rollback"]);
  });
});

describe("demais gravações (acesso do cliente, tarefa e classificação do chamado)", () => {
  it("só respondem depois do commit terminar", async () => {
    await expect(UpdateAcesso("usuario: x senha: y", 55)).resolves.toBe(true);
    await expect(UpdateCallTaskService(100, 1771)).resolves.toBe(true);
    await expect(UpdateCallClassService(100, 3)).resolves.toBe(true);

    // cada uma: abre, grava e confirma (commit) antes de responder
    expect(banco.eventos.filter((e) => e === "commit")).toHaveLength(3);
    expect(banco.eventos.filter((e) => e === "rollback")).toHaveLength(0);
  });

  it("falha no banco: erro repassado e rollback (nada fica pela metade)", async () => {
    getConnection.mockImplementation((cb: (e: unknown, db: unknown) => void) =>
      cb(null, {
        transaction: (_i: unknown, c: (e: unknown, t: unknown) => void) => {
          const tx = abrirTransacao();
          tx.query = (_sql: string, _p: unknown[], done: (e: unknown) => void) => done(new Error("banco fora"));
          c(null, tx);
        },
        detach: () => {},
      }),
    );

    await expect(UpdateAcesso("x", 55)).rejects.toThrow("banco fora");
    expect(banco.eventos).toContain("rollback");
    expect(banco.eventos).not.toContain("commit");
  });
});
