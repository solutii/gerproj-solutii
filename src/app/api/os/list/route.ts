import OsService from '@/services/os/list';
import ListTaskService from '@/services/tarefa/list';
import { NextResponse, type NextRequest } from 'next/server'
import { exigirSessao } from '@/services/permissao'

async function handlerPost(request: NextRequest) {

  const {
    chamado,
    data,
  } = await request.json()

  // O consultor vem da sessão, não do corpo da requisição.
  const sessao = await exigirSessao(request)
  if (!sessao.ok) return sessao.resposta

  const response = await OsService.list(chamado, sessao.recurso as any, data)
  return NextResponse.json(response)
}

async function handlerGet(request: NextRequest) {

  // O consultor vem da sessão, não da URL.
  const sessao = await exigirSessao(request)
  if (!sessao.ok) return sessao.resposta

  const response = await ListTaskService(`${sessao.recurso}`)
  return NextResponse.json(response)
}

export { handlerPost as POST,  handlerGet as GET};
