import { NextResponse, type NextRequest } from "next/server";
import { respostaErroInterno } from "@/services/erro-interno";
import { exigirAdmin } from "@/services/admin/permissao";
import { lerHistorico, listarMesesDeAuditoria } from "@/services/admin/auditoria";
import { mesDoRegistro } from "@/services/admin/auditoria";

// Histórico de alterações do painel (só administrador): quem alterou o quê, com a
// conferência da corrente de hash do arquivo.
//   GET /api/admin/historico?mes=AAAA-MM&busca=texto   (sem "mes" = mês atual)
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await exigirAdmin(request);
  if (!admin.ok) return admin.resposta;

  const parametros = request.nextUrl.searchParams;
  const mes = parametros.get("mes") ?? mesDoRegistro(new Date());

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) {
    return NextResponse.json({ error: "Mês inválido. Use o formato AAAA-MM." }, { status: 400 });
  }

  try {
    const [historico, meses] = await Promise.all([lerHistorico(mes, (parametros.get("busca") ?? "").slice(0, 60)), listarMesesDeAuditoria()]);

    return NextResponse.json({ ...historico, mesesDisponiveis: meses }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return respostaErroInterno(error, "admin/historico");
  }
}
