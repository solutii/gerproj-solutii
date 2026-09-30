import { NextResponse, type NextRequest } from 'next/server';
import https from 'node:https';
import tls from 'node:tls';

// mTLS exige o módulo https do Node, então força runtime node (não edge)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BASE_URL = 'https://adn.nfse.gov.br/contribuintes/DFe';

// Aceita o certificado como PEM (contém "-----BEGIN") ou base64 de um PEM.
function normalizePem(value: string): string {
  return value.includes('-----BEGIN')
    ? value
    : Buffer.from(value, 'base64').toString('utf8');
}

function buildAgent(cert: string, key: string, ca?: string, passphrase?: string): https.Agent {
  // IMPORTANTE: a opção `ca` SUBSTITUI a store de CAs padrão do Node. O `ca` recebido
  // é a cadeia do certificado CLIENTE (ICP-Brasil); se passado sozinho, o Node perde a
  // CA pública que assina o servidor adn.nfse.gov.br e dá "unable to get local issuer
  // certificate". Por isso mesclamos com tls.rootCertificates.
  const caList: string[] = [...tls.rootCertificates];
  if (ca) {
    caList.push(normalizePem(ca));
  }

  return new https.Agent({
    cert: normalizePem(cert),
    key: normalizePem(key),
    ca: caList,
    passphrase,
    keepAlive: false,
  });
}

function fetchDFe(
  url: string,
  agent: https.Agent
): Promise<{ status: number; body: string; contentType: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'GET', agent }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode ?? 502,
          body: Buffer.concat(chunks).toString('utf8'),
          contentType: res.headers['content-type'] ?? 'application/json',
        });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function handlerPost(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Corpo da requisição inválido (JSON esperado)' },
      { status: 400 }
    );
  }

  let { cnpj, lote, nsu, cert, key, ca, passphrase } = body ?? {};

  // Mantém apenas dígitos — também evita injeção na URL
  cnpj = String(cnpj ?? '').replace(/\D/g, '');
  nsu = String(nsu ?? '').replace(/\D/g, '');

  if (!cnpj) {
    return NextResponse.json(
      { success: false, error: 'Campo "cnpj" é obrigatório' },
      { status: 400 }
    );
  }

  if (!lote) {
    return NextResponse.json(
      { success: false, error: 'Campo "lote" é obrigatório' },
      { status: 400 }
    );
  }

  if (!nsu) {
    return NextResponse.json(
      { success: false, error: 'Campo "nsu" (último NSU) é obrigatório' },
      { status: 400 }
    );
  }

  if (!cert || !key) {
    return NextResponse.json(
      { success: false, error: 'Campos "cert" e "key" são obrigatórios' },
      { status: 400 }
    );
  }

  try {
    const agent = buildAgent(cert, key, ca, passphrase);
    const url = `${BASE_URL}/${nsu}?cnpjConsulta=${encodeURIComponent(cnpj)}&lote=${encodeURIComponent(lote)}`;

    const { status, body: respBody, contentType } = await fetchDFe(url, agent);

    // Repassa o corpo e o status originais do gateway nacional
    return new NextResponse(respBody, {
      status,
      headers: { 'content-type': contentType },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno';
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}

export { handlerPost as POST };
