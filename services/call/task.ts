import { ChamadosType, STATUS_CHAMADO, STATUS_CHAMADO_COD } from "@/models/chamados";
import { Firebird, getConnection } from "../firebird";

export default async function TaskService(
    chamado: any): Promise<any> {


    return new Promise(async (resolve, reject) => {

        let db: any = null

        try {

            db = await new Promise((resolve, reject) => {
                getConnection( (err: any, db: any) => {
                    if (err) {
                        return reject(err)
                    }
                    return resolve(db)
                })
            })

           

            let tasks: any = await new Promise((resolve, reject) => {

                db.query(`SELECT TAREFA.NOME_TAREFA, TAREFA.COD_TAREFA, PROJETO.RESPCLI_PROJETO FROM
                            CHAMADO
                                JOIN
                            PROJETO ON PROJETO.CODCLI_PROJETO = CHAMADO.COD_CLIENTE
                                JOIN
                            TAREFA ON TAREFA.CODPRO_TAREFA = PROJETO.COD_PROJETO
                        WHERE CHAMADO.COD_CHAMADO = ? AND TAREFA.EXIBECHAM_TAREFA = 1 AND TAREFA.STATUS_TAREFA <> 4`,
                    [chamado.COD_CHAMADO], async function (err: any, res: any) {
                        if (err) {
                            db?.detach()
                            return reject(err);
                        }
                        return resolve(res)
                    })
            })

            db?.detach();

            return resolve(tasks)


        } catch (err) {
            db?.detach();
            return reject(err)
        }
    })
}