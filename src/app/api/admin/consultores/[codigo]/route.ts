import { NextResponse, type NextRequest } from "next/server";
import { ErroDeRegra } from "@/services/erro-regra";
import { respostaErroInterno } from "@/services/erro-interno";
import { exigirAdmin, exigirJson } from "@/services/admin/permissao";
import { descartarCacheDoDashboard } from "@/services/admin/dashboard-cache";
import { atualizarConsultor } from "@/services/admin/consultores";
import { validarAlteracoesConsultor, validarCodigo } from "@/utils/admin-validacao";
import { agoraNoFuso } from "@/utils/horario-futuro";

// Altera um consultor (só administrador). Só estes campos são aceitos:
//   permiteApontarNoPassado (true/false), dataLimite ("AAAA-MM-DD"), jornada ("HH:MM")
//   PATCH /api/admin/consultores/152   { "jornada": "08:48" }
export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, contexto: { params: Promise<{ codigo: string }> }) {
  const admin = await exigirAdmin(request);
  if (!admin.ok) return admin.resposta;

  const naoJson = exigirJson(request);
  if (naoJson) return naoJson;

  const codigo = validarCodigo((await contexto.params).codigo, "Consultor");
  if (!codigo.ok) return NextResponse.json({ error: codigo.erro }, { status: 400 });

  const corpo = await request.json().catch(() => null);
  const alteracoes = validarAlteracoesConsultor(corpo, agoraNoFuso().data);
  if (!alteracoes.ok) return NextResponse.json({ error: alteracoes.erro }, { status: 400 });

  try {
    // o dashboard guarda os números por 2 minutos: depois de alterar, volta a calcular
    descartarCacheDoDashboard();
    const resultado = await atualizarConsultor(admin.ator, codigo.valor, alteracoes.valor);
    descartarCacheDoDashboard();
    if (!resultado) return NextResponse.json({ error: "Consultor não encontrado." }, { status: 404 });

    return NextResponse.json({ registro: resultado.consultor, alterou: resultado.alterou }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    descartarCacheDoDashboard();
    if (error instanceof ErroDeRegra) return NextResponse.json({ error: error.message }, { status: 400 });

    return respostaErroInterno(error, "admin/consultores/[codigo]");
  }
}
