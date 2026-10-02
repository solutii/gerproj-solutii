import { NextResponse, type NextRequest } from "next/server";
import { respostaErroInterno } from "@/services/erro-interno";
import { exigirAdmin } from "@/services/admin/permissao";
import { listarTarefas } from "@/services/admin/tarefas";

// Lista de tarefas para o painel de administração (só administrador), paginada.
//   GET /api/admin/tarefas?busca=texto&ativas=0|1&pagina=1   (ativas=1 por padrão)
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await exigirAdmin(request);
  if (!admin.ok) return admin.resposta;

  const parametros = request.nextUrl.searchParams;

  try {
    const lista = await listarTarefas({
      busca: (parametros.get("busca") ?? "").slice(0, 60),
      somenteAtivas: parametros.get("ativas") !== "0",
      pagina: Number(parametros.get("pagina") ?? 1),
    });

    return NextResponse.json(lista, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return respostaErroInterno(error, "admin/tarefas");
  }
}
