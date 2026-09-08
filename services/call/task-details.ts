import { ChamadosType, STATUS_CHAMADO, STATUS_CHAMADO_COD } from "@/models/chamados";
import { Firebird, getConnection } from "../firebird";

export default async function TaskDetailsService(
    COD_CHAMADO: any): Promise<any> {


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
                            TAREFA ON TAREFA.COD_TAREFA = CHAMADO.CODTRF_CHAMADO
                                JOIN
                            PROJETO ON PROJETO.COD_PROJETO = TAREFA.CODPRO_TAREFA

                        WHERE CHAMADO.COD_CHAMADO = ?`,
                    [COD_CHAMADO], async function (err: any, res: any) {
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