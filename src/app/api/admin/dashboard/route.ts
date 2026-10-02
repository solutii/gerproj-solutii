import { NextResponse, type NextRequest } from "next/server";
import { respostaErroInterno } from "@/services/erro-interno";
import { exigirAdmin } from "@/services/admin/permissao";
import { dashboardComCache } from "@/services/admin/dashboard-cache";
import { mesAtual, mesValido } from "@/utils/painel/periodo";

// Dashboard do administrador (só administrador, só leitura): horas, chamados, tarefas
// e qualidade dos apontamentos de TODOS os consultores.
//   GET /api/admin/dashboard?mes=AAAA-MM            (sem "mes" = mês atual)
//   GET /api/admin/dashboard?mes=AAAA-MM&atualizar=1  (ignora o cache de 2 minutos)
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await exigirAdmin(request);
  if (!admin.ok) return admin.resposta;

  const corrente = mesAtual();
  const parametros = request.nextUrl.searchParams;
  const mes = parametros.get("mes") ?? corrente;

  if (!mesValido(mes, corrente)) {
    return NextResponse.json({ error: "Mês inválido. Use o formato AAAA-MM, até o mês atual." }, { status: 400 });
  }

  try {
    const dashboard = await dashboardComCache(mes, { atualizar: parametros.get("atualizar") === "1" });

    return NextResponse.json(dashboard, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return respostaErroInterno(error, "admin/dashboard");
  }
}
