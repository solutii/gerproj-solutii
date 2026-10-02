// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getConnection } = vi.hoisted(() => ({ getConnection: vi.fn() }));

vi.mock("../firebird", () => ({ getConnection }));

import { montarDiasPendentes } from "./pendentes";

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

describe("montarDiasPendentes", () => {
  // 02/10/2026 (sexta), 10h no fuso de Brasília
  const agora = new Date("2026-10-02T13:00:00Z");

  it("devolve os dias úteis recentes sem OS que ainda podem ser apontados", async () => {
    bancoFalso({
      "FROM RECURSO": [{ DTLIMITE_RECURSO: d(9, 29), PERMAPO_RECURSO: "NAO" }],
      "SELECT DISTINCT": [{ DTINI_OS: d(9, 29) }, { DTINI_OS: d(9, 30) }],
    });

    const r = await montarDiasPendentes(152, agora);

    expect(r.hoje).toBe("2026-10-02");
    // 29 e 30/09 têm OS; 01/10 não tem
    expect(r.dias).toEqual(["2026-10-01"]);
  });

  it("só consulta (SELECT) e sempre filtra pelo consultor da sessão", async () => {
    const consultas = bancoFalso({ "FROM RECURSO": [{ DTLIMITE_RECURSO: d(1, 1), PERMAPO_RECURSO: "SIM" }] });

    await montarDiasPendentes(152, agora);

    expect(consultas.length).toBe(2);
    for (const c of consultas) expect(c.sql.trimStart().toUpperCase().startsWith("SELECT")).toBe(true);
    expect(consultas.every((c) => c.params.includes(152))).toBe(true);
  });

  it("fecha a conexão mesmo quando a consulta falha", async () => {
    const detach = vi.fn();
    getConnection.mockImplementation((cb: (err: unknown, db: unknown) => void) =>
      cb(null, { query: (_s: string, _p: unknown[], done: (e: unknown) => void) => done(new Error("falhou")), detach }),
    );

    await expect(montarDiasPendentes(152, agora)).rejects.toThrow();
    expect(detach).toHaveBeenCalled();
  });
});
