import ValidHoursService from '@/services/call/valid-hours'
import { NextResponse, type NextRequest } from 'next/server'
import { respostaErroInterno } from '@/services/erro-interno'
 
async function handler(request: NextRequest) {


  const {
    chamado,
    date,
    endTime,
    startTime,
  } = await request.json();


  try {
    const response = await ValidHoursService(chamado, date, startTime, endTime)
    return NextResponse.json(response)
  } catch(error) {


    return respostaErroInterno(error, 'call/valid-hours')
  }
  
  

  
}

export { handler as GET, handler as POST };