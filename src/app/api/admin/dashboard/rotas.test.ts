// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const m = vi.hoisted(() => ({
  exigirAdmin: vi.fn(),
  buscarConsultor: vi.fn(),
  atualizarConsultor: vi.fn(),
  atualizarTarefa: vi.fn(),
  montarPainel: vi.fn(),
  dashboard: vi.fn(),
  descartarCache: vi.fn(),
}));

vi.mock("@/services/admin/permissao", async (original) => ({
  ...(await original<typeof import("@/services/admin/permissao")>()),
  exigirAdmin: m.exigirAdmin,
}));
vi.mock("@/services/admin/consultores", () => ({ buscarConsultor: m.buscarConsultor, atualizarConsultor: m.atualizarConsultor }));
vi.mock("@/services/admin/tarefas", () => ({ atualizarTarefa: m.atualizarTarefa }));
vi.mock("@/services/admin/dashboard-cache", () => ({ dashboardComCache: m.dashboard, descartarCacheDoDashboard: m.descartarCache }));
vi.mock("@/services/painel", () => ({ montarPainel: m.montarPainel }));

import { GET as getDashboard } from "./route";
import { GET as getPainelDoConsultor } from "./consultor/[codigo]/route";
import { PATCH as patchConsultor } from "../consultores/[codigo]/route";
import { PATCH as patchTarefa } from "../tarefas/[codigo]/route";
import { mesAtual } from "@/utils/painel/periodo";

const ATOR = { codUsuario: 7, nome: "ADMIN", login: "ADM1", ip: "10.0.0.1" };

const get = (caminho: string) => new NextRequest(`http://localhost${caminho}`);
const patch = (caminho: string, corpo: unknown) =>
  new NextRequest(`http://localhost${caminho}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) });
const contexto = (codigo: string) => ({ params: Promise.resolve({ codigo }) });
const negado = (status: number, error: string) => ({ ok: false, resposta: NextResponse.json({ error }, { status }) });

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.exigirAdmin.mockResolvedValue({ ok: true, ator: ATOR });
});

describe("as rotas do dashboard recusam quem não é administrador (e não chegam ao banco)", () => {
  const todas: [string, () => Promise<Response>][] = [
    ["GET dashboard", () => getDashboard(get("/api/admin/dashboard"))],
    ["GET painel do consultor", () => getPainelDoConsultor(get("/api/admin/dashboard/consultor/1"), contexto("1"))],
  ];

  it.each(todas)("%s: consultor comum recebe 403", async (_nome, chamar) => {
    m.exigirAdmin.mockResolvedValue(negado(403, "Acesso restrito aos administradores."));

    const r = await chamar();

    expect(r.status).toBe(403);
    expect(await r.json()).toEqual({ error: "Acesso restrito aos administradores." });
    for (const f of [m.dashboard, m.buscarConsultor, m.montarPainel]) expect(f).not.toHaveBeenCalled();
  });

  it.each(todas)("%s: sem sessão recebe 401", async (_nome, chamar) => {
    m.exigirAdmin.mockResolvedValue(negado(401, "Não autenticado"));

    expect((await chamar()).status).toBe(401);
    expect(m.dashboard).not.toHaveBeenCalled();
  });
});

describe("GET /api/admin/dashboard", () => {
  it("sem mês usa o mês atual, devolve o dashboard e não deixa o navegador guardar", async () => {
    m.dashboard.mockResolvedValue({ mes: mesAtual(), visao: {} });

    const r = await getDashboard(get("/api/admin/dashboard"));

    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ mes: mesAtual() });
    expect(m.dashboard).toHaveBeenCalledWith(mesAtual(), { atualizar: false });
    expect(r.headers.get("cache-control")).toBe("no-store");
  });

  it("repassa o mês e só ignora o cache com atualizar=1", async () => {
    m.dashboard.mockResolvedValue({});

    await getDashboard(get("/api/admin/dashboard?mes=2026-09&atualizar=1"));
    await getDashboard(get("/api/admin/dashboard?mes=2026-08&atualizar=true"));

    expect(m.dashboard).toHaveBeenNthCalledWith(1, "2026-09", { atualizar: true });
    expect(m.dashboard).toHaveBeenNthCalledWith(2, "2026-08", { atualizar: false });
  });

  it.each(["2026-13", "2026-1", "abc", "../2026-10", "2026-10'; DROP", "1999-12", "2999-01"])("mês inválido ou futuro (%s): 400 e não consulta o banco", async (mes) => {
    const r = await getDashboard(get(`/api/admin/dashboard?mes=${encodeURIComponent(mes)}`));

    expect(r.status).toBe(400);
    expect(m.dashboard).not.toHaveBeenCalled();
  });

  it("erro interno: 500 genérico, sem vazar detalhe", async () => {
    m.dashboard.mockRejectedValue(new Error("connection lost to 10.0.0.5"));
    const espiao = vi.spyOn(console, "error").mockImplementation(() => {});

    const r = await getDashboard(get("/api/admin/dashboard"));

    expect(r.status).toBe(500);
    expect(JSON.stringify(await r.json())).not.toContain("10.0.0.5");
    espiao.mockRestore();
  });
});

describe("GET /api/admin/dashboard/consultor/[codigo]", () => {
  it("devolve o Meu Painel do consultor pedido (o mesmo cálculo do consultor)", async () => {
    m.buscarConsultor.mockResolvedValue({ codigo: 152, nome: "ANA SOUZA", jornada: "08:00" });
    m.montarPainel.mockResolvedValue({ mes: "2026-09", resumo: {} });

    const r = await getPainelDoConsultor(get("/api/admin/dashboard/consultor/152?mes=2026-09"), contexto("152"));

    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ consultor: { codigo: 152, nome: "ANA SOUZA" }, painel: { mes: "2026-09", resumo: {} } });
    expect(m.montarPainel).toHaveBeenCalledWith(152, "2026-09");
    expect(r.headers.get("cache-control")).toBe("no-store");
  });

  it("sem mês usa o mês atual", async () => {
    m.buscarConsultor.mockResolvedValue({ codigo: 1, nome: "X" });
    m.montarPainel.mockResolvedValue({});

    await getPainelDoConsultor(get("/api/admin/dashboard/consultor/1"), contexto("1"));

    expect(m.montarPainel).toHaveBeenCalledWith(1, mesAtual());
  });

  it.each(["abc", "1; DROP TABLE RECURSO", "-1", "1.5", "9999999999"])("código inválido (%s): 400 e nada é consultado", async (codigo) => {
    const r = await getPainelDoConsultor(get("/api/admin/dashboard/consultor/x"), contexto(codigo));

    expect(r.status).toBe(400);
    expect(m.buscarConsultor).not.toHaveBeenCalled();
    expect(m.montarPainel).not.toHaveBeenCalled();
  });

  it("mês inválido: 400 e nada é consultado", async () => {
    const r = await getPainelDoConsultor(get("/api/admin/dashboard/consultor/1?mes=2999-01"), contexto("1"));

    expect(r.status).toBe(400);
    expect(m.montarPainel).not.toHaveBeenCalled();
  });

  it("consultor que não existe: 404, sem montar o painel", async () => {
    m.buscarConsultor.mockResolvedValue(null);

    const r = await getPainelDoConsultor(get("/api/admin/dashboard/consultor/999"), contexto("999"));

    expect(r.status).toBe(404);
    expect(m.montarPainel).not.toHaveBeenCalled();
  });

  it("erro interno: 500 genérico", async () => {
    m.buscarConsultor.mockRejectedValue(new Error("senha do banco: x"));
    const espiao = vi.spyOn(console, "error").mockImplementation(() => {});

    const r = await getPainelDoConsultor(get("/api/admin/dashboard/consultor/1"), contexto("1"));

    expect(r.status).toBe(500);
    expect(JSON.stringify(await r.json())).not.toContain("senha");
    espiao.mockRestore();
  });
});

describe("alterações do painel descartam o cache do dashboard (o administrador vê o efeito na hora)", () => {
  it("PATCH consultor: descarta ao alterar e também quando falha", async () => {
    m.atualizarConsultor.mockResolvedValueOnce({ consultor: { codigo: 1 }, alterou: true });
    await patchConsultor(patch("/api/admin/consultores/1", { jornada: "08:00" }), contexto("1"));
    expect(m.descartarCache).toHaveBeenCalled();

    m.descartarCache.mockClear();
    m.atualizarConsultor.mockRejectedValueOnce(new Error("falhou"));
    const espiao = vi.spyOn(console, "error").mockImplementation(() => {});
    await patchConsultor(patch("/api/admin/consultores/1", { jornada: "08:00" }), contexto("1"));
    espiao.mockRestore();
    expect(m.descartarCache).toHaveBeenCalled();
  });

  it("PATCH tarefa: descarta ao alterar", async () => {
    m.atualizarTarefa.mockResolvedValue({ tarefa: { codigo: 1 }, alterou: true });

    await patchTarefa(patch("/api/admin/tarefas/1", { permiteExceder: true }), contexto("1"));

    expect(m.descartarCache).toHaveBeenCalled();
  });

  it("pedido recusado antes de gravar (400) não mexe no cache", async () => {
    await patchTarefa(patch("/api/admin/tarefas/1", { STATUS_TAREFA: 4 }), contexto("1"));

    expect(m.descartarCache).not.toHaveBeenCalled();
  });
});
