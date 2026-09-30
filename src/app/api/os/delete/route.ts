import DeleteOsService from '@/services/os/delete';
import { recursoDaRequisicao } from '@/services/os/regras-apontamento'
import { NextResponse, type NextRequest } from 'next/server'
import { ErroDeRegra } from '@/services/erro-regra'
import { respostaErroInterno } from '@/services/erro-interno'
 
async function handler(request: NextRequest) {


  const {
    codOs
  } = await request.json();


  try {
    // O consultor vem da sessão, não do corpo da requisição.
    const recurso = await recursoDaRequisicao(request)
    const response = await DeleteOsService(codOs, recurso)

    return NextResponse.json(response)
  } catch(error) {
    // Só mensagem de regra de negócio vai pra tela (status 400); qualquer outro
    // erro (banco, bug) vira resposta genérica e o detalhe fica no log.
    if (!(error instanceof ErroDeRegra)) return respostaErroInterno(error, 'os/delete')

    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  
  

  
}

// Só POST: estas rotas alteram dados e não podem ser disparadas por um link (GET).
export { handler as POST };