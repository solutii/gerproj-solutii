// Erro de regra de negócio/permissão: a mensagem é feita pra o usuário e pode ir
// pra tela. Qualquer outro erro (banco, rede, bug) NÃO pode vazar o detalhe.
export class ErroDeRegra extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroDeRegra";
    Object.setPrototypeOf(this, ErroDeRegra.prototype);
  }
}
