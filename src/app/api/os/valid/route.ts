import ValidLimitDate from '@/services/os/valid';
import { NextResponse, type NextRequest } from 'next/server'
import { exigirSessao } from '@/services/permissao'

async function handler(request: NextRequest) {

  // O consultor vem da sessão, não do corpo da requisição.
  const sessao = await exigirSessao(request)
  if (!sessao.ok) return sessao.resposta

  const response = await ValidLimitDate(sessao.recurso as any)

  return NextResponse.json(response)
}

export { handler as POST };
