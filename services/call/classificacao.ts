import { ChamadosType, STATUS_CHAMADO, STATUS_CHAMADO_COD } from "@/models/chamados";
import { Firebird, getConnection } from "../firebird";

export default async function ClassificacaoService(): Promise<any> {


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

                db.query(`SELECT CLASSIFICACAO.NOME_CLASSIFICACAO, CLASSIFICACAO.COD_CLASSIFICACAO FROM
                            CLASSIFICACAO
                        WHERE CLASSIFICACAO.ATIVO_CLASSIFICACAO = 'SIM' AND CLASSIFICACAO.COD_CLASSIFICACAO <> 0`,
                    [], async function (err: any, res: any) {
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