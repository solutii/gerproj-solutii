import StandbyCallService from '@/services/call/standby'
import TaskService from '@/services/call/task';
import { NextResponse, type NextRequest } from 'next/server'
import { respostaErroInterno } from '@/services/erro-interno'
import { exigirChamadoDoConsultor } from '@/services/permissao'
 
async function handler(request: NextRequest) {


  const {
    chamado,
  } = await request.json();

  const permissao = await exigirChamadoDoConsultor(request, chamado?.COD_CHAMADO)
  if (!permissao.ok) return permissao.resposta



  try {
    const response = await TaskService(chamado)

    return NextResponse.json(response)
  } catch(error) {


    return respostaErroInterno(error, 'call/task')
  }
  
  

  
}

export { handler as POST };