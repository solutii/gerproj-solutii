import { NextResponse, type NextRequest } from "next/server";
import { exigirSessao } from "@/services/permissao";
import { respostaErroInterno } from "@/services/erro-interno";
import { montarDiasPendentes } from "@/services/painel/pendentes";

// Dias úteis recentes sem apontamento do consultor logado (aviso da Home) --
// só leitura; o consultor vem da sessão.
//   GET /api/painel/pendentes
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sessao = await exigirSessao(request);
  if (!sessao.ok) return sessao.resposta;

  try {
    const pendentes = await montarDiasPendentes(sessao.recurso);

    return NextResponse.json(pendentes, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return respostaErroInterno(error, "painel/pendentes");
  }
}
