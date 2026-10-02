// Ajudantes de navegador para exportar: baixar um arquivo gerado na hora e imprimir
// (ou salvar como PDF) um HTML. Usados pelo espelho do consultor e pelo dashboard.

export function baixarArquivo(nome: string, conteudo: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const link = document.createElement("a");

  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// Imprime o HTML (ou salva como PDF pelo diálogo de impressão) num iframe
// invisível, sem abrir nova janela e sem mexer na página.
export function imprimirHtml(html: string) {
  const iframe = document.createElement("iframe");

  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(iframe);

  const limpar = () => window.setTimeout(() => iframe.remove(), 1000);
  const janela = iframe.contentWindow;

  if (!janela) {
    iframe.remove();
    return;
  }

  janela.document.open();
  janela.document.write(html);
  janela.document.close();
  janela.addEventListener("afterprint", limpar);
  // Espera o layout do iframe antes de abrir o diálogo.
  window.setTimeout(() => {
    janela.focus();
    janela.print();
  }, 200);
  // Rede de segurança caso o navegador não dispare "afterprint".
  window.setTimeout(() => iframe.remove(), 60_000);
}
