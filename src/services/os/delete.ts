import { validarPosseOs } from "./regras-apontamento";
import { gravarEmSerie } from "../transacao";

export default async function DeleteOsService(codOs: any, recurso: number): Promise<boolean> {

    // A OS precisa ser do consultor logado e estar no período vigente.
    await validarPosseOs(recurso, codOs)

    // Só responde depois de o commit terminar (antes respondia "sucesso" com o
    // commit ainda em andamento e a conexão já sendo fechada).
    await gravarEmSerie((tx) => tx.executar(`DELETE FROM OS  WHERE COD_OS = ?`, [codOs]))

    return true
}
