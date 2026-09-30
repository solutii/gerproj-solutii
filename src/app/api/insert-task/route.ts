import UpdateCallTaskService from '@/services/call/update';
import { NextResponse, type NextRequest } from 'next/server'
import { respostaErroInterno } from '@/services/erro-interno'
import { exigirChamadoDoConsultor } from '@/services/permissao'
 
async function handler(request: NextRequest) {


  const {
    COD_CHAMADO, COD_TAREFA

  } = await request.json();

  const permissao = await exigirChamadoDoConsultor(request, COD_CHAMADO)
  if (!permissao.ok) return permissao.resposta


  try {
    const response = await UpdateCallTaskService(COD_CHAMADO, COD_TAREFA)

    return NextResponse.json(response)
  } catch(error) {


    return respostaErroInterno(error, 'insert-task')
  }
  
  

  
}

export { handler as POST };