
import findChamado from '@/services/ticket';
import { NextResponse, type NextRequest } from 'next/server'
 
async function handlerPost(request: NextRequest) {
  
  const  {
    client,
    stats,
    consultant
  } = await request.json()

  const response = await findChamado(stats,client, consultant)
  return NextResponse.json(response)

}


export { handlerPost as POST};