import scrapeNFCe from '@/nfe/service';
import { NextResponse, type NextRequest } from 'next/server';

async function handlerPost(request: NextRequest) {
  try {
    const { chaveAcesso, captchaTimeout } = await request.json();

    if (!chaveAcesso) {
      return NextResponse.json(
        { success: false, error: 'Chave de acesso é obrigatória' },
        { status: 400 }
      );
    }

    // Remove espaços e caracteres não numéricos
    const chaveFormatada = chaveAcesso.replace(/\D/g, '');

    const response = await scrapeNFCe(chaveFormatada, {
      captchaTimeout: captchaTimeout || 120,
      headless: false // Sempre visível para permitir resolução manual do captcha
    });

    if (!response.success) {
      const statusCode = response.captchaRequired ? 408 : 400;
      return NextResponse.json(response, { status: statusCode });
    }

    return NextResponse.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

async function handlerGet(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const chaveAcesso = searchParams.get('chave');
  const captchaTimeout = searchParams.get('timeout');

  if (!chaveAcesso) {
    return NextResponse.json(
      { success: false, error: 'Parâmetro "chave" é obrigatório' },
      { status: 400 }
    );
  }

  // Remove espaços e caracteres não numéricos
  const chaveFormatada = chaveAcesso.replace(/\D/g, '');

  const response = await scrapeNFCe(chaveFormatada, {
    captchaTimeout: captchaTimeout ? parseInt(captchaTimeout) : 120,
    headless: false
  });

  if (!response.success) {
    const statusCode = response.captchaRequired ? 408 : 400;
    return NextResponse.json(response, { status: statusCode });
  }

  return NextResponse.json(response);
}

export { handlerPost as POST, handlerGet as GET };
