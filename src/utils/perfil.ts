import { destinoSeguro } from "./callback-url";

// Perfis do sistema: USUARIO.TIPO_USUARIO no banco ("ADM" ou "USU").
// O administrador só enxerga o painel de controle (/admin); o consultor
// (qualquer outro tipo) só o sistema de apontamentos (/home).

export const PERFIL_ADMIN = "ADM";
export const PAGINA_ADMIN = "/admin";
export const PAGINA_CONSULTOR = "/home";

// Aceita o valor cru do banco (CHAR(3) com espaços, minúsculo...).
export function ehAdministrador(tipo: unknown): boolean {
  return String(tipo ?? "").trim().toUpperCase() === PERFIL_ADMIN;
}

// Para onde ir logo depois do login.
export function destinoAposLogin(tipo: unknown, callbackUrl: string, origem: string): string {
  if (ehAdministrador(tipo)) return PAGINA_ADMIN;

  return destinoSeguro(callbackUrl, origem);
}

export type DecisaoDeAcesso =
  | { acao: "seguir" }
  | { acao: "redirecionar"; destino: string }
  | { acao: "negar"; mensagem: string };

// APIs que continuam abertas ao administrador: o login (next-auth) e as
// rotas do próprio painel. Todas as demais (apontamentos, chamados, painel do
// consultor...) são só do consultor.
const API_LIVRE_PARA_ADMIN = ["/api/auth", "/api/admin"];

// Regra única de "quem pode abrir o quê", usada pelo middleware. Aqui só há o
// que a sessão (JWT) permite saber; as rotas /api/admin conferem de novo o tipo
// NO BANCO a cada chamada (ver services/admin/permissao.ts).
//   - administrador: só /admin e /api/admin; /home volta para /admin e as APIs
//     do consultor respondem 403;
//   - consultor: /admin volta para /home e /api/admin responde 403.
export function decidirAcesso(tipo: unknown, pathname: string): DecisaoDeAcesso {
  const admin = ehAdministrador(tipo);
  const naAreaAdmin = pathname === PAGINA_ADMIN || pathname.startsWith(PAGINA_ADMIN + "/");
  const naApiAdmin = pathname === "/api/admin" || pathname.startsWith("/api/admin/");

  if (pathname.startsWith("/api")) {
    if (naApiAdmin && !admin) return { acao: "negar", mensagem: "Acesso restrito aos administradores." };
    if (admin && !API_LIVRE_PARA_ADMIN.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
      return { acao: "negar", mensagem: "O administrador só acessa o painel de controle." };
    }

    return { acao: "seguir" };
  }

  if (admin && pathname === PAGINA_CONSULTOR) return { acao: "redirecionar", destino: PAGINA_ADMIN };
  if (!admin && naAreaAdmin) return { acao: "redirecionar", destino: PAGINA_CONSULTOR };

  return { acao: "seguir" };
}
