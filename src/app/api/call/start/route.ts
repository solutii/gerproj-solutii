import StartCallService from '@/services/call/start'
import { NextResponse, type NextRequest } from 'next/server'
import { respostaErroInterno } from '@/services/erro-interno'
import { exigirChamadoDoConsultor } from '@/services/permissao'
 
async function handler(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const codChamado = searchParams.get('codChamado')

  const permissao = await exigirChamadoDoConsultor(request, codChamado)
  if (!permissao.ok) return permissao.resposta

  

  try {
    const response = await StartCallService(codChamado??'')

    return NextResponse.json(response)
  } catch(error) {


    return respostaErroInterno(error, 'call/start')
  }
  
  

  
}

// Só POST: estas rotas alteram dados e não podem ser disparadas por um link (GET).
export { handler as POST };