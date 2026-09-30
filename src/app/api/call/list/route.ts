import SuportCallService from '@/services/call/suport-call';
import { NextResponse, type NextRequest } from 'next/server'
import { exigirSessao } from '@/services/permissao'
 
async function handler(request: NextRequest) {
  // O consultor vem da sessão, não da URL/corpo da requisição.
  const sessao = await exigirSessao(request)
  if (!sessao.ok) return sessao.resposta

  const response = await SuportCallService(String(sessao.recurso))

  return NextResponse.json(response)
}

export { handler as GET, handler as POST };