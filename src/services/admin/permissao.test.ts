// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { getToken, consultarFora } = vi.hoisted(() => ({ getToken: vi.fn(), consultarFora: vi.fn() }));

vi.mock("next-auth/jwt", () => ({ getToken }));
vi.mock("../transacao", () => ({ consultarFora }));

import { exigirAdmin, exigirJson } from "./permissao";

const pedido = (cabecalhos: Record<string, string> = {}) => new NextRequest("http://localhost/api/admin/consultores", { headers: cabecalhos });

beforeEach(() => {
  getToken.mockReset();
  consultarFora.mockReset();
});

describe("exigirAdmin", () => {
  it("sem sessão: 401 e nem consulta o banco", async () => {
    getToken.mockResolvedValue(null);

    const r = await exigirAdmin(pedido());

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.resposta.status).toBe(401);
    expect(consultarFora).not.toHaveBeenCalled();
  });

  it("sessão de consultor (USU): 403 com a mensagem de acesso restrito", async () => {
    getToken.mockResolvedValue({ email: { COD_USUARIO: 20, TIPO_USUARIO: "USU" } });
    consultarFora.mockResolvedValue([{ COD_USUARIO: 20, ID_USUARIO: "FULANO", TIPO_USUARIO: "USU", NOME_USUARIO: "FULANO" }]);

    const r = await exigirAdmin(pedido());

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.resposta.status).toBe(403);
      expect(await r.resposta.json()).toEqual({ error: "Acesso restrito aos administradores." });
    }
  });

  it("o tipo é conferido NO BANCO: sessão diz ADM mas o banco diz USU => 403 (rebaixado perde acesso na hora)", async () => {
    getToken.mockResolvedValue({ email: { COD_USUARIO: 7, TIPO_USUARIO: "ADM" } });
    consultarFora.mockResolvedValue([{ COD_USUARIO: 7, ID_USUARIO: "ADM1", TIPO_USUARIO: "USU", NOME_USUARIO: "ADMIN" }]);

    const r = await exigirAdmin(pedido());

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.resposta.status).toBe(403);
  });

  it("e o contrário: sessão antiga/forjada dizendo USU, mas o banco ADM => passa (vale o banco)", async () => {
    getToken.mockResolvedValue({ email: { COD_USUARIO: 7 } });
    consultarFora.mockResolvedValue([{ COD_USUARIO: 7, ID_USUARIO: "ADM1", TIPO_USUARIO: "ADM", NOME_USUARIO: "ADMIN" }]);

    expect((await exigirAdmin(pedido())).ok).toBe(true);
  });

  it("usuário que não existe mais no banco: 403", async () => {
    getToken.mockResolvedValue({ email: { COD_USUARIO: 99 } });
    consultarFora.mockResolvedValue([]);

    const r = await exigirAdmin(pedido());

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.resposta.status).toBe(403);
  });

  it("administrador: devolve quem é (código, nome, login) e o IP, para a auditoria", async () => {
    getToken.mockResolvedValue({ email: { COD_USUARIO: 7 } });
    consultarFora.mockResolvedValue([{ COD_USUARIO: 7, ID_USUARIO: "ADM1 ", TIPO_USUARIO: "ADM", NOME_USUARIO: "  ADMINISTRADOR  " }]);

    const r = await exigirAdmin(pedido({ "x-forwarded-for": "10.1.2.3, 10.9.9.9" }));

    expect(r).toEqual({ ok: true, ator: { codUsuario: 7, nome: "ADMINISTRADOR", login: "ADM1", ip: "10.1.2.3" } });
    // a consulta usa o código da SESSÃO como parâmetro (nunca texto livre)
    expect(consultarFora.mock.calls[0][1]).toEqual([7]);
  });

  it("o administrador mestre tem COD_USUARIO = 0 (falso em JavaScript) e MESMO ASSIM é reconhecido", async () => {
    getToken.mockResolvedValue({ email: { COD_USUARIO: 0 } });
    consultarFora.mockResolvedValue([{ COD_USUARIO: 0, ID_USUARIO: "MESTRE", TIPO_USUARIO: "ADM", NOME_USUARIO: "MESTRE" }]);

    const r = await exigirAdmin(pedido());

    expect(r).toMatchObject({ ok: true, ator: { codUsuario: 0, login: "MESTRE" } });
    expect(consultarFora.mock.calls[0][1]).toEqual([0]);
  });

  it("sessão sem COD_USUARIO (ou com ele nulo): 401, sem consultar o banco", async () => {
    for (const email of [{}, { COD_USUARIO: null }, null]) {
      getToken.mockResolvedValue({ email });

      const r = await exigirAdmin(pedido());

      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.resposta.status).toBe(401);
    }
    expect(consultarFora).not.toHaveBeenCalled();
  });

  it("falha do banco não vira acesso liberado", async () => {
    getToken.mockResolvedValue({ email: { COD_USUARIO: 7 } });
    consultarFora.mockRejectedValue(new Error("banco fora"));
    const espiao = vi.spyOn(console, "error").mockImplementation(() => {});

    const r = await exigirAdmin(pedido());

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.resposta.status).toBe(403);
    espiao.mockRestore();
  });
});

describe("exigirJson", () => {
  it("aceita application/json (com charset) e recusa o resto com 415", () => {
    const req = (tipo?: string) => new NextRequest("http://localhost/x", { method: "PATCH", headers: tipo ? { "content-type": tipo } : {} });

    expect(exigirJson(req("application/json"))).toBeNull();
    expect(exigirJson(req("application/json; charset=utf-8"))).toBeNull();
    expect(exigirJson(req("text/plain"))?.status).toBe(415);
    expect(exigirJson(req("application/x-www-form-urlencoded"))?.status).toBe(415);
    expect(exigirJson(req())?.status).toBe(415);
  });
});
