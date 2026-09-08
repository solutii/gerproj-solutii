import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

// Rotas de API que ficam de fora da checagem de sessão:
// - /api/auth: o próprio login (next-auth) -- precisa ser público.
// - /api/nfce e /api/six: fluxo de nota fiscal eletrônica, fora do escopo
//   desta correção (a pedido do usuário).
const PUBLIC_API_PREFIXES = ["/api/auth", "/api/nfce", "/api/six"];

export default async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    if (PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
        return NextResponse.next();
    }

    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

    if (pathname.startsWith("/api")) {
        if (!token) {
            return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
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

    return NextResponse.next();
}

export const config = {
    matcher: ["/home", "/api/:path*"],
};
