// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const { exigirSessao, montarEspelho } = vi.hoisted(() => ({
  exigirSessao: vi.fn(),
  montarEspelho: vi.fn(),
}));

vi.mock("@/services/permissao", () => ({ exigirSessao }));
vi.mock("@/services/painel/espelho", () => ({ montarEspelho }));

import { GET } from "./route";
import { mesAtual } from "@/utils/painel/periodo";

const pedir = (query = "") => GET(new NextRequest(`http://localhost/api/painel/espelho${query}`));

beforeEach(() => {
  exigirSessao.mockReset();
  montarEspelho.mockReset();
  exigirSessao.mockResolvedValue({ ok: true, recurso: 152 });
  montarEspelho.mockResolvedValue({ mes: "2026-09", linhas: [] });
});

describe("GET /api/painel/espelho", () => {
  it("sem sessão devolve 401 e não consulta", async () => {
    exigirSessao.mockResolvedValue({ ok: false, resposta: NextResponse.json({ error: "Não autenticado" }, { status: 401 }) });

    const r = await pedir();

    expect(r.status).toBe(401);
    expect(montarEspelho).not.toHaveBeenCalled();
  });

  it("usa o mês atual quando não há mes, e o consultor da sessão", async () => {
    const r = await pedir();

    expect(r.status).toBe(200);
    expect(montarEspelho).toHaveBeenCalledWith(152, mesAtual());
    expect(r.headers.get("cache-control")).toBe("no-store");
  });

  it("o consultor nunca vem da URL", async () => {
    await pedir("?mes=2026-09&recurso=999");

    expect(montarEspelho).toHaveBeenCalledWith(152, "2026-09");
  });

  it.each(["2026-13", "2099-01", "abc", "2026-09'; DROP TABLE OS;--"])("mes inválido (%s) devolve 400", async (mes) => {
    const r = await pedir(`?mes=${encodeURIComponent(mes)}`);

    expect(r.status).toBe(400);
    expect(montarEspelho).not.toHaveBeenCalled();
  });

  it("erro interno vira 500 genérico, sem vazar detalhe", async () => {
    montarEspelho.mockRejectedValue(new Error("connection lost to 10.0.0.5"));
    const espiao = vi.spyOn(console, "error").mockImplementation(() => {});

    const r = await pedir("?mes=2026-09");

    expect(r.status).toBe(500);
    expect(JSON.stringify(await r.json())).not.toContain("10.0.0.5");
    espiao.mockRestore();
  });
});
