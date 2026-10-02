import { gravar } from "../transacao";

// Define a classificação do chamado. Só responde depois do commit terminar.
export default async function UpdateCallClassService(
    COD_CHAMADO: number,
    COD_CLASSIFICACAO: number): Promise<any> {

    await gravar((tx) => tx.executar(
        `UPDATE CHAMADO SET CHAMADO.COD_CLASSIFICACAO =? WHERE CHAMADO.COD_CHAMADO =?`,
        [COD_CLASSIFICACAO, COD_CHAMADO]))

    return true
}
