import scrapeNFCe from '../service';

async function test() {
  console.log('Iniciando teste de scraping NFCe...\n');

  // Chave de exemplo fornecida
  const chaveAcesso = '31251248793792000800650010000615361984863270';

  console.log(`Chave de acesso: ${chaveAcesso}`);
  console.log('Iniciando scraping...\n');

  const result = await scrapeNFCe(chaveAcesso);

  console.log('\n=== RESULTADO ===\n');
  console.log(JSON.stringify(result, null, 2));
}

test().catch(console.error);
