import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Usar plugin stealth para esconder automação
puppeteer.use(StealthPlugin());

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeNFCe(chaveAcesso) {
  let browser = null;

  try {
    // Validar chave de acesso (44 dígitos)
    if (!chaveAcesso || chaveAcesso.length !== 44 || !/^\d+$/.test(chaveAcesso)) {
      return {
        success: false,
        error: 'Chave de acesso inválida. Deve conter 44 dígitos numéricos.'
      };
    }

    const fs = await import('fs');

    console.log('Iniciando navegador com stealth mode...');

    // Usar executablePath direto para o Chrome instalado
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

    // Lançar Chrome com stealth plugin (esconde automação)
    browser = await puppeteer.launch({
      headless: false,
      executablePath: chromePath,
      args: [
        '--window-size=1920,1080',
        '--start-maximized',
      ],
      defaultViewport: null
    });

    console.log('Navegador iniciado!');

    // Usar a página que já foi aberta pelo Chrome
    const pages = await browser.pages();
    const page = pages[0] || await browser.newPage();
    console.log('Página obtida!');

    // Navegar para a página de consulta
    const url = 'https://portalsped.fazenda.mg.gov.br/portalnfce/sistema/consultaarg.xhtml';

    console.log('Navegando para o portal...');
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // Aguardar possível desafio do Cloudflare
    console.log('Aguardando carregamento da página...');
    await delay(5000);

    // Verificar se há desafio Cloudflare
    let attempts = 0;
    const maxAttempts = 12;

    while (attempts < maxAttempts) {
      const pageContent = await page.content();

      if (pageContent.includes('challenge-running') ||
          pageContent.includes('cf-browser-verification') ||
          pageContent.includes('Checking your browser')) {
        console.log('Cloudflare detectado, aguardando...');
        await delay(5000);
        attempts++;
      } else {
        break;
      }
    }

    if (attempts >= maxAttempts) {
      return {
        success: false,
        error: 'Timeout aguardando validação do Cloudflare'
      };
    }

    // Aguardar o campo de chave de acesso
    console.log('Buscando campo de chave de acesso...');

    const possibleSelectors = [
      'input[id*="chave"]',
      'input[name*="chave"]',
      'input[placeholder*="chave"]',
      'input[type="text"]',
      '#formConsulta\\:chaveAcesso',
      'input.form-control'
    ];

    let inputFound = false;

    for (const selector of possibleSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        await page.click(selector);
        await page.evaluate((sel) => {
          const input = document.querySelector(sel);
          if (input) input.value = '';
        }, selector);
        await page.type(selector, chaveAcesso, { delay: 50 });
        inputFound = true;
        console.log(`Campo encontrado com seletor: ${selector}`);
        break;
      } catch {
        continue;
      }
    }

    if (!inputFound) {
      try {
        await page.screenshot({ path: 'debug-nfce.png' });
      } catch (e) {
        console.log('Não foi possível tirar screenshot:', e.message);
      }
      return {
        success: false,
        error: 'Campo de chave de acesso não encontrado.'
      };
    }

    await delay(1000);

    // Clicar no botão de consulta
    console.log('Clicando no botão de consulta...');

    const buttonSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button[id*="consultar"]',
      'button[id*="pesquisar"]',
      '.btn-primary',
      'button.btn'
    ];

    let buttonClicked = false;

    for (const selector of buttonSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 3000 });
        await page.click(selector);
        buttonClicked = true;
        console.log(`Botão encontrado com seletor: ${selector}`);
        break;
      } catch {
        continue;
      }
    }

    if (!buttonClicked) {
      await page.keyboard.press('Enter');
    }

    // Aguardar resultado
    console.log('Aguardando resultado...');
    console.log('\n⚠️  ATENÇÃO: Resolva o CAPTCHA manualmente no navegador!\n');

    // Aguardar que o captcha seja resolvido e a página navegue
    // Verificar se há mensagem de erro de captcha e aguardar
    let captchaResolved = false;
    let waitAttempts = 0;
    const maxWaitAttempts = 60; // 60 segundos máximo para resolver captcha

    while (!captchaResolved && waitAttempts < maxWaitAttempts) {
      await delay(1000);
      waitAttempts++;

      let pageContent;
      try {
        pageContent = await page.content();
      } catch (e) {
        // Contexto destruído - página pode ter navegado
        console.log('Página navegou, aguardando estabilização...');
        await delay(2000);
        try {
          pageContent = await page.content();
        } catch {
          continue;
        }
      }

      // Verificar se há mensagem de erro de captcha
      if (pageContent.includes('HCaptcha é de preenchimento obrigatório') ||
          (pageContent.includes('cf-turnstile') && pageContent.includes('formPrincipal:chaveacesso'))) {
        // Captcha ainda não foi resolvido
        if (waitAttempts % 5 === 0) {
          console.log(`Aguardando resolução do captcha... (${waitAttempts}s)`);
        }
        continue;
      }

      // Verificar se navegou para página de resultado
      if (pageContent.includes('Dados do Emitente') ||
          pageContent.includes('Dados da NFC-e') ||
          pageContent.includes('DANFE') ||
          pageContent.includes('Valor Total da Nota') ||
          pageContent.includes('detalhes da NFC-e')) {
        console.log('✓ Captcha resolvido! Página de resultado detectada.');
        captchaResolved = true;
        break;
      }

      // Verificar mensagens de erro
      if (pageContent.includes('NFC-e não encontrada') ||
          pageContent.includes('Chave de acesso inválida') ||
          pageContent.includes('Nota não localizada') ||
          pageContent.includes('não existe') ||
          pageContent.includes('não foi localizada')) {
        console.log('❌ Nota não encontrada ou chave inválida.');
        break;
      }
    }

    if (waitAttempts >= maxWaitAttempts) {
      console.log('Timeout aguardando resolução do captcha.');
    }

    await delay(2000);

    // Tirar screenshot do resultado
    try {
      await page.setViewport({ width: 1920, height: 1080 });
      await page.screenshot({ path: 'debug-nfce-after-click.png', fullPage: true });
      console.log('Screenshot salvo: debug-nfce-after-click.png');
    } catch (e) {
      console.log('Não foi possível tirar screenshot:', e.message);
    }

    // Extrair dados da NFCe
    const nfceData = await page.evaluate(() => {
      const getText = (selector) => {
        const el = document.querySelector(selector);
        return el?.textContent?.trim() || '';
      };

      const getTextByLabel = (labelText) => {
        const labels = document.querySelectorAll('label, span, td, th, div');
        for (const label of Array.from(labels)) {
          if (label.textContent?.trim().toLowerCase().includes(labelText.toLowerCase())) {
            const next = label.nextElementSibling;
            if (next && next.textContent) {
              return next.textContent.trim();
            }
            const parent = label.parentElement;
            if (parent) {
              const sibling = parent.nextElementSibling;
              if (sibling && sibling.textContent) {
                return sibling.textContent.trim();
              }
            }
          }
        }
        return '';
      };

      // Extrair produtos da tabela
      const produtos = [];
      const produtoRows = document.querySelectorAll('table tbody tr, .det, [class*="item"]');

      produtoRows.forEach((row, index) => {
        const cells = row.querySelectorAll('td, span.valor, div.valor');
        if (cells.length >= 4) {
          produtos.push({
            item: String(index + 1),
            codigo: cells[0]?.textContent?.trim() || '',
            descricao: cells[1]?.textContent?.trim() || '',
            quantidade: cells[2]?.textContent?.trim() || '',
            unidade: cells[3]?.textContent?.trim() || '',
            valorUnitario: cells[4]?.textContent?.trim() || '',
            valorTotal: cells[5]?.textContent?.trim() || ''
          });
        }
      });

      // Extrair pagamentos
      const pagamentos = [];
      const pagamentoRows = document.querySelectorAll('[class*="pgto"] tr, [class*="pagamento"] tr');

      pagamentoRows.forEach((row) => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 2) {
          pagamentos.push({
            forma: cells[0]?.textContent?.trim() || '',
            valor: cells[1]?.textContent?.trim() || ''
          });
        }
      });

      const bodyHtml = document.body.innerHTML;

      return {
        chaveAcesso: getText('[class*="chave"]') || document.querySelector('input[id*="chave"]')?.value || '',
        numero: getTextByLabel('número') || getTextByLabel('nro') || getText('[class*="numero"]'),
        serie: getTextByLabel('série') || getText('[class*="serie"]'),
        dataEmissao: getTextByLabel('emissão') || getText('[class*="data"]'),
        horaEmissao: getTextByLabel('hora') || '',
        protocolo: getTextByLabel('protocolo') || getText('[class*="protocolo"]'),
        dataAutorizacao: getTextByLabel('autorização') || '',

        emitente: {
          cnpj: getTextByLabel('cnpj') || getText('[class*="cnpj"]'),
          razaoSocial: getTextByLabel('razão') || getText('[class*="razao"]'),
          nomeFantasia: getTextByLabel('fantasia') || getText('[class*="fantasia"]'),
          endereco: getTextByLabel('endereço') || getTextByLabel('logradouro') || getText('[class*="endereco"]'),
          bairro: getTextByLabel('bairro') || getText('[class*="bairro"]'),
          cidade: getTextByLabel('município') || getTextByLabel('cidade') || getText('[class*="cidade"]'),
          uf: getTextByLabel('uf') || getText('[class*="uf"]'),
          cep: getTextByLabel('cep') || getText('[class*="cep"]'),
          telefone: getTextByLabel('telefone') || getText('[class*="telefone"]'),
        },

        consumidor: {
          cpfCnpj: getTextByLabel('cpf') || getText('[class*="cpf"]'),
          nome: getTextByLabel('consumidor') || '',
        },

        produtos,

        totais: {
          valorProdutos: getTextByLabel('valor dos produtos') || getText('[class*="total-produtos"]'),
          valorDesconto: getTextByLabel('desconto') || getText('[class*="desconto"]'),
          valorTotal: getTextByLabel('valor total') || getText('[class*="total"]'),
        },

        pagamentos,

        informacoesAdicionais: getTextByLabel('informações') || getText('[class*="info"]'),

        _debug: {
          htmlLength: bodyHtml.length,
          hasTable: document.querySelectorAll('table').length > 0,
          url: window?.location?.href || ''
        }
      };
    });

    console.log('Debug info:', JSON.stringify(nfceData._debug, null, 2));

    // Salvar HTML para análise
    const pageHtml = await page.content();
    fs.writeFileSync('debug-nfce.html', pageHtml);
    console.log('HTML salvo: debug-nfce.html');

    if (!nfceData.numero && !nfceData.emitente.cnpj) {
      try {
        await page.screenshot({ path: 'debug-nfce-result.png', fullPage: true });
      } catch (e) {
        console.log('Não foi possível tirar screenshot de resultado:', e.message);
      }
      return {
        success: false,
        error: 'Não foi possível extrair dados da NFCe. Verifique debug-nfce.html e debug-nfce-result.png',
        _debug: nfceData._debug
      };
    }

    const { _debug, ...cleanData } = nfceData;

    return {
      success: true,
      data: {
        ...cleanData,
        chaveAcesso
      }
    };

  } catch (error) {
    console.error('Erro no scraping:', error.message);
    return {
      success: false,
      error: `Erro ao buscar NFCe: ${error.message}`
    };
  } finally {
    // Aguardar um pouco antes de fechar para ver o resultado
    console.log('\nAguardando 5 segundos antes de fechar o navegador...');
    await delay(5000);
    if (browser) {
      await browser.close();
    }
  }
}

// Executar teste
async function test() {
  console.log('Iniciando teste de scraping NFCe...\n');

  const chaveAcesso = '31251248793792000800650010000615361984863270';

  console.log(`Chave de acesso: ${chaveAcesso}`);
  console.log('Iniciando scraping...\n');

  const result = await scrapeNFCe(chaveAcesso);

  console.log('\n=== RESULTADO ===\n');
  console.log(JSON.stringify(result, null, 2));
}

test().catch(console.error);
