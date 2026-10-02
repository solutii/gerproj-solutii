import { NextResponse, type NextRequest } from "next/server";
import { respostaErroInterno } from "@/services/erro-interno";
import { exigirAdmin } from "@/services/admin/permissao";
import { buscarConsultor } from "@/services/admin/consultores";
import { montarPainel } from "@/services/painel";
import { validarCodigo } from "@/utils/admin-validacao";
import { mesAtual, mesValido } from "@/utils/painel/periodo";

// O "Meu Painel" de um consultor, visto pelo administrador (só leitura). É o mesmo
// cálculo que o consultor vê, para os números baterem. O consultor vem da URL, mas só
// depois de conferir que o código existe no cadastro; quem chama já é administrador.
//   GET /api/admin/dashboard/consultor/152?mes=AAAA-MM   (sem "mes" = mês atual)
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, contexto: { params: Promise<{ codigo: string }> }) {
  const admin = await exigirAdmin(request);
  if (!admin.ok) return admin.resposta;

  const codigo = validarCodigo((await contexto.params).codigo, "Consultor");
  if (!codigo.ok) return NextResponse.json({ error: codigo.erro }, { status: 400 });

  const corrente = mesAtual();
  const mes = request.nextUrl.searchParams.get("mes") ?? corrente;

  if (!mesValido(mes, corrente)) {
    return NextResponse.json({ error: "Mês inválido. Use o formato AAAA-MM, até o mês atual." }, { status: 400 });
  }

  try {
    const consultor = await buscarConsultor(codigo.valor);
    if (!consultor) return NextResponse.json({ error: "Consultor não encontrado." }, { status: 404 });

    const painel = await montarPainel(codigo.valor, mes);

    return NextResponse.json({ consultor: { codigo: consultor.codigo, nome: consultor.nome }, painel }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return respostaErroInterno(error, "admin/dashboard/consultor");
  }
}
