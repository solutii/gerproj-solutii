import puppeteer, { Browser, Page } from 'puppeteer';

interface ProdutoNFCe {
  item: string;
  codigo: string;
  descricao: string;
  quantidade: string;
  unidade: string;
  valorUnitario: string;
  valorTotal: string;
}

interface PagamentoNFCe {
  forma: string;
  valor: string;
}

interface NFCeData {
  chaveAcesso: string;
  numero: string;
  serie: string;
  dataEmissao: string;
  horaEmissao: string;
  protocolo: string;
  dataAutorizacao: string;

  emitente: {
    cnpj: string;
    razaoSocial: string;
    nomeFantasia: string;
    endereco: string;
    bairro: string;
    cidade: string;
    uf: string;
    cep: string;
    telefone: string;
  };

  consumidor: {
    cpfCnpj: string;
    nome: string;
  };

  produtos: ProdutoNFCe[];

  totais: {
    valorProdutos: string;
    valorDesconto: string;
    valorTotal: string;
  };

  pagamentos: PagamentoNFCe[];

  informacoesAdicionais: string;
}

interface ScrapingResult {
  success: boolean;
  data?: NFCeData;
  error?: string;
  captchaRequired?: boolean;
}

interface ScrapingOptions {
  captchaTimeout?: number; // Tempo em segundos para aguardar resolução do captcha (padrão: 120)
  headless?: boolean; // Se true, roda em modo headless (padrão: false - permite resolução manual do captcha)
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeNFCe(chaveAcesso: string, options: ScrapingOptions = {}): Promise<ScrapingResult> {
  const { captchaTimeout = 120, headless = false } = options;
  let browser: Browser | null = null;

  try {
    // Validar chave de acesso (44 dígitos)
    if (!chaveAcesso || chaveAcesso.length !== 44 || !/^\d+$/.test(chaveAcesso)) {
      return {
        success: false,
        error: 'Chave de acesso inválida. Deve conter 44 dígitos numéricos.'
      };
    }

    // Iniciar browser com configurações para bypass do Cloudflare
    browser = await puppeteer.launch({
      headless: headless, // false permite resolução manual do captcha
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--window-size=1920,1080',
        '--start-maximized',
      ],
      defaultViewport: {
        width: 1920,
        height: 1080
      }
    });

    const page: Page = await browser.newPage();

    // Configurar user agent para parecer um navegador real
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Remover indicadores de automação
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      // @ts-ignore
      window.chrome = { runtime: {} };

      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      Object.defineProperty(navigator, 'languages', {
        get: () => ['pt-BR', 'pt', 'en-US', 'en'],
      });
    });

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

    // Verificar se há desafio Cloudflare e aguardar resolução
    let attempts = 0;
    const maxAttempts = 12; // 60 segundos máximo

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

    // Tentar diferentes seletores possíveis
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

        // Limpar e preencher o campo
        await page.click(selector);
        await page.evaluate((sel) => {
          const input = document.querySelector(sel) as HTMLInputElement;
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
      // Tirar screenshot para debug
      await page.screenshot({ path: 'debug-nfce.png' });
      return {
        success: false,
        error: 'Campo de chave de acesso não encontrado. Screenshot salvo em debug-nfce.png'
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
      // Tentar pressionar Enter
      await page.keyboard.press('Enter');
    }

    // Aguardar resultado - verificar se há captcha e aguardar resolução
    console.log('Aguardando resultado...');
    console.log('ATENÇÃO: Se houver CAPTCHA, resolva manualmente no navegador!');

    let captchaResolved = false;
    let waitAttempts = 0;
    const maxWaitAttempts = captchaTimeout; // segundos

    while (!captchaResolved && waitAttempts < maxWaitAttempts) {
      await delay(1000);
      waitAttempts++;

      const pageContent = await page.content();

      // Verificar se há mensagem de erro de captcha
      if (pageContent.includes('HCaptcha é de preenchimento obrigatório') ||
          pageContent.includes('reCAPTCHA é de preenchimento obrigatório') ||
          (pageContent.includes('cf-turnstile') && !pageContent.includes('Dados do Emitente'))) {
        // Captcha ainda não foi resolvido
        if (waitAttempts % 10 === 0) {
          console.log(`Aguardando resolução do captcha... (${waitAttempts}s/${captchaTimeout}s)`);
        }
        continue;
      }

      // Verificar se navegou para página de resultado
      if (pageContent.includes('Dados do Emitente') ||
          pageContent.includes('Dados da NFC-e') ||
          pageContent.includes('DANFE') ||
          pageContent.includes('Valor Total da Nota')) {
        console.log('Captcha resolvido! Página de resultado detectada.');
        captchaResolved = true;
        break;
      }

      // Verificar mensagens de erro
      if (pageContent.includes('NFC-e não encontrada') ||
          pageContent.includes('Chave de acesso inválida') ||
          pageContent.includes('Nota não localizada') ||
          pageContent.includes('não existe') ||
          pageContent.includes('não foi localizada')) {
        console.log('Nota não encontrada ou chave inválida.');
        return {
          success: false,
          error: 'NFC-e não encontrada. Verifique se a chave de acesso está correta.'
        };
      }
    }

    if (waitAttempts >= maxWaitAttempts && !captchaResolved) {
      return {
        success: false,
        error: `Timeout de ${captchaTimeout} segundos aguardando resolução do captcha.`,
        captchaRequired: true
      };
    }

    await delay(2000);

    // Tirar screenshot do resultado para debug
    try {
      await page.setViewport({ width: 1920, height: 1080 });
      await page.screenshot({ path: 'debug-nfce-after-click.png', fullPage: true });
    } catch {
      // Ignorar erro de screenshot
    }

    // Extrair dados da NFCe
    const nfceData = await page.evaluate(() => {
      const getText = (selector: string): string => {
        const el = document.querySelector(selector);
        return el?.textContent?.trim() || '';
      };

      const getTextByLabel = (labelText: string): string => {
        const labels = document.querySelectorAll('label, span, td, th, div');
        for (const label of Array.from(labels)) {
          if (label.textContent?.trim().toLowerCase().includes(labelText.toLowerCase())) {
            // Tentar próximo elemento
            const next = label.nextElementSibling;
            if (next && next.textContent) {
              return next.textContent.trim();
            }
            // Tentar elemento pai
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
      const produtos: Array<{
        item: string;
        codigo: string;
        descricao: string;
        quantidade: string;
        unidade: string;
        valorUnitario: string;
        valorTotal: string;
      }> = [];

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
      const pagamentos: Array<{ forma: string; valor: string }> = [];
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

      // Pegar todo o HTML para debug
      const bodyHtml = document.body.innerHTML;

      return {
        chaveAcesso: getText('[class*="chave"]') || (document.querySelector('input[id*="chave"]') as HTMLInputElement)?.value || '',
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

    // Log debug info
    console.log('Debug info:', JSON.stringify(nfceData._debug, null, 2));

    // Se não conseguiu extrair dados, salvar HTML para análise
    if (!nfceData.numero && !nfceData.emitente.cnpj) {
      const pageHtml = await page.content();
      console.log('Conteúdo da página salvo para análise');

      // Salvar HTML para debug
      const fs = await import('fs');
      fs.writeFileSync('debug-nfce.html', pageHtml);

      // Tirar screenshot
      await page.screenshot({ path: 'debug-nfce-result.png', fullPage: true });

      return {
        success: false,
        error: 'Não foi possível extrair dados da NFCe. Verifique debug-nfce.html e debug-nfce-result.png'
      };
    }

    // Remover debug info do resultado final
    const { _debug, ...cleanData } = nfceData;
    const finalData: NFCeData = {
      ...cleanData,
      chaveAcesso
    };

    return {
      success: true,
      data: finalData
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Erro no scraping:', errorMessage);

    return {
      success: false,
      error: `Erro ao buscar NFCe: ${errorMessage}`
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

export default scrapeNFCe;
export type { NFCeData, ProdutoNFCe, PagamentoNFCe, ScrapingResult, ScrapingOptions };
