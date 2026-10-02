import { gravar } from "../transacao";

// Liga o chamado a uma tarefa. Só responde depois do commit terminar (antes
// respondia na hora, com o commit ainda em andamento).
export default async function UpdateCallTaskService(
    COD_CHAMADO: number,
    COD_TAREFA: number): Promise<any> {

    await gravar((tx) => tx.executar(
        `UPDATE CHAMADO SET CHAMADO.CODTRF_CHAMADO =? WHERE CHAMADO.COD_CHAMADO =?`,
        [COD_TAREFA, COD_CHAMADO]))

    return true
}
