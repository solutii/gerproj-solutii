import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { decidirAcesso } from "@/utils/perfil";

// Rotas de API que ficam de fora da checagem de sessão:
// - /api/auth: o próprio login (next-auth) -- precisa ser público.
// - /api/nfce e /api/six: fluxo de nota fiscal eletrônica, fora do escopo
//   desta correção (a pedido do usuário).
// - /api/apibradesco: mesmo padrão do /api/six -- verificação por CNPJ
//   consumida externamente (sem sessão de usuário logado).
const PUBLIC_API_PREFIXES = ["/api/auth", "/api/nfce", "/api/six", "/api/apibradesco"];

export default async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    if (PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
        return NextResponse.next();
    }

    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

    // Tipo do usuário guardado na sessão no login (ADM ou USU). Sessão antiga, sem
    // tipo, vale como consultor.
    const tipo = (token?.email as { TIPO_USUARIO?: string } | null | undefined)?.TIPO_USUARIO;

    if (pathname.startsWith("/api")) {
        if (!token) {
            return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
        }

        // Administrador só usa as rotas do painel; consultor não usa as do painel.
        // (As rotas /api/admin conferem o tipo de novo no banco a cada chamada.)
        const decisao = decidirAcesso(tipo, pathname);
        if (decisao.acao === "negar") {
            return NextResponse.json({ error: decisao.mensagem }, { status: 403 });
        }

        return NextResponse.next();
    }

    // /home (e demais páginas protegidas) -- mesmo comportamento de antes
    // (next-auth/middleware): sem sessão, redireciona pro login.
    if (!token) {
        const signInUrl = new URL("/api/auth/signin", req.url);
        signInUrl.searchParams.set("callbackUrl", req.url);
        return NextResponse.redirect(signInUrl);
    }

    // Páginas: administrador em /home vai para /admin; consultor em /admin vai para /home.
    const decisao = decidirAcesso(tipo, pathname);
    if (decisao.acao === "redirecionar") {
        return NextResponse.redirect(new URL(decisao.destino, req.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/home", "/admin", "/admin/:path*", "/api/:path*"],
};
