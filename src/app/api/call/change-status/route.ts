import ChangeStatusService from '@/services/call/change-status'
import { NextResponse, type NextRequest } from 'next/server'
import { ErroDeRegra } from '@/services/erro-regra'
import { respostaErroInterno } from '@/services/erro-interno'
import { exigirChamadoDoConsultor } from '@/services/permissao'
 
async function handler(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const codChamado = searchParams.get('codChamado')
  const status = searchParams.get('status')
  const data   = searchParams.get('data')
  const email  = searchParams.get('email')

  const permissao = await exigirChamadoDoConsultor(request, codChamado)
  if (!permissao.ok) return permissao.resposta


  try {
    const response = await ChangeStatusService(codChamado??'', status??'', email??'')

    return NextResponse.json(response)
  } catch(error) {
    // Só mensagem de regra de negócio vai pra tela (status 400); qualquer outro
    // erro (banco, bug) vira resposta genérica e o detalhe fica no log.
    if (!(error instanceof ErroDeRegra)) return respostaErroInterno(error, 'call/change-status')

    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  
  

  
}

// Só POST: estas rotas alteram dados e não podem ser disparadas por um link (GET).
export { handler as POST };