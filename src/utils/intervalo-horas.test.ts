import { describe, expect, it } from "vitest";
import {
  duracaoEmMinutos,
  formatarDuracao,
  intervaloInvalido,
  mensagemConfirmacaoApontamento,
} from "./intervalo-horas";

describe("intervaloInvalido", () => {
  it("hora final maior que a inicial é válido", () => {
    expect(intervaloInvalido("10:00", "10:30")).toBe(false);
    expect(intervaloInvalido("09:30", "17:00")).toBe(false);
  });

  it("hora final igual à inicial é inválido", () => {
    expect(intervaloInvalido("10:00", "10:00")).toBe(true);
  });

  it("hora final menor que a inicial é inválido", () => {
    expect(intervaloInvalido("10:30", "10:00")).toBe(true);
  });
});

describe("duracaoEmMinutos / formatarDuracao", () => {
  it("calcula a duração em minutos", () => {
    expect(duracaoEmMinutos("09:00", "17:30")).toBe(510);
    expect(duracaoEmMinutos("10:00", "10:30")).toBe(30);
  });

  it("campo vazio dá 0", () => {
    expect(duracaoEmMinutos("", "10:00")).toBe(0);
  });

  it("formata horas e minutos", () => {
    expect(formatarDuracao(510)).toBe("8hs:30min");
    expect(formatarDuracao(480)).toBe("8hs:00min");
    expect(formatarDuracao(425)).toBe("7hs:05min");
  });
});

describe("mensagemConfirmacaoApontamento", () => {
  const base = "Deseja confirmar o apontamento das horas?";

  it("até 7 horas (inclusive) mantém a mensagem normal", () => {
    expect(mensagemConfirmacaoApontamento(base, "09:00", "16:00")).toBe(base);
    expect(mensagemConfirmacaoApontamento(base, "", "")).toBe(base);
  });

  it("mais de 7 horas avisa a duração antes da pergunta", () => {
    const msg = mensagemConfirmacaoApontamento(base, "09:00", "16:30");
    expect(msg).toContain("7hs:30min");
    expect(msg).toContain("mais de 7 horas");
    expect(msg.endsWith(base)).toBe(true);
  });
});
