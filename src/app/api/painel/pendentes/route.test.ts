// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const { exigirSessao, montarDiasPendentes } = vi.hoisted(() => ({
  exigirSessao: vi.fn(),
  montarDiasPendentes: vi.fn(),
}));

vi.mock("@/services/permissao", () => ({ exigirSessao }));
vi.mock("@/services/painel/pendentes", () => ({ montarDiasPendentes }));

import { GET } from "./route";

const pedir = (query = "") => GET(new NextRequest(`http://localhost/api/painel/pendentes${query}`));

beforeEach(() => {
  exigirSessao.mockReset();
  montarDiasPendentes.mockReset();
  exigirSessao.mockResolvedValue({ ok: true, recurso: 152 });
  montarDiasPendentes.mockResolvedValue({ hoje: "2026-10-02", dias: ["2026-10-01"] });
});

describe("GET /api/painel/pendentes", () => {
  it("sem sessão devolve 401 e não consulta", async () => {
    exigirSessao.mockResolvedValue({ ok: false, resposta: NextResponse.json({ error: "Não autenticado" }, { status: 401 }) });

    const r = await pedir();

    expect(r.status).toBe(401);
    expect(montarDiasPendentes).not.toHaveBeenCalled();
  });

  it("devolve os dias do consultor da sessão, sem cache", async () => {
    const r = await pedir();

    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ hoje: "2026-10-02", dias: ["2026-10-01"] });
    expect(montarDiasPendentes).toHaveBeenCalledWith(152);
    expect(r.headers.get("cache-control")).toBe("no-store");
  });

  it("o consultor nunca vem da URL", async () => {
    await pedir("?recurso=999");

    expect(montarDiasPendentes).toHaveBeenCalledWith(152);
  });

  it("erro interno vira 500 genérico, sem vazar detalhe", async () => {
    montarDiasPendentes.mockRejectedValue(new Error("connection lost to 10.0.0.5"));
    const espiao = vi.spyOn(console, "error").mockImplementation(() => {});

    const r = await pedir();

    expect(r.status).toBe(500);
    expect(JSON.stringify(await r.json())).not.toContain("10.0.0.5");
    espiao.mockRestore();
  });
});
