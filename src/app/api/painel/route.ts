import { NextResponse, type NextRequest } from "next/server";
import { exigirSessao } from "@/services/permissao";
import { respostaErroInterno } from "@/services/erro-interno";
import { montarPainel } from "@/services/painel";
import { mesAtual, mesValido } from "@/utils/painel/periodo";

// Dados do "Meu Painel" do consultor logado -- só leitura. O consultor vem da
// sessão (nunca da URL): cada um vê somente o próprio trabalho.
//   GET /api/painel?mes=AAAA-MM   (sem "mes" = mês atual)
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
    const painel = await montarPainel(sessao.recurso, mes);

    return NextResponse.json(painel, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return respostaErroInterno(error, "painel");
  }
}
