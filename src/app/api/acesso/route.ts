import AtualizarAcessoCliente from '@/services/tarefa/acesso';
import { NextResponse, type NextRequest } from 'next/server'
import { respostaErroInterno } from '@/services/erro-interno'
import { exigirClienteDoConsultor } from '@/services/permissao'
 
async function handler(request: NextRequest) {
  
  const {
    descricao,
    cliente
  } = await request.json();

  const permissao = await exigirClienteDoConsultor(request, cliente)
  if (!permissao.ok) return permissao.resposta

  

  try {
    const response = await AtualizarAcessoCliente( 
      descricao,
      cliente)

    return NextResponse.json(response)
  } catch(error) {


    return respostaErroInterno(error, 'acesso')
  }
  
  

  
}

export { handler as POST };