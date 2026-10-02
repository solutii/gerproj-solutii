// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const m = vi.hoisted(() => ({
  exigirAdmin: vi.fn(),
  listarConsultores: vi.fn(),
  atualizarConsultor: vi.fn(),
  listarTarefas: vi.fn(),
  atualizarTarefa: vi.fn(),
  lerHistorico: vi.fn(),
  listarMeses: vi.fn(),
}));

vi.mock("@/services/admin/permissao", async (original) => ({
  ...(await original<typeof import("@/services/admin/permissao")>()),
  exigirAdmin: m.exigirAdmin,
}));
vi.mock("@/services/admin/consultores", () => ({ listarConsultores: m.listarConsultores, atualizarConsultor: m.atualizarConsultor }));
vi.mock("@/services/admin/tarefas", () => ({ listarTarefas: m.listarTarefas, atualizarTarefa: m.atualizarTarefa }));
vi.mock("@/services/admin/auditoria", async (original) => ({
  ...(await original<typeof import("@/services/admin/auditoria")>()),
  lerHistorico: m.lerHistorico,
  listarMesesDeAuditoria: m.listarMeses,
}));

import { GET as getConsultores } from "./consultores/route";
import { PATCH as patchConsultor } from "./consultores/[codigo]/route";
import { GET as getTarefas } from "./tarefas/route";
import { PATCH as patchTarefa } from "./tarefas/[codigo]/route";
import { GET as getHistorico } from "./historico/route";
import { ErroDeRegra } from "@/services/erro-regra";

const ATOR = { codUsuario: 7, nome: "ADMIN", login: "ADM1", ip: "10.0.0.1" };

const get = (caminho: string) => new NextRequest(`http://localhost${caminho}`);
const patch = (caminho: string, corpo: unknown, tipo = "application/json") =>
  new NextRequest(`http://localhost${caminho}`, { method: "PATCH", headers: { "content-type": tipo }, body: typeof corpo === "string" ? corpo : JSON.stringify(corpo) });
const contexto = (codigo: string) => ({ params: Promise.resolve({ codigo }) });

const negado = (status: number, error: string) => ({ ok: false, resposta: NextResponse.json({ error }, { status }) });

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.exigirAdmin.mockResolvedValue({ ok: true, ator: ATOR });
});

describe("TODA rota do painel recusa quem não é administrador (e não chega ao serviço)", () => {
  const todas: [string, () => Promise<Response>][] = [
    ["GET consultores", () => getConsultores(get("/api/admin/consultores"))],
    ["PATCH consultor", () => patchConsultor(patch("/api/admin/consultores/1", { jornada: "08:00" }), contexto("1"))],
    ["GET tarefas", () => getTarefas(get("/api/admin/tarefas"))],
    ["PATCH tarefa", () => patchTarefa(patch("/api/admin/tarefas/1", { permiteExceder: true }), contexto("1"))],
    ["GET histórico", () => getHistorico(get("/api/admin/historico"))],
  ];

  it.each(todas)("%s: consultor comum recebe 403", async (_nome, chamar) => {
    m.exigirAdmin.mockResolvedValue(negado(403, "Acesso restrito aos administradores."));

    const r = await chamar();

    expect(r.status).toBe(403);
    expect(await r.json()).toEqual({ error: "Acesso restrito aos administradores." });
    for (const f of [m.listarConsultores, m.atualizarConsultor, m.listarTarefas, m.atualizarTarefa, m.lerHistorico]) expect(f).not.toHaveBeenCalled();
  });

  it.each(todas)("%s: sem sessão recebe 401", async (_nome, chamar) => {
    m.exigirAdmin.mockResolvedValue(negado(401, "Não autenticado"));

    expect((await chamar()).status).toBe(401);
  });
});

describe("GET /api/admin/consultores", () => {
  it("lista (ativos por padrão) e repassa a busca; sem cache", async () => {
    m.listarConsultores.mockResolvedValue([{ codigo: 1 }]);

    const r = await getConsultores(get("/api/admin/consultores?busca=ana"));

    expect(await r.json()).toEqual([{ codigo: 1 }]);
    expect(m.listarConsultores).toHaveBeenCalledWith({ busca: "ana", somenteAtivos: true });
    expect(r.headers.get("cache-control")).toBe("no-store");
  });

  it("ativos=0 inclui os inativos; busca enorme é cortada em 60 caracteres", async () => {
    m.listarConsultores.mockResolvedValue([]);

    await getConsultores(get(`/api/admin/consultores?ativos=0&busca=${"a".repeat(500)}`));

    expect(m.listarConsultores).toHaveBeenCalledWith({ busca: "a".repeat(60), somenteAtivos: false });
  });

  it("erro interno: 500 genérico, sem vazar detalhe", async () => {
    m.listarConsultores.mockRejectedValue(new Error("connection lost to 10.0.0.5"));
    const espiao = vi.spyOn(console, "error").mockImplementation(() => {});

    const r = await getConsultores(get("/api/admin/consultores"));

    expect(r.status).toBe(500);
    expect(JSON.stringify(await r.json())).not.toContain("10.0.0.5");
    espiao.mockRestore();
  });
});

describe("PATCH /api/admin/consultores/[codigo]", () => {
  it("valida, normaliza e chama o serviço com o administrador da sessão", async () => {
    m.atualizarConsultor.mockResolvedValue({ consultor: { codigo: 152, jornada: "08:48" }, alterou: true });

    const r = await patchConsultor(patch("/api/admin/consultores/152", { permiteApontarNoPassado: true, jornada: "8:48" }), contexto("152"));

    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ registro: { codigo: 152, jornada: "08:48" }, alterou: true });
    expect(m.atualizarConsultor).toHaveBeenCalledWith(ATOR, 152, { permiteApontarNoPassado: "SIM", jornada: "0848" });
  });

  it("não aceita outro corpo que não JSON (415)", async () => {
    expect((await patchConsultor(patch("/api/admin/consultores/1", "jornada=08:00", "application/x-www-form-urlencoded"), contexto("1"))).status).toBe(415);
    expect(m.atualizarConsultor).not.toHaveBeenCalled();
  });

  it.each([
    ["código com lixo", "1; DROP TABLE RECURSO", { jornada: "08:00" }],
    ["campo que não pode ser alterado", "1", { ATIVO_RECURSO: 0 }],
    ["valor inválido", "1", { jornada: "99:99" }],
    ["data futura", "1", { dataLimite: "2999-01-01" }],
    ["corpo vazio", "1", {}],
  ])("recusa com 400: %s", async (_nome, codigo, corpo) => {
    const r = await patchConsultor(patch(`/api/admin/consultores/${encodeURIComponent(codigo)}`, corpo), contexto(codigo));

    expect(r.status).toBe(400);
    expect((await r.json()).error).toEqual(expect.any(String));
    expect(m.atualizarConsultor).not.toHaveBeenCalled();
  });

  it("corpo que não é JSON válido: 400", async () => {
    expect((await patchConsultor(patch("/api/admin/consultores/1", "{quebrado"), contexto("1"))).status).toBe(400);
  });

  it("consultor inexistente: 404; erro de regra: 400; erro interno: 500 sem detalhe", async () => {
    m.atualizarConsultor.mockResolvedValueOnce(null);
    expect((await patchConsultor(patch("/api/admin/consultores/9", { jornada: "08:00" }), contexto("9"))).status).toBe(404);

    m.atualizarConsultor.mockRejectedValueOnce(new ErroDeRegra("regra qualquer"));
    const regra = await patchConsultor(patch("/api/admin/consultores/9", { jornada: "08:00" }), contexto("9"));
    expect(regra.status).toBe(400);
    expect(await regra.json()).toEqual({ error: "regra qualquer" });

    m.atualizarConsultor.mockRejectedValueOnce(new Error("senha do banco: x"));
    const espiao = vi.spyOn(console, "error").mockImplementation(() => {});
    const interno = await patchConsultor(patch("/api/admin/consultores/9", { jornada: "08:00" }), contexto("9"));
    expect(interno.status).toBe(500);
    expect(JSON.stringify(await interno.json())).not.toContain("senha");
    espiao.mockRestore();
  });
});

describe("GET /api/admin/tarefas", () => {
  it("repassa busca, filtro de ativas e página", async () => {
    m.listarTarefas.mockResolvedValue({ tarefas: [], total: 0, pagina: 2, porPagina: 25 });

    await getTarefas(get("/api/admin/tarefas?busca=migra&ativas=0&pagina=2"));

    expect(m.listarTarefas).toHaveBeenCalledWith({ busca: "migra", somenteAtivas: false, pagina: 2 });
  });

  it("padrões: só ativas, página 1", async () => {
    m.listarTarefas.mockResolvedValue({});

    await getTarefas(get("/api/admin/tarefas"));

    expect(m.listarTarefas).toHaveBeenCalledWith({ busca: "", somenteAtivas: true, pagina: 1 });
  });
});

describe("PATCH /api/admin/tarefas/[codigo]", () => {
  it("normaliza e chama o serviço; limite null limpa o limite", async () => {
    m.atualizarTarefa.mockResolvedValue({ tarefa: { codigo: 1771 }, alterou: false });

    const r = await patchTarefa(patch("/api/admin/tarefas/1771", { permiteExceder: "sim", limiteMensalHoras: null, horasContratadas: "12,5" }), contexto("1771"));

    expect(r.status).toBe(200);
    expect(m.atualizarTarefa).toHaveBeenCalledWith(ATOR, 1771, { permiteExceder: "SIM", limiteMensalHoras: null, horasContratadas: 12.5 });
  });

  it.each([
    ["campo que não pode ser alterado", { STATUS_TAREFA: 4 }],
    ["horas negativas", { horasContratadas: -1 }],
    ["SIM/NAO inválido", { permiteExceder: "talvez" }],
    ["limite decimal", { limiteMensalHoras: 1.5 }],
  ])("recusa com 400: %s", async (_nome, corpo) => {
    expect((await patchTarefa(patch("/api/admin/tarefas/1", corpo), contexto("1"))).status).toBe(400);
    expect(m.atualizarTarefa).not.toHaveBeenCalled();
  });

  it("tarefa inexistente: 404", async () => {
    m.atualizarTarefa.mockResolvedValue(null);

    expect((await patchTarefa(patch("/api/admin/tarefas/5", { permiteExceder: true }), contexto("5"))).status).toBe(404);
  });
});

describe("GET /api/admin/historico", () => {
  it("devolve o histórico do mês com os meses disponíveis", async () => {
    m.lerHistorico.mockResolvedValue({ mes: "2026-10", registros: [], integridade: { ok: true, problemas: [] } });
    m.listarMeses.mockResolvedValue(["2026-10", "2026-09"]);

    const r = await getHistorico(get("/api/admin/historico?mes=2026-10&busca=ana"));

    expect(await r.json()).toMatchObject({ mes: "2026-10", mesesDisponiveis: ["2026-10", "2026-09"] });
    expect(m.lerHistorico).toHaveBeenCalledWith("2026-10", "ana");
  });

  it.each(["2026-13", "2026-1", "abc", "../2026-10", "2026-10'; DROP", "2026-00"])("mês inválido (%s) dá 400 e não lê arquivo", async (mes) => {
    const r = await getHistorico(get(`/api/admin/historico?mes=${encodeURIComponent(mes)}`));

    expect(r.status).toBe(400);
    expect(m.lerHistorico).not.toHaveBeenCalled();
  });

  it("sem mês usa o mês atual", async () => {
    m.lerHistorico.mockResolvedValue({ mes: "x", registros: [], integridade: { ok: true, problemas: [] } });
    m.listarMeses.mockResolvedValue([]);

    await getHistorico(get("/api/admin/historico"));

    expect(m.lerHistorico.mock.calls[0][0]).toMatch(/^\d{4}-\d{2}$/);
  });
});
