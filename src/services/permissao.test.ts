// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { recursoDaRequisicao, validarPosseChamado, validarPosseCliente } = vi.hoisted(() => ({
  recursoDaRequisicao: vi.fn(),
  validarPosseChamado: vi.fn(),
  validarPosseCliente: vi.fn(),
}));

vi.mock("./os/regras-apontamento", () => ({
  recursoDaRequisicao,
  validarPosseChamado,
  validarPosseCliente,
}));

import { ErroDeRegra } from "./erro-regra";
import {
  codChamadoNumerico,
  exigirChamadoDoConsultor,
  exigirClienteDoConsultor,
  exigirSessao,
  respostaSemPermissao,
} from "./permissao";

const REQ = {} as any;

beforeEach(() => {
  recursoDaRequisicao.mockReset();
  validarPosseChamado.mockReset();
  validarPosseCliente.mockReset();
});

describe("codChamadoNumerico", () => {
  it("aceita só dígitos", () => {
    expect(codChamadoNumerico("15161")).toBe("15161");
    expect(codChamadoNumerico(15161)).toBe("15161");
  });

  it("recusa caminho, vazio e nulo (evita ../ nos anexos)", () => {
    expect(() => codChamadoNumerico("../etc")).toThrow("inválido");
    expect(() => codChamadoNumerico("12/../3")).toThrow("inválido");
    expect(() => codChamadoNumerico("")).toThrow("inválido");
    expect(() => codChamadoNumerico(null)).toThrow("inválido");
    expect(() => codChamadoNumerico("1".repeat(40))).toThrow("inválido");
  });
});

describe("respostaSemPermissao", () => {
  it("erro que não é de regra (banco, bug) não vaza o detalhe", async () => {
    const r = respostaSemPermissao(new Error("connection lost to 10.0.0.5"));
    expect(r.status).toBe(403);
    expect(await r.json()).toEqual({ error: "Acesso negado." });
  });

  it("401 sem sessão e 403 nos demais casos, sempre com { error }", async () => {
    const semSessao = respostaSemPermissao(new ErroDeRegra("Não autenticado"));
    expect(semSessao.status).toBe(401);
    expect(await semSessao.json()).toEqual({ error: "Não autenticado" });

    const negado = respostaSemPermissao(new ErroDeRegra("Este chamado não está atribuído a você."));
    expect(negado.status).toBe(403);
    expect(await negado.json()).toEqual({ error: "Este chamado não está atribuído a você." });
  });
});

describe("exigirSessao", () => {
  it("devolve o consultor da sessão", async () => {
    recursoDaRequisicao.mockResolvedValue(152);

    await expect(exigirSessao(REQ)).resolves.toEqual({ ok: true, recurso: 152 });
  });

  it("sem sessão devolve a resposta 401", async () => {
    recursoDaRequisicao.mockRejectedValue(new ErroDeRegra("Não autenticado"));

    const r = await exigirSessao(REQ);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.resposta.status).toBe(401);
  });
});

describe("exigirChamadoDoConsultor", () => {
  it("passa quando o chamado é do consultor", async () => {
    recursoDaRequisicao.mockResolvedValue(152);
    validarPosseChamado.mockResolvedValue(undefined);

    await expect(exigirChamadoDoConsultor(REQ, "15161")).resolves.toEqual({ ok: true, recurso: 152 });
    expect(validarPosseChamado).toHaveBeenCalledWith(152, "15161");
  });

  it("chamado de outro consultor vira 403", async () => {
    recursoDaRequisicao.mockResolvedValue(152);
    validarPosseChamado.mockRejectedValue(new ErroDeRegra("Este chamado não está atribuído a você."));

    const r = await exigirChamadoDoConsultor(REQ, "15161");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.resposta.status).toBe(403);
  });

  it("código inválido nem chega ao banco", async () => {
    recursoDaRequisicao.mockResolvedValue(152);

    const r = await exigirChamadoDoConsultor(REQ, "../x");
    expect(r.ok).toBe(false);
    expect(validarPosseChamado).not.toHaveBeenCalled();
  });
});

describe("exigirClienteDoConsultor", () => {
  it("passa quando o consultor tem chamado do cliente", async () => {
    recursoDaRequisicao.mockResolvedValue(152);
    validarPosseCliente.mockResolvedValue(undefined);

    await expect(exigirClienteDoConsultor(REQ, 5)).resolves.toEqual({ ok: true, recurso: 152 });
  });

  it("cliente sem chamado do consultor vira 403", async () => {
    recursoDaRequisicao.mockResolvedValue(152);
    validarPosseCliente.mockRejectedValue(new ErroDeRegra("Este cliente não possui chamados atribuídos a você."));

    const r = await exigirClienteDoConsultor(REQ, 5);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.resposta.status).toBe(403);
  });
});
