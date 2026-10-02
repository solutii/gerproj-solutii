import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { ErroDeRegra } from "../erro-regra";
import { ipDaRequisicao } from "../login-limite";
import { respostaSemPermissao } from "../permissao";
import { consultarFora } from "../transacao";
import { ehAdministrador } from "@/utils/perfil";
import type { Ator } from "./auditoria";

export type ResultadoAdmin = { ok: true; ator: Ator } | { ok: false; resposta: NextResponse };

// Só administrador. O tipo é conferido NO BANCO a cada chamada (não só no que a
// sessão guardou no login): quem deixa de ser ADM perde o acesso na hora.
// Devolve também quem é (para a auditoria): código, nome, login e IP.
export async function exigirAdmin(req: NextRequest): Promise<ResultadoAdmin> {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    const codUsuario = (token?.email as { COD_USUARIO?: number } | null | undefined)?.COD_USUARIO;

    // Cuidado: o administrador mestre tem COD_USUARIO = 0, que é "falso" em JavaScript.
    // Por isso a checagem é por ausência (undefined/null), nunca por !codUsuario.
    if (codUsuario === undefined || codUsuario === null) throw new ErroDeRegra("Não autenticado");

    const [usuario] = await consultarFora(
      `SELECT COD_USUARIO, ID_USUARIO, TIPO_USUARIO,
              CAST(NOME_USUARIO AS VARCHAR(100) CHARACTER SET WIN1252) AS NOME_USUARIO
         FROM USUARIO WHERE COD_USUARIO = ?`,
      [codUsuario],
    );

    if (!usuario || !ehAdministrador(usuario.TIPO_USUARIO)) {
      throw new ErroDeRegra("Acesso restrito aos administradores.");
    }

    return {
      ok: true,
      ator: {
        codUsuario: Number(usuario.COD_USUARIO),
        nome: String(usuario.NOME_USUARIO ?? "").trim(),
        login: String(usuario.ID_USUARIO ?? "").trim(),
        ip: ipDaRequisicao(Object.fromEntries(req.headers)),
      },
    };
  } catch (erro) {
    return { ok: false, resposta: respostaSemPermissao(erro) };
  }
}

// PATCH/POST do painel só aceitam JSON (um formulário de outro site não consegue
// enviar Content-Type: application/json sem passar por CORS).
export function exigirJson(req: NextRequest): NextResponse | null {
  const tipo = req.headers.get("content-type") ?? "";

  return tipo.toLowerCase().includes("application/json")
    ? null
    : NextResponse.json({ error: "Envie o corpo como application/json." }, { status: 415 });
}
