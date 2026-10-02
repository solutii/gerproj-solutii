import { describe, expect, it } from "vitest";
import { decidirAcesso, destinoAposLogin, ehAdministrador } from "./perfil";

const ORIGEM = "http://solutii.ddns.net:3000";

describe("ehAdministrador", () => {
  it("reconhece ADM com espaços e minúsculas do CHAR(3) do banco; nada além", () => {
    expect(ehAdministrador("ADM")).toBe(true);
    expect(ehAdministrador("ADM ")).toBe(true);
    expect(ehAdministrador("adm")).toBe(true);
    expect(ehAdministrador("USU")).toBe(false);
    expect(ehAdministrador("")).toBe(false);
    expect(ehAdministrador(null)).toBe(false);
    expect(ehAdministrador(undefined)).toBe(false);
    expect(ehAdministrador("ADMIN")).toBe(false);
  });
});

describe("destinoAposLogin", () => {
  it("administrador sempre vai para o painel, mesmo que o callbackUrl peça outra página", () => {
    expect(destinoAposLogin("ADM", "/home", ORIGEM)).toBe("/admin");
    expect(destinoAposLogin("ADM", "http://solutii.ddns.net:3000/home", ORIGEM)).toBe("/admin");
  });

  it("consultor segue o destino seguro de sempre (/home por padrão; endereço de fora é descartado)", () => {
    expect(destinoAposLogin("USU", "/home", ORIGEM)).toBe("/home");
    expect(destinoAposLogin("USU", "https://malicioso.com/x", ORIGEM)).toBe("/home");
  });

  it("sessão sem tipo (login antigo) é tratada como consultor", () => {
    expect(destinoAposLogin(undefined, "/home", ORIGEM)).toBe("/home");
  });
});

describe("decidirAcesso: páginas", () => {
  it("administrador: /home volta para /admin; /admin e subpáginas seguem", () => {
    expect(decidirAcesso("ADM", "/home")).toEqual({ acao: "redirecionar", destino: "/admin" });
    expect(decidirAcesso("ADM", "/admin")).toEqual({ acao: "seguir" });
    expect(decidirAcesso("ADM", "/admin/qualquer")).toEqual({ acao: "seguir" });
  });

  it("consultor: /admin e subpáginas voltam para /home; /home segue", () => {
    expect(decidirAcesso("USU", "/admin")).toEqual({ acao: "redirecionar", destino: "/home" });
    expect(decidirAcesso("USU", "/admin/x")).toEqual({ acao: "redirecionar", destino: "/home" });
    expect(decidirAcesso("USU", "/home")).toEqual({ acao: "seguir" });
  });

  it("caminho parecido não engana (/administracao não é /admin)", () => {
    expect(decidirAcesso("USU", "/administracao")).toEqual({ acao: "seguir" });
    expect(decidirAcesso("ADM", "/homepage")).toEqual({ acao: "seguir" });
  });
});

describe("decidirAcesso: APIs", () => {
  it("administrador só usa /api/auth e /api/admin; as do consultor dão 403", () => {
    expect(decidirAcesso("ADM", "/api/auth/session")).toEqual({ acao: "seguir" });
    expect(decidirAcesso("ADM", "/api/admin/consultores")).toEqual({ acao: "seguir" });
    expect(decidirAcesso("ADM", "/api/admin")).toEqual({ acao: "seguir" });

    for (const rota of ["/api/os/apoint", "/api/os/list", "/api/call/list", "/api/call/standby", "/api/painel", "/api/painel/pendentes", "/api/area", "/api/os/delete"]) {
      expect(decidirAcesso("ADM", rota)).toMatchObject({ acao: "negar" });
    }
  });

  it("rota parecida com a livre não escapa (/api/administrador, /api/authx)", () => {
    expect(decidirAcesso("ADM", "/api/administrador")).toMatchObject({ acao: "negar" });
    expect(decidirAcesso("ADM", "/api/authx")).toMatchObject({ acao: "negar" });
  });

  it("consultor: /api/admin dá 403; as demais seguem como antes", () => {
    expect(decidirAcesso("USU", "/api/admin/consultores")).toMatchObject({ acao: "negar", mensagem: "Acesso restrito aos administradores." });
    expect(decidirAcesso("USU", "/api/admin")).toMatchObject({ acao: "negar" });
    expect(decidirAcesso("USU", "/api/os/apoint")).toEqual({ acao: "seguir" });
  });

  it("sessão sem tipo se comporta como consultor", () => {
    expect(decidirAcesso(undefined, "/api/admin/tarefas")).toMatchObject({ acao: "negar" });
    expect(decidirAcesso(undefined, "/admin")).toEqual({ acao: "redirecionar", destino: "/home" });
  });
});
