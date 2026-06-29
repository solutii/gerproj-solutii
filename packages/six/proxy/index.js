'use strict';

const https = require('node:https');
const tls = require('node:tls');

// Aceita o certificado como PEM (contém "-----BEGIN") ou base64 de um PEM.
function normalizePem(value) {
  return value.includes('-----BEGIN')
    ? value
    : Buffer.from(value, 'base64').toString('utf8');
}

function buildAgent(cert, key, ca, passphrase) {
  // IMPORTANTE: a opção `ca` SUBSTITUI a store de CAs padrão do Node. O `ca` recebido
  // é a cadeia do certificado CLIENTE (ICP-Brasil); se passado sozinho, o Node perde a
  // CA pública que assina o servidor adn.nfse.gov.br e dá "unable to get local issuer
  // certificate". Por isso mesclamos com tls.rootCertificates.
  const caList = [...tls.rootCertificates];
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

function fetchDFe(url, agent) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'GET', agent }, (res) => {
      const chunks = [];
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

// Resposta no formato web action do DigitalOcean Functions
function json(statusCode, payload) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  };
}

// DigitalOcean Functions usa `main(args)`. Com `web: true`, os campos do corpo JSON
// chegam mesclados em `args` (args.cnpj, args.cert, etc.).
async function main(args) {
  const { url, cert, key, ca, passphrase } = args ?? {};

  if (!url) {
    return json(400, { success: false, error: 'Campo "url" é obrigatório' });
  }

  if (!cert || !key) {
    return json(400, { success: false, error: 'Campos "cert" e "key" são obrigatórios' });
  }

  try {
    const agent = buildAgent(cert, key, ca, passphrase);

    const { status, body, contentType } = await fetchDFe(url, agent);

    // Repassa o corpo e o status originais do gateway nacional
    return {
      statusCode: status,
      headers: { 'content-type': contentType },
      body,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno';
    return json(502, { success: false, error: message });
  }
}

exports.main = main;
