import OsService from '@/services/os/list';
import { NextResponse, type NextRequest } from 'next/server'
import { exigirSessao } from '@/services/permissao'

async function handlerPost(request: NextRequest) {

  const {
    tarefa,
    data,
  } = await request.json()

  // O consultor vem da sessão, não do corpo da requisição.
  const sessao = await exigirSessao(request)
  if (!sessao.ok) return sessao.resposta

  const response = await OsService.listOsTarefa(tarefa, sessao.recurso as any, data)
  return NextResponse.json(response)
}

export { handlerPost as POST };
