import StandbyCallService from '@/services/call/standby'
import ClassificacaoService from '@/services/call/classificacao';
import { NextResponse, type NextRequest } from 'next/server'
import { respostaErroInterno } from '@/services/erro-interno'
 
async function handler(request: NextRequest) {

  const {
    chamado,
  } = await request.json();

  try {
    const response = await ClassificacaoService()

    return NextResponse.json(response)
  } catch(error) {

    return respostaErroInterno(error, 'call/classificacao')
  }
  
}

export { handler as POST };