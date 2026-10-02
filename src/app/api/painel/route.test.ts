// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const { exigirSessao, montarPainel } = vi.hoisted(() => ({
  exigirSessao: vi.fn(),
  montarPainel: vi.fn(),
}));

vi.mock("@/services/permissao", () => ({ exigirSessao }));
vi.mock("@/services/painel", () => ({ montarPainel }));

import { GET } from "./route";
import { mesAtual } from "@/utils/painel/periodo";

const pedir = (query = "") => GET(new NextRequest(`http://localhost/api/painel${query}`));

beforeEach(() => {
  exigirSessao.mockReset();
  montarPainel.mockReset();
  exigirSessao.mockResolvedValue({ ok: true, recurso: 152 });
  montarPainel.mockResolvedValue({ mes: "2026-09" });
});

describe("GET /api/painel", () => {
  it("sem sessão devolve a resposta de permissão (401) e não consulta nada", async () => {
    exigirSessao.mockResolvedValue({ ok: false, resposta: NextResponse.json({ error: "Não autenticado" }, { status: 401 }) });

    const r = await pedir();

    expect(r.status).toBe(401);
    expect(montarPainel).not.toHaveBeenCalled();
  });

  it("sem mes usa o mês atual e o consultor da sessão", async () => {
    const r = await pedir();

    expect(r.status).toBe(200);
    expect(montarPainel).toHaveBeenCalledWith(152, mesAtual());
    expect(r.headers.get("cache-control")).toBe("no-store");
  });

  it("mes válido é repassado", async () => {
    await pedir("?mes=2026-09");

    expect(montarPainel).toHaveBeenCalledWith(152, "2026-09");
  });

  it("o consultor vem da sessão, nunca da URL", async () => {
    await pedir("?mes=2026-09&recurso=999&COD_RECURSO=999");

    expect(montarPainel).toHaveBeenCalledWith(152, "2026-09");
  });

  it.each(["2026-13", "2099-01", "abc", "2026-1", "1999-12", "2026-09'; DROP TABLE OS;--"])(
    "mes inválido (%s) devolve 400 sem consultar",
    async (mes) => {
      const r = await pedir(`?mes=${encodeURIComponent(mes)}`);

      expect(r.status).toBe(400);
      expect((await r.json()).error).toContain("Mês inválido");
      expect(montarPainel).not.toHaveBeenCalled();
    },
  );

  it("erro interno vira 500 genérico, sem vazar detalhe", async () => {
    montarPainel.mockRejectedValue(new Error("connection lost to 10.0.0.5 SYSDBA"));
    const espiao = vi.spyOn(console, "error").mockImplementation(() => {});

    const r = await pedir("?mes=2026-09");
    const corpo = await r.json();

    expect(r.status).toBe(500);
    expect(JSON.stringify(corpo)).not.toContain("10.0.0.5");
    expect(JSON.stringify(corpo)).not.toContain("SYSDBA");
    espiao.mockRestore();
  });
});
