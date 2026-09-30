import UpdateCallClassService from '@/services/call/updateClassificacao';
import { NextResponse, type NextRequest } from 'next/server'
import { respostaErroInterno } from '@/services/erro-interno'
import { exigirChamadoDoConsultor } from '@/services/permissao'
 
async function handler(request: NextRequest) {


  const {
    COD_CHAMADO, COD_CLASSIFICACAO

  } = await request.json();

  const permissao = await exigirChamadoDoConsultor(request, COD_CHAMADO)
  if (!permissao.ok) return permissao.resposta


  try {
    const response = await UpdateCallClassService(COD_CHAMADO, COD_CLASSIFICACAO)

    return NextResponse.json(response)
  } catch(error) {


    return respostaErroInterno(error, 'insert-classificacao')
  }
  
  

  
}

export { handler as POST };