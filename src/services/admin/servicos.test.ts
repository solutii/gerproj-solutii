// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "fs";
import os from "os";
import path from "path";

// ─── Banco falso ──────────────────────────────────────────────────────────────
const { getConnection, banco } = vi.hoisted(() => ({
  getConnection: vi.fn(),
  banco: {
    recurso: [] as Record<string, any>[],
    tarefa: [] as Record<string, any>[],
    consultas: [] as { sql: string; params: unknown[] }[],
    atualizacoes: [] as string[],
    perderAtualizacao: false, // imita o driver que "aceita" e não grava
    falharCommit: false,
  },
}));

vi.mock("../firebird", () => ({ Firebird: { ISOLATION_READ_COMMITTED: [] }, getConnection }));

import { atualizarConsultor, listarConsultores } from "./consultores";
import { atualizarTarefa, listarTarefas } from "./tarefas";
import { lerHistorico } from "./auditoria";
import { ErroDeRegra } from "../erro-regra";

const ATOR = { codUsuario: 7, nome: "ADMINISTRADOR", login: "ADM1", ip: "10.0.0.5" };

function lerLinhas(sql: string, params: unknown[]): Record<string, any>[] {
  const s = sql.replace(/\s+/g, " ").trim();
  banco.consultas.push({ sql: s, params });

  if (/FROM RECURSO R WHERE R\.COD_RECURSO = \?/.test(s)) return banco.recurso.filter((r) => r.COD_RECURSO === params[0]).map((r) => ({ ...r }));
  if (/FROM RECURSO R/.test(s)) {
    const termo = typeof params[0] === "string" ? params[0].replace(/%/g, "") : "";

    return banco.recurso
      .filter((r) => !/ATIVO_RECURSO = 1/.test(s) || r.ATIVO_RECURSO === 1)
      .filter((r) => !termo || String(r.NOME_RECURSO).toUpperCase().includes(termo) || String(r.COD_RECURSO).includes(termo))
      .map((r) => ({ ...r }));
  }
  if (/WHERE T\.COD_TAREFA = \?/.test(s)) return banco.tarefa.filter((t) => t.COD_TAREFA === params[0]).map((t) => ({ ...t }));
  if (/^SELECT COUNT\(\*\) AS N FROM TAREFA/.test(s)) return [{ N: banco.tarefa.length }];
  if (/^SELECT FIRST \d+ SKIP \d+/.test(s)) return banco.tarefa.map((t) => ({ ...t }));

  throw new Error(`SQL não previsto no banco falso: ${s.slice(0, 90)}`);
}

function aplicarUpdate(sql: string, params: unknown[]) {
  const s = sql.replace(/\s+/g, " ").trim();
  banco.atualizacoes.push(s);
  if (banco.perderAtualizacao) return; // o driver aceitou e perdeu

  const m = s.match(/^UPDATE (RECURSO|TAREFA) SET (.+) WHERE (\w+) = \?$/);
  if (!m) throw new Error(`UPDATE não previsto: ${s}`);

  const linhas = m[1] === "RECURSO" ? banco.recurso : banco.tarefa;
  const alvo = linhas.find((l) => l[m[3]] === params[params.length - 1]);
  if (!alvo) return;

  m[2].split(",").forEach((trecho, i) => {
    const coluna = trecho.trim().replace(/ = \?$/, "");
    let valor = params[i];
    if (coluna === "DTLIMITE_RECURSO") {
      const [d, mes, a] = String(valor).slice(0, 10).split(".").map(Number);
      valor = new Date(a, mes - 1, d);
    }
    alvo[coluna] = valor;
  });
}

const d = (a: number, m: number, dia: number) => new Date(a, m - 1, dia);
let auditoriaDir: string;

beforeEach(async () => {
  auditoriaDir = await fs.mkdtemp(path.join(os.tmpdir(), "auditoria-srv-"));
  process.env.AUDITORIA_DIR = auditoriaDir;

  banco.consultas = [];
  banco.atualizacoes = [];
  banco.perderAtualizacao = false;
  banco.falharCommit = false;
  banco.recurso = [
    { COD_RECURSO: 152, NOME_RECURSO: "ANA CLARA", ATIVO_RECURSO: 1, HRDIA_RECURSO: "0848", PERMAPO_RECURSO: "NAO", DTLIMITE_RECURSO: d(2026, 8, 1) },
    { COD_RECURSO: 153, NOME_RECURSO: "BRUNO LIMA", ATIVO_RECURSO: 0, HRDIA_RECURSO: "0800", PERMAPO_RECURSO: "SIM", DTLIMITE_RECURSO: d(2026, 1, 1) },
  ];
  banco.tarefa = [
    { COD_TAREFA: 1771, NOME_TAREFA: "TESTES E VALIDACOES", STATUS_TAREFA: 3, PERIMP_TAREFA: "NAO", LIMMES_TAREFA: 40, HRREAL_TAREFA: 12.5, NOME_CLIENTE: "SOMAPEL", NOME_RECURSO: "ANA CLARA" },
    { COD_TAREFA: 1099, NOME_TAREFA: "HORAS INTERNAS", STATUS_TAREFA: 4, PERIMP_TAREFA: "SIM", LIMMES_TAREFA: null, HRREAL_TAREFA: 0, NOME_CLIENTE: null, NOME_RECURSO: null },
  ];

  getConnection.mockReset();
  getConnection.mockImplementation((cb: (e: unknown, db: unknown) => void) =>
    cb(null, {
      query: (sql: string, params: unknown[], done: (e: unknown, r?: unknown) => void) => {
        try {
          done(null, lerLinhas(sql, params));
        } catch (e) {
          done(e);
        }
      },
      transaction: (_iso: unknown, cbTx: (e: unknown, t: unknown) => void) => {
        const pendentes: (() => void)[] = [];

        cbTx(null, {
          query: (sql: string, params: unknown[], done: (e: unknown, r?: unknown) => void) => {
            try {
              if (/^\s*UPDATE/i.test(sql)) {
                pendentes.push(() => aplicarUpdate(sql, params));
                done(null, []);
              } else done(null, lerLinhas(sql, params));
            } catch (e) {
              done(e);
            }
          },
          commit: (done: (e?: unknown) => void) => {
            if (banco.falharCommit) return done(new Error("commit falhou"));
            pendentes.forEach((f) => f());
            done();
          },
          rollback: (done: () => void) => done(),
        });
      },
      detach: () => {},
    }),
  );
});

afterEach(async () => {
  delete process.env.AUDITORIA_DIR;
  await fs.rm(auditoriaDir, { recursive: true, force: true });
});

const mesAtual = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }).slice(0, 7);

describe("consultores: listar", () => {
  it("traduz as colunas (SIM/NAO, HHMM, data) e por padrão só traz ativos", async () => {
    const lista = await listarConsultores();

    expect(lista).toEqual([{ codigo: 152, nome: "ANA CLARA", ativo: true, permiteApontarNoPassado: false, dataLimite: "2026-08-01", jornada: "08:48" }]);
    expect(banco.consultas.at(-1)!.sql).toContain("ATIVO_RECURSO = 1");
  });

  it("inclui inativos sob pedido e busca por nome ou código sem montar SQL com o texto", async () => {
    expect((await listarConsultores({ somenteAtivos: false })).map((c) => c.codigo)).toEqual([152, 153]);

    await listarConsultores({ busca: " bruno'; drop table recurso;-- ", somenteAtivos: false });
    const ultima = banco.consultas.at(-1)!;

    expect(ultima.sql).not.toContain("drop");
    expect(ultima.params[0]).toBe("%BRUNO'; DROP TABLE RECURSO;--%");
  });
});

describe("consultores: atualizar", () => {
  it("muda a permissão, registra antes/depois e fecha o registro como confirmado", async () => {
    const r = await atualizarConsultor(ATOR, 152, { permiteApontarNoPassado: "SIM" });

    expect(r).toMatchObject({ alterou: true, consultor: { codigo: 152, permiteApontarNoPassado: true } });
    expect(banco.recurso[0].PERMAPO_RECURSO).toBe("SIM");

    const h = await lerHistorico(mesAtual());
    expect(h.integridade.ok).toBe(true);
    expect(h.registros).toHaveLength(1);
    expect(h.registros[0]).toMatchObject({
      acao: "consultor.atualizar",
      situacao: "confirmada",
      ator: ATOR,
      alvo: { tipo: "consultor", codigo: 152, nome: "ANA CLARA" },
      antes: { permiteApontarNoPassado: "NAO" },
      depois: { permiteApontarNoPassado: "SIM" },
    });
  });

  it("vários campos de uma vez: um só UPDATE e um só registro, com a data no formato do banco", async () => {
    const r = await atualizarConsultor(ATOR, 152, { permiteApontarNoPassado: "SIM", dataLimite: "2026-09-01", jornada: "0900" });

    expect(r?.alterou).toBe(true);
    expect(banco.atualizacoes).toHaveLength(1);
    expect(banco.atualizacoes[0]).toBe("UPDATE RECURSO SET PERMAPO_RECURSO = ?, DTLIMITE_RECURSO = ?, HRDIA_RECURSO = ? WHERE COD_RECURSO = ?");
    expect(banco.recurso[0]).toMatchObject({ PERMAPO_RECURSO: "SIM", HRDIA_RECURSO: "0900" });
    expect(r?.consultor).toMatchObject({ dataLimite: "2026-09-01", jornada: "09:00" });

    const h = await lerHistorico(mesAtual());
    expect(h.registros).toHaveLength(1);
    expect(h.registros[0].antes).toEqual({ permiteApontarNoPassado: "NAO", dataLimite: "2026-08-01", jornada: "08:48" });
    expect(h.registros[0].depois).toEqual({ permiteApontarNoPassado: "SIM", dataLimite: "2026-09-01", jornada: "09:00" });
  });

  it("só grava e registra o que REALMENTE mudou", async () => {
    await atualizarConsultor(ATOR, 152, { permiteApontarNoPassado: "SIM", jornada: "0848" }); // jornada igual à atual

    const h = await lerHistorico(mesAtual());
    expect(h.registros[0].antes).toEqual({ permiteApontarNoPassado: "NAO" });
    expect(banco.atualizacoes[0]).toBe("UPDATE RECURSO SET PERMAPO_RECURSO = ? WHERE COD_RECURSO = ?");
  });

  it("nada mudou: não grava, não registra e avisa alterou=false", async () => {
    const r = await atualizarConsultor(ATOR, 152, { permiteApontarNoPassado: "NAO", jornada: "0848", dataLimite: "2026-08-01" });

    expect(r).toMatchObject({ alterou: false });
    expect(banco.atualizacoes).toHaveLength(0);
    expect((await lerHistorico(mesAtual())).registros).toHaveLength(0);
  });

  it("consultor inexistente: null, sem gravar e sem registro", async () => {
    expect(await atualizarConsultor(ATOR, 9999, { jornada: "0800" })).toBeNull();
    expect(banco.atualizacoes).toHaveLength(0);
    expect((await lerHistorico(mesAtual())).registros).toHaveLength(0);
  });

  it("SEM CONSEGUIR REGISTRAR A AUDITORIA a mudança é recusada: nada muda no banco", async () => {
    const arquivo = path.join(os.tmpdir(), `nao-e-pasta-${Date.now()}`);
    await fs.writeFile(arquivo, "x");
    process.env.AUDITORIA_DIR = arquivo; // impossível criar logs dentro de um arquivo

    await expect(atualizarConsultor(ATOR, 152, { permiteApontarNoPassado: "SIM" })).rejects.toThrow();

    expect(banco.recurso[0].PERMAPO_RECURSO).toBe("NAO");
    await fs.rm(arquivo, { force: true });
  });

  it("commit que falha: o banco não muda e o histórico mostra que FALHOU (nunca 'confirmada')", async () => {
    banco.falharCommit = true;

    await expect(atualizarConsultor(ATOR, 152, { jornada: "0900" })).rejects.toThrow("commit falhou");

    expect(banco.recurso[0].HRDIA_RECURSO).toBe("0848");
    const h = await lerHistorico(mesAtual());
    expect(h.registros.map((r) => r.situacao)).toEqual(["falhou"]);
    expect(h.registros[0].erro).toContain("commit falhou");
  });

  it("o driver 'aceita' e perde a gravação: a confirmação percebe, tenta de novo e, se não consegue, falha com tudo marcado como falhou", async () => {
    banco.perderAtualizacao = true;

    await expect(atualizarConsultor(ATOR, 152, { permiteApontarNoPassado: "SIM" })).rejects.toThrow(/não confirmada/i);

    expect(banco.recurso[0].PERMAPO_RECURSO).toBe("NAO");
    const h = await lerHistorico(mesAtual());
    expect(h.registros.length).toBeGreaterThan(1); // uma linha por tentativa
    expect(h.registros.every((r) => r.situacao === "falhou")).toBe(true);
    expect(h.integridade.ok).toBe(true);
  }, 20_000);

  it("duas alterações ao mesmo tempo no mesmo consultor: as duas valem, em fila, e o histórico fica íntegro", async () => {
    await Promise.all([atualizarConsultor(ATOR, 152, { permiteApontarNoPassado: "SIM" }), atualizarConsultor(ATOR, 152, { jornada: "0700" })]);

    expect(banco.recurso[0]).toMatchObject({ PERMAPO_RECURSO: "SIM", HRDIA_RECURSO: "0700" });
    const h = await lerHistorico(mesAtual());
    expect(h.registros).toHaveLength(2);
    expect(h.registros.every((r) => r.situacao === "confirmada")).toBe(true);
    expect(h.integridade.ok).toBe(true);
  });
});

describe("tarefas: listar", () => {
  it("traduz as colunas e mostra nome do status, 'Sem cliente' e 'Sem responsável'", async () => {
    const lista = await listarTarefas({ somenteAtivas: false });

    expect(lista.total).toBe(2);
    expect(lista.tarefas[0]).toEqual({
      codigo: 1771,
      nome: "TESTES E VALIDACOES",
      cliente: "SOMAPEL",
      responsavel: "ANA CLARA",
      status: 3,
      statusTexto: "Teste",
      permiteExceder: false,
      limiteMensalHoras: 40,
      horasContratadas: 12.5,
    });
    expect(lista.tarefas[1]).toMatchObject({ cliente: "Sem cliente", responsavel: "Sem responsável", statusTexto: "Concluída", permiteExceder: true, limiteMensalHoras: null });
  });

  it("paginação por FIRST/SKIP com números inteiros gerados aqui; teto de 100 por página", async () => {
    await listarTarefas({ pagina: 2, porPagina: 25 });
    expect(banco.consultas.at(-1)!.sql).toMatch(/^SELECT FIRST 25 SKIP 25 /);

    await listarTarefas({ pagina: 3, porPagina: 5000 });
    expect(banco.consultas.at(-1)!.sql).toMatch(/^SELECT FIRST 100 SKIP 200 /);

    await listarTarefas({ pagina: -4, porPagina: 0 });
    expect(banco.consultas.at(-1)!.sql).toMatch(/^SELECT FIRST 25 SKIP 0 /);

    await listarTarefas({ pagina: Number.NaN });
    expect(banco.consultas.at(-1)!.sql).toMatch(/SKIP 0 /);
  });

  it("filtro de ativas (status 1 a 3, como na aba Tarefas) e busca sempre como parâmetro", async () => {
    await listarTarefas({ busca: "x'); DELETE FROM TAREFA;--" });
    const ultima = banco.consultas.at(-1)!;

    expect(ultima.sql).toContain("T.STATUS_TAREFA IN (1, 2, 3)");
    expect(ultima.sql).not.toContain("DELETE");
    expect(ultima.params).toEqual(Array(3).fill("%X'); DELETE FROM TAREFA;--%"));

    await listarTarefas({ somenteAtivas: false });
    expect(banco.consultas.at(-1)!.sql).not.toContain("STATUS_TAREFA IN");
  });
});

describe("tarefas: atualizar", () => {
  it("libera o estouro do limite e registra", async () => {
    const r = await atualizarTarefa(ATOR, 1771, { permiteExceder: "SIM" });

    expect(r).toMatchObject({ alterou: true, tarefa: { codigo: 1771, permiteExceder: true } });
    expect(banco.tarefa[0].PERIMP_TAREFA).toBe("SIM");

    const h = await lerHistorico(mesAtual());
    expect(h.registros[0]).toMatchObject({
      acao: "tarefa.atualizar",
      situacao: "confirmada",
      alvo: { tipo: "tarefa", codigo: 1771, nome: "TESTES E VALIDACOES" },
      antes: { permiteExceder: "NAO" },
      depois: { permiteExceder: "SIM" },
    });
  });

  it("limite mensal vazio vira NULL (sem limite) e o registro mostra 40 -> null", async () => {
    const r = await atualizarTarefa(ATOR, 1771, { limiteMensalHoras: null });

    expect(r?.tarefa.limiteMensalHoras).toBeNull();
    expect(banco.tarefa[0].LIMMES_TAREFA).toBeNull();
    expect((await lerHistorico(mesAtual())).registros[0]).toMatchObject({ antes: { limiteMensalHoras: 40 }, depois: { limiteMensalHoras: null } });
  });

  it("horas com decimais: igual (dentro de 0,005) não conta como mudança; diferente grava", async () => {
    expect((await atualizarTarefa(ATOR, 1771, { horasContratadas: 12.5 }))?.alterou).toBe(false);
    expect(banco.atualizacoes).toHaveLength(0);

    const r = await atualizarTarefa(ATOR, 1771, { horasContratadas: 13.25 });
    expect(r).toMatchObject({ alterou: true, tarefa: { horasContratadas: 13.25 } });
  });

  it("tarefa inexistente: null; auditoria impossível: recusa sem mudar nada", async () => {
    expect(await atualizarTarefa(ATOR, 424242, { permiteExceder: "SIM" })).toBeNull();

    const arquivo = path.join(os.tmpdir(), `nao-e-pasta-t-${Date.now()}`);
    await fs.writeFile(arquivo, "x");
    process.env.AUDITORIA_DIR = arquivo;
    await expect(atualizarTarefa(ATOR, 1771, { permiteExceder: "SIM" })).rejects.toThrow();
    expect(banco.tarefa[0].PERIMP_TAREFA).toBe("NAO");
    await fs.rm(arquivo, { force: true });
  });

  it("erro de regra lançado no meio da gravação chega como ErroDeRegra", async () => {
    banco.tarefa = [];
    // existe na primeira checagem e some antes de gravar: simula corrida com exclusão
    const original = banco.tarefa;
    banco.tarefa.push({ COD_TAREFA: 5, NOME_TAREFA: "X", STATUS_TAREFA: 3, PERIMP_TAREFA: "NAO", LIMMES_TAREFA: 1, HRREAL_TAREFA: 1 });
    let chamadas = 0;
    const lerOriginal = getConnection.getMockImplementation()!;
    getConnection.mockImplementation((cb: (e: unknown, db: any) => void) =>
      lerOriginal((e: unknown, db: any) => {
        const transaction = db.transaction;
        db.transaction = (iso: unknown, c: (e: unknown, t: any) => void) =>
          transaction(iso, (e2: unknown, t: any) => {
            const q = t.query;
            t.query = (sql: string, p: unknown[], done: any) => {
              if (/WHERE T\.COD_TAREFA = \?/.test(sql)) {
                chamadas++;
                original.length = 0; // a tarefa "foi excluída" antes de a transação ler
              }
              return q(sql, p, done);
            };
            c(e2, t);
          });
        cb(e, db);
      }),
    );

    await expect(atualizarTarefa(ATOR, 5, { permiteExceder: "SIM" })).rejects.toBeInstanceOf(ErroDeRegra);
    expect(chamadas).toBeGreaterThan(0);
  });
});
