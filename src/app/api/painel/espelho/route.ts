import { NextResponse, type NextRequest } from "next/server";
import { exigirSessao } from "@/services/permissao";
import { respostaErroInterno } from "@/services/erro-interno";
import { montarEspelho } from "@/services/painel/espelho";
import { mesAtual, mesValido } from "@/utils/painel/periodo";

// Espelho de apontamentos do consultor logado (dados para CSV/impressão) -- só
// leitura; o consultor vem da sessão.
//   GET /api/painel/espelho?mes=AAAA-MM   (sem "mes" = mês atual)
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sessao = await exigirSessao(request);
  if (!sessao.ok) return sessao.resposta;

  const mesCorrente = mesAtual();
  const mes = request.nextUrl.searchParams.get("mes") ?? mesCorrente;

  if (!mesValido(mes, mesCorrente)) {
    return NextResponse.json(
      { error: "Mês inválido. Use o formato AAAA-MM, até o mês atual." },
      { status: 400 },
    );
  }

  try {
    const espelho = await montarEspelho(sessao.recurso, mes);

    return NextResponse.json(espelho, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return respostaErroInterno(error, "painel/espelho");
  }
}
