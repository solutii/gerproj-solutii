// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import {
  HASH_INICIAL,
  lerHistorico,
  listarMesesDeAuditoria,
  mesDoRegistro,
  registrarAuditoria,
  verificarCorrente,
  type EntradaAuditoria,
} from "./auditoria";

let dir: string;

const ator = { codUsuario: 7, nome: "ADMINISTRADOR", login: "ADM1", ip: "10.0.0.5" };
const alteracao = (codigo = 152, antes: Record<string, unknown> = { permiteApontarNoPassado: "NAO" }, depois: Record<string, unknown> = { permiteApontarNoPassado: "SIM" }): EntradaAuditoria => ({
  tipo: "alteracao",
  ator,
  acao: "consultor.atualizar",
  alvo: { tipo: "consultor", codigo, nome: "FULANO DE TAL" },
  antes,
  depois,
});

const dia = (s: string) => new Date(`${s}T15:00:00Z`);
const arquivoDe = (mes: string) => path.join(dir, `auditoria-${mes}.log`);
const linhas = async (mes: string) => (await fs.readFile(arquivoDe(mes), "utf8")).split("\n").filter(Boolean);

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "auditoria-"));
  process.env.AUDITORIA_DIR = dir;
});

afterEach(async () => {
  delete process.env.AUDITORIA_DIR;
  await fs.rm(dir, { recursive: true, force: true });
});

describe("registrarAuditoria", () => {
  it("cria o arquivo do mês na pasta (inclusive se a pasta ainda não existe) e encadeia as linhas", async () => {
    await fs.rm(dir, { recursive: true, force: true });

    const h1 = await registrarAuditoria(alteracao(1), dia("2026-10-02"));
    const h2 = await registrarAuditoria(alteracao(2), dia("2026-10-02"));

    const [l1, l2] = (await linhas("2026-10")).map((l) => JSON.parse(l));
    expect(l1.prev).toBe(HASH_INICIAL);
    expect(l1.hash).toBe(h1);
    expect(l2.prev).toBe(h1);
    expect(l2.hash).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("registra quem, quando, o quê e antes/depois, e nada além disso (sem segredo)", async () => {
    await registrarAuditoria(alteracao(152, { jornada: "0800" }, { jornada: "0848" }), dia("2026-10-02"));

    const l = JSON.parse((await linhas("2026-10"))[0]);

    expect(Object.keys(l).sort()).toEqual(["acao", "alvo", "antes", "ator", "depois", "hash", "prev", "tipo", "ts"]);
    expect(l.ator).toEqual(ator);
    expect(l.alvo).toEqual({ tipo: "consultor", codigo: 152, nome: "FULANO DE TAL" });
    expect(l.antes).toEqual({ jornada: "0800" });
    expect(l.depois).toEqual({ jornada: "0848" });
    expect(l.ts).toBe("2026-10-02T15:00:00.000Z");
  });

  it("na virada do mês, o primeiro registro do arquivo novo se liga ao último do mês anterior", async () => {
    const ultimoDeSetembro = await registrarAuditoria(alteracao(1), dia("2026-09-30"));
    await registrarAuditoria(alteracao(2), dia("2026-10-01"));

    expect(JSON.parse((await linhas("2026-10"))[0]).prev).toBe(ultimoDeSetembro);
    expect(await listarMesesDeAuditoria()).toEqual(["2026-10", "2026-09"]);
  });

  it("o mês vem do fuso de Brasília (21h do dia 30 em Brasília já é dia 1 em UTC)", async () => {
    expect(mesDoRegistro(new Date("2026-10-01T02:00:00Z"))).toBe("2026-09");
    expect(mesDoRegistro(new Date("2026-10-01T03:00:00Z"))).toBe("2026-10");
  });

  it("vinte registros simultâneos: nenhuma linha se perde e a corrente fica íntegra", async () => {
    await Promise.all(Array.from({ length: 20 }, (_, i) => registrarAuditoria(alteracao(i + 1), dia("2026-10-02"))));

    const brutas = await linhas("2026-10");
    const { problemas } = verificarCorrente(brutas, "x.log");

    expect(brutas).toHaveLength(20);
    expect(problemas).toEqual([]);
  });

  it("NÃO conseguir gravar faz a função lançar erro (quem chama recusa a alteração)", async () => {
    // a "pasta" de auditoria é, na verdade, um arquivo: impossível criar logs dentro dele
    const arquivo = path.join(os.tmpdir(), `nao-e-pasta-${Date.now()}`);
    await fs.writeFile(arquivo, "x");
    process.env.AUDITORIA_DIR = arquivo;

    await expect(registrarAuditoria(alteracao(), dia("2026-10-02"))).rejects.toThrow();

    await fs.rm(arquivo, { force: true });
  });

  it("última linha corrompida: recusa registrar (não encadeia em cima de lixo)", async () => {
    await registrarAuditoria(alteracao(1), dia("2026-10-02"));
    await fs.appendFile(arquivoDe("2026-10"), "{linha quebrada\n");

    await expect(registrarAuditoria(alteracao(2), dia("2026-10-02"))).rejects.toThrow(/ilegível/);
  });
});

describe("verificarCorrente (adulteração)", () => {
  async function tresLinhas() {
    await registrarAuditoria(alteracao(1), dia("2026-10-02"));
    await registrarAuditoria(alteracao(2), dia("2026-10-02"));
    await registrarAuditoria(alteracao(3), dia("2026-10-02"));

    return linhas("2026-10");
  }

  it("corrente íntegra: sem problemas", async () => {
    expect(verificarCorrente(await tresLinhas(), "a.log").problemas).toEqual([]);
  });

  it("conteúdo editado no meio é denunciado, com a linha", async () => {
    const brutas = await tresLinhas();
    const l2 = JSON.parse(brutas[1]);
    l2.depois = { permiteApontarNoPassado: "NAO" }; // alguém "corrige" o histórico
    brutas[1] = JSON.stringify(l2);

    const { problemas } = verificarCorrente(brutas, "a.log");

    expect(problemas.map((p) => p.linha)).toContain(2);
    expect(problemas.find((p) => p.linha === 2)?.motivo).toContain("hash não confere");
  });

  it("linha apagada no meio é denunciada na linha seguinte", async () => {
    const brutas = await tresLinhas();
    brutas.splice(1, 1);

    const { problemas } = verificarCorrente(brutas, "a.log");

    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toMatchObject({ linha: 2, motivo: expect.stringContaining("falta uma linha") });
  });

  it("ordem trocada e linha ilegível também são denunciadas", async () => {
    const brutas = await tresLinhas();

    expect(verificarCorrente([brutas[1], brutas[0], brutas[2]], "a.log").problemas.length).toBeGreaterThan(0);
    expect(verificarCorrente([brutas[0], "{quebrada", brutas[2]], "a.log").problemas.map((p) => p.motivo).join()).toContain("ilegível");
  });

  it("conferência do elo com o arquivo anterior (apagar o último do mês anterior é percebido)", async () => {
    const hashAnterior = await registrarAuditoria(alteracao(1), dia("2026-09-30"));
    await registrarAuditoria(alteracao(2), dia("2026-10-01"));
    const brutas = await linhas("2026-10");

    expect(verificarCorrente(brutas, "o.log", hashAnterior).problemas).toEqual([]);
    expect(verificarCorrente(brutas, "o.log", "f".repeat(64)).problemas).toHaveLength(1);
  });
});

describe("lerHistorico", () => {
  it("mostra as alterações mais recentes primeiro, com a situação de cada uma", async () => {
    const hashA = await registrarAuditoria(alteracao(1), dia("2026-10-02"));
    await registrarAuditoria({ tipo: "confirmacao", ator, ref: hashA, resultado: "confirmada" }, dia("2026-10-02"));
    const hashB = await registrarAuditoria(alteracao(2), dia("2026-10-03"));
    await registrarAuditoria({ tipo: "confirmacao", ator, ref: hashB, resultado: "falhou", erro: "banco fora" }, dia("2026-10-03"));
    await registrarAuditoria(alteracao(3), dia("2026-10-04")); // sem desfecho

    const h = await lerHistorico("2026-10");

    expect(h.integridade.ok).toBe(true);
    expect(h.registros.map((r) => [r.alvo.codigo, r.situacao])).toEqual([
      [3, "nao-confirmada"],
      [2, "falhou"],
      [1, "confirmada"],
    ]);
    expect(h.registros[1].erro).toBe("banco fora");
    expect(h.registros).toHaveLength(3); // as linhas de confirmação não aparecem soltas, só fecham a alteração
  });

  it("filtra por nome ou código do alvo e por quem fez", async () => {
    await registrarAuditoria(alteracao(152), dia("2026-10-02"));
    await registrarAuditoria(
      { tipo: "alteracao", ator, acao: "tarefa.atualizar", alvo: { tipo: "tarefa", codigo: 999, nome: "MIGRACAO" }, antes: { limiteMensalHoras: 10 }, depois: { limiteMensalHoras: 20 } },
      dia("2026-10-02"),
    );

    expect((await lerHistorico("2026-10", "migracao")).registros).toHaveLength(1);
    expect((await lerHistorico("2026-10", "152")).registros).toHaveLength(1);
    expect((await lerHistorico("2026-10", "adm1")).registros).toHaveLength(2);
    expect((await lerHistorico("2026-10", "xyz")).registros).toHaveLength(0);
  });

  it("mês sem arquivo: vazio e íntegro; arquivo adulterado: integridade com os problemas", async () => {
    expect(await lerHistorico("2025-01")).toEqual({ mes: "2025-01", registros: [], integridade: { ok: true, problemas: [] } });

    await registrarAuditoria(alteracao(1), dia("2026-10-02"));
    await registrarAuditoria(alteracao(2), dia("2026-10-02"));
    const brutas = await linhas("2026-10");
    await fs.writeFile(arquivoDe("2026-10"), brutas[0].replace("FULANO", "OUTRO") + "\n" + brutas[1] + "\n");

    const h = await lerHistorico("2026-10");

    expect(h.integridade.ok).toBe(false);
    expect(h.integridade.problemas[0]).toMatchObject({ arquivo: "auditoria-2026-10.log", linha: 1 });
  });
});
