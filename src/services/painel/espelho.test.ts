// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getConnection } = vi.hoisted(() => ({ getConnection: vi.fn() }));

vi.mock("../firebird", () => ({ getConnection }));

import { montarEspelho } from "./espelho";

type Linha = Record<string, unknown>;

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

const d = (mes: number, dia: number) => new Date(2026, mes - 1, dia);

// com chaves: devolver o mock faria o Vitest chamá-lo como rotina de limpeza
beforeEach(() => {
  getConnection.mockReset();
});

describe("montarEspelho", () => {
  const banco = {
    "FROM RECURSO": [{ NOME_RECURSO: "FULANO DE TAL" }],
    "ORDER BY OS.DTINI_OS": [
      { COD_OS: 1, DTINI_OS: d(9, 1), HRINI_OS: "0900", HRFIM_OS: "1030", CHAMADO_OS: "100", OBS: "Ajuste do relatório", NOME_TAREFA: "T1", NOME_CLIENTE: "Cliente A" },
      { COD_OS: 2, DTINI_OS: d(9, 2), HRINI_OS: "1400", HRFIM_OS: "1500", CHAMADO_OS: null, OBS: null, NOME_TAREFA: null, NOME_CLIENTE: null },
    ],
  };

  it("monta as linhas, o total e o nome do consultor", async () => {
    bancoFalso(banco);
    const e = await montarEspelho(152, "2026-09");

    expect(e.mes).toBe("2026-09");
    expect(e.consultor).toBe("FULANO DE TAL");
    expect(e.nomeMes).toBe("setembro de 2026");
    expect(e.totalMin).toBe(150);
    expect(e.linhas).toEqual([
      { data: "2026-09-01", inicio: "09:00", fim: "10:30", minutos: 90, cliente: "Cliente A", tarefa: "T1", chamado: "100", codOs: 1, descricao: "Ajuste do relatório" },
      { data: "2026-09-02", inicio: "14:00", fim: "15:00", minutos: 60, cliente: "Sem cliente", tarefa: "Sem tarefa", chamado: "", codOs: 2, descricao: "" },
    ]);
  });

  it("só consulta (SELECT) as OS do consultor informado no mês pedido", async () => {
    const consultas = bancoFalso(banco);
    await montarEspelho(152, "2026-09");

    for (const c of consultas) expect(c.sql.trim().toUpperCase().startsWith("SELECT")).toBe(true);
    const consultaOs = consultas.find((c) => c.sql.includes("ORDER BY OS.DTINI_OS"));
    expect(consultaOs?.params).toEqual([152, "2026-09-01", "2026-09-30"]);
  });

  it("mês sem OS devolve lista vazia", async () => {
    bancoFalso({ "FROM RECURSO": [{ NOME_RECURSO: "FULANO" }], "ORDER BY OS.DTINI_OS": [] });
    const e = await montarEspelho(152, "2026-09");

    expect(e.linhas).toEqual([]);
    expect(e.totalMin).toBe(0);
  });

  it("traz a meta do mês quando o consultor tem jornada cadastrada", async () => {
    bancoFalso({ ...banco, "FROM RECURSO": [{ NOME_RECURSO: "FULANO", HRDIA_RECURSO: "0848" }] });
    const e = await montarEspelho(152, "2026-09");

    // setembro/2026: 21 dias úteis (22 seg-sex menos o feriado de 07/09)
    expect(e.meta).toEqual({ jornadaDiariaMin: 528, diasUteis: 21, metaMesMin: 528 * 21 });
  });

  it("sem jornada cadastrada a meta é omitida", async () => {
    bancoFalso({ ...banco, "FROM RECURSO": [{ NOME_RECURSO: "FULANO", HRDIA_RECURSO: null }] });
    const e = await montarEspelho(152, "2026-09");

    expect(e.meta).toBeUndefined();
  });
});
