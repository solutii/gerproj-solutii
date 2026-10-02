import { NextResponse, type NextRequest } from "next/server";
import { respostaErroInterno } from "@/services/erro-interno";
import { exigirAdmin } from "@/services/admin/permissao";
import { listarConsultores } from "@/services/admin/consultores";

// Lista de consultores para o painel de administração (só administrador).
//   GET /api/admin/consultores?busca=texto&ativos=0|1   (ativos=1 por padrão)
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await exigirAdmin(request);
  if (!admin.ok) return admin.resposta;

  const parametros = request.nextUrl.searchParams;

  try {
    const consultores = await listarConsultores({
      busca: (parametros.get("busca") ?? "").slice(0, 60),
      somenteAtivos: parametros.get("ativos") !== "0",
    });

    return NextResponse.json(consultores, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return respostaErroInterno(error, "admin/consultores");
  }
}
