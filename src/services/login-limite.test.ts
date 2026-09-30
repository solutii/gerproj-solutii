// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import {
  JANELA_MS,
  MAX_FALHAS_IP,
  MAX_FALHAS_USUARIO,
  ipDaRequisicao,
  limparLoginFalhas,
  minutosDeBloqueio,
  registrarFalhaLogin,
  registrarLoginOk,
} from "./login-limite";

const T0 = 1_000_000_000_000;

beforeEach(() => limparLoginFalhas());

describe("limite de tentativas de login", () => {
  it("poucas falhas não bloqueiam", () => {
    for (let i = 0; i < MAX_FALHAS_USUARIO - 1; i++) registrarFalhaLogin("1.1.1.1", "joao", T0 + i);

    expect(minutosDeBloqueio("1.1.1.1", "joao", T0 + 10)).toBe(0);
  });

  it("5 falhas do mesmo IP + usuário bloqueiam por 15 minutos", () => {
    for (let i = 0; i < MAX_FALHAS_USUARIO; i++) registrarFalhaLogin("1.1.1.1", "joao", T0);

    expect(minutosDeBloqueio("1.1.1.1", "joao", T0 + 1000)).toBe(15);
    expect(minutosDeBloqueio("1.1.1.1", "joao", T0 + 10 * 60 * 1000)).toBe(5);
  });

  it("depois da janela o bloqueio acaba", () => {
    for (let i = 0; i < MAX_FALHAS_USUARIO; i++) registrarFalhaLogin("1.1.1.1", "joao", T0);

    expect(minutosDeBloqueio("1.1.1.1", "joao", T0 + JANELA_MS + 1)).toBe(0);
  });

  it("o usuário é comparado sem diferenciar maiúscula e espaços", () => {
    for (let i = 0; i < MAX_FALHAS_USUARIO; i++) registrarFalhaLogin("1.1.1.1", " Joao ", T0);

    expect(minutosDeBloqueio("1.1.1.1", "JOAO", T0)).toBeGreaterThan(0);
  });

  it("bloquear um usuário não trava o mesmo usuário em outro IP nem outro usuário", () => {
    for (let i = 0; i < MAX_FALHAS_USUARIO; i++) registrarFalhaLogin("1.1.1.1", "joao", T0);

    expect(minutosDeBloqueio("2.2.2.2", "joao", T0)).toBe(0);
    expect(minutosDeBloqueio("1.1.1.1", "maria", T0)).toBe(0);
  });

  it("muitas falhas de um IP com vários usuários bloqueiam o IP", () => {
    for (let i = 0; i < MAX_FALHAS_IP; i++) registrarFalhaLogin("3.3.3.3", `usuario${i}`, T0);

    expect(minutosDeBloqueio("3.3.3.3", "qualquer", T0)).toBeGreaterThan(0);
    expect(minutosDeBloqueio("4.4.4.4", "qualquer", T0)).toBe(0);
  });

  it("login certo zera o contador do IP + usuário", () => {
    for (let i = 0; i < MAX_FALHAS_USUARIO - 1; i++) registrarFalhaLogin("1.1.1.1", "joao", T0);
    registrarLoginOk("1.1.1.1", "joao");
    registrarFalhaLogin("1.1.1.1", "joao", T0 + 1);

    expect(minutosDeBloqueio("1.1.1.1", "joao", T0 + 2)).toBe(0);
  });
});

describe("ipDaRequisicao", () => {
  it("usa o primeiro IP do X-Forwarded-For", () => {
    expect(ipDaRequisicao({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" })).toBe("9.9.9.9");
  });

  it("cai no X-Real-IP e depois em um valor fixo", () => {
    expect(ipDaRequisicao({ "x-real-ip": "8.8.8.8" })).toBe("8.8.8.8");
    expect(ipDaRequisicao({})).toBe("desconhecido");
    expect(ipDaRequisicao(undefined)).toBe("desconhecido");
  });
});
