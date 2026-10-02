import { NextResponse, type NextRequest } from "next/server";
import { ErroDeRegra } from "@/services/erro-regra";
import { respostaErroInterno } from "@/services/erro-interno";
import { exigirAdmin, exigirJson } from "@/services/admin/permissao";
import { descartarCacheDoDashboard } from "@/services/admin/dashboard-cache";
import { atualizarTarefa } from "@/services/admin/tarefas";
import { validarAlteracoesTarefa, validarCodigo } from "@/utils/admin-validacao";

// Altera uma tarefa (só administrador). Só estes campos são aceitos:
//   permiteExceder (true/false), limiteMensalHoras (inteiro ou null), horasContratadas (número)
//   PATCH /api/admin/tarefas/1771   { "permiteExceder": true }
export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, contexto: { params: Promise<{ codigo: string }> }) {
  const admin = await exigirAdmin(request);
  if (!admin.ok) return admin.resposta;

  const naoJson = exigirJson(request);
  if (naoJson) return naoJson;

  const codigo = validarCodigo((await contexto.params).codigo, "Tarefa");
  if (!codigo.ok) return NextResponse.json({ error: codigo.erro }, { status: 400 });

  const corpo = await request.json().catch(() => null);
  const alteracoes = validarAlteracoesTarefa(corpo);
  if (!alteracoes.ok) return NextResponse.json({ error: alteracoes.erro }, { status: 400 });

  try {
    // o dashboard guarda os números por 2 minutos: depois de alterar, volta a calcular
    descartarCacheDoDashboard();
    const resultado = await atualizarTarefa(admin.ator, codigo.valor, alteracoes.valor);
    descartarCacheDoDashboard();
    if (!resultado) return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });

    return NextResponse.json({ registro: resultado.tarefa, alterou: resultado.alterou }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    descartarCacheDoDashboard();
    if (error instanceof ErroDeRegra) return NextResponse.json({ error: error.message }, { status: 400 });

    return respostaErroInterno(error, "admin/tarefas/[codigo]");
  }
}
