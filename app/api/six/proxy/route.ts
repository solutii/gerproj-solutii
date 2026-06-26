import { NextResponse, type NextRequest } from 'next/server';
import https from 'node:https';
import tls from 'node:tls';
import fs from 'node:fs';
import path from 'node:path';

// mTLS exige o módulo https do Node, então força runtime node (não edge)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BASE_URL = 'https://adn.nfse.gov.br/contribuintes/DFe/1';

// Os certificados ficam em services/certs/{cnpj}/
function certsDir(cnpj: string) {
  return path.join(process.cwd(), 'services', 'certs', cnpj);
}

function loadAgent(cnpj: string): https.Agent {
  const dir = certsDir(cnpj);

  const cert = fs.readFileSync(path.join(dir, 'certificado_cert.pem'));
  const key = fs.readFileSync(path.join(dir, 'certificado_key.pem'));

  // IMPORTANTE: a opção `ca` SUBSTITUI a store de CAs padrão do Node. O arquivo
  // certificado_ca.pem é a cadeia do certificado CLIENTE (ICP-Brasil); se passado
  // sozinho, o Node perde a CA pública que assina o servidor adn.nfse.gov.br e dá
  // "unable to get local issuer certificate". Por isso mesclamos com tls.rootCertificates.
  const caPath = path.join(dir, 'certificado_ca.pem');
  const ca: string[] = [...tls.rootCertificates];
  if (fs.existsSync(caPath)) {
    ca.push(fs.readFileSync(caPath, 'utf8'));
  }

  const passphrasePath = path.join(dir, 'certificado_pass.txt');
  const passphrase = fs.existsSync(passphrasePath)
    ? fs.readFileSync(passphrasePath, 'utf8').trim()
    : undefined;

  return new https.Agent({ cert, key, ca, passphrase, keepAlive: false });
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

async function handlerGet(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const cnpjRaw = searchParams.get('cnpj') ?? searchParams.get('cnpjConsulta');
  const lote = searchParams.get('lote');

  // Mantém apenas dígitos — também evita path traversal no nome da pasta
  const cnpj = (cnpjRaw ?? '').replace(/\D/g, '');

  if (!cnpj) {
    return NextResponse.json(
      { success: false, error: 'Parâmetro "cnpj" é obrigatório' },
      { status: 400 }
    );
  }

  if (!lote) {
    return NextResponse.json(
      { success: false, error: 'Parâmetro "lote" é obrigatório' },
      { status: 400 }
    );
  }

  if (!fs.existsSync(certsDir(cnpj))) {
    return NextResponse.json(
      { success: false, error: `Certificado não encontrado para o CNPJ ${cnpj}` },
      { status: 404 }
    );
  }

  try {
    const agent = loadAgent(cnpj);
    const url = `${BASE_URL}?cnpjConsulta=${encodeURIComponent(cnpj)}&lote=${encodeURIComponent(lote)}`;

    const { status, body, contentType } = await fetchDFe(url, agent);

    // Repassa o corpo e o status originais do gateway nacional
    return new NextResponse(body, {
      status,
      headers: { 'content-type': contentType },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno';
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}

export { handlerGet as GET };
