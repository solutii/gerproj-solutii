import { describe, expect, it } from "vitest";
import { destinoSeguro } from "./callback-url";

const ORIGEM = "http://solutii.ddns.net:3000";

describe("destinoSeguro", () => {
  it("sem callbackUrl cai em /home", () => {
    expect(destinoSeguro(null, ORIGEM)).toBe("/home");
    expect(destinoSeguro("", ORIGEM)).toBe("/home");
  });

  it("caminho interno é mantido", () => {
    expect(destinoSeguro("/home", ORIGEM)).toBe("/home");
    expect(destinoSeguro("/home?aba=os", ORIGEM)).toBe("/home?aba=os");
  });

  it("URL completa do mesmo site vira só o caminho", () => {
    expect(destinoSeguro("http://solutii.ddns.net:3000/home", ORIGEM)).toBe("/home");
  });

  it("outro domínio é recusado", () => {
    expect(destinoSeguro("https://malicioso.com/home", ORIGEM)).toBe("/home");
    expect(destinoSeguro("//malicioso.com/home", ORIGEM)).toBe("/home");
    expect(destinoSeguro("http://localhost:3000/home", ORIGEM)).toBe("/home");
  });

  it("não volta pra rotas de login/API", () => {
    expect(destinoSeguro("/api/auth/signin", ORIGEM)).toBe("/home");
    expect(destinoSeguro("/login", ORIGEM)).toBe("/home");
  });

  it("valor inválido cai em /home", () => {
    expect(destinoSeguro("http://", ORIGEM)).toBe("/home");
  });
});
