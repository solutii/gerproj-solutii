import { NextResponse } from "next/server";

// Erro inesperado numa rota: o detalhe (mensagem do banco, SQL, pilha) fica só
// no log do servidor; o navegador recebe uma mensagem genérica.
export function respostaErroInterno(error: unknown, rota: string): NextResponse {
  console.error(`[${rota}]`, error);

  return NextResponse.json(
    { error: "Não foi possível concluir a operação. Tente novamente." },
    { status: 500 },
  );
}
