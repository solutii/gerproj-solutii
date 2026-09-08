import { ChamadosType, STATUS_CHAMADO, STATUS_CHAMADO_COD } from "@/models/chamados";
import { Firebird, getConnection } from "../firebird";

export default async function UpdateCallTaskService(
    COD_CHAMADO: number,
    COD_TAREFA: number): Promise<any> {


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

            const transaction: any = await new Promise((resolve, reject) => {
                db.transaction(Firebird.ISOLATION_READ_COMMITTED, (err: any, transaction: any) => {
                    if (err) {
                        db?.detach()
                        return reject(err)
                    }
                    return resolve(transaction)
                })
            })

            let success: boolean = await new Promise((resolve, reject) => {

                transaction.query(`UPDATE CHAMADO SET CHAMADO.CODTRF_CHAMADO =? WHERE CHAMADO.COD_CHAMADO =?`,
                    [COD_TAREFA, COD_CHAMADO], async function (err: any, res: any) {
                        if (err) {
                            db?.detach()
                            return reject(err);
                        }
                        return resolve(true)
                    })
            })

            success = await transaction.commit((err: Error) => {
                if (err) {
                    
                    transaction.rollback();
                    db?.detach();
                    return reject(err)
                }
                else {
                   
                    db?.detach();
                    return resolve(false)
                }

            });
            return resolve(success)


        } catch (err) {
            db?.detach();
            console.error(err)
            return reject(err)
        }
    })
}