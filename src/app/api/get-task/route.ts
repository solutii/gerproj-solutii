import TaskDetailsService from '@/services/call/task-details';
import UpdateCallTaskService from '@/services/call/update';
import { NextResponse, type NextRequest } from 'next/server'
import { respostaErroInterno } from '@/services/erro-interno'
import { exigirSessao } from '@/services/permissao'
 
async function handler(request: NextRequest) {


  const {
    COD_CHAMADO

  } = await request.json();

  // O id recebido aqui nem sempre é de chamado (o apontamento em tarefa envia o
  // código da tarefa/OS), então só exigimos sessão -- sem checar dono do chamado.
  const sessao = await exigirSessao(request)
  if (!sessao.ok) return sessao.resposta


  try {
    const response = await TaskDetailsService(COD_CHAMADO)

    return NextResponse.json(response)
  } catch(error) {


    return respostaErroInterno(error, 'get-task')
  }
  
  

  
}

export { handler as POST };