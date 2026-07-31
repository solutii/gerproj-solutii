import { InsertSaveService, GetSaveService, MacExistsError } from "@/services/save";
import { NextResponse, type NextRequest } from 'next/server'

async function handlerPost(request: NextRequest) {

  const {
    MAC,
    CNPJ,
    NOME,
  } = await request.json();

  if (!MAC) {
    return NextResponse.json({ error: 'MAC é obrigatório' }, { status: 400 })
  }

  try {
    await InsertSaveService(MAC, CNPJ, NOME)

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof MacExistsError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    return NextResponse.json({ error }, { status: 500 })
  }
}

async function handlerGet(request: NextRequest) {

  const { searchParams } = new URL(request.url)
  const mac = searchParams.get('mac')

  if (!mac) {
    return NextResponse.json({ error: 'mac é obrigatório' }, { status: 400 })
  }

  try {
    const response = await GetSaveService(mac)

    if (!response) {
      return NextResponse.json({ error: 'MAC não encontrado' }, { status: 404 })
    }

    return NextResponse.json(response)
  } catch (error) {
    return NextResponse.json({ error }, { status: 500 })
  }
}

export { handlerPost as POST, handlerGet as GET };
