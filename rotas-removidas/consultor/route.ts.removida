import findRecursoByName from '@/services/consultor';
import { NextResponse, type NextRequest } from 'next/server'
 
async function handlerPost(request: NextRequest) {
  
  const  {
    name,
  } = await request.json()

  const response = await findRecursoByName(name)
  return NextResponse.json(response)
}


export { handlerPost as POST};