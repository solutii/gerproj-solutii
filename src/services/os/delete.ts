import { ChamadosType, STATUS_CHAMADO, STATUS_CHAMADO_COD } from "@/types/chamados";
import { Firebird, getConnection } from "../firebird";
import { validarPosseOs } from "./regras-apontamento";

export default async function DeleteOsService(codOs: any, recurso: number): Promise<boolean> {


    return new Promise(async (resolve, reject) => {

        let db: any = null

        try {

            // A OS precisa ser do consultor logado e estar no período vigente.
            await validarPosseOs(recurso, codOs)

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


            
            let success = await new Promise((resolve, reject) => {
                transaction.query(
                `DELETE FROM OS  WHERE COD_OS = ?`,
                    [
                        codOs
                    ], async function (err: any, result: any) {

                        if (err) {
                            
                            transaction.rollback();
                            db?.detach()
                            return reject(err)
                        }

                        return resolve(true)

                        
                    });
            })



            success = await transaction.commit((err: Error) => {
                if (err) {
                    console.log(err)
                    transaction.rollback();
                    return reject(err)
                }
                else {
                    db?.detach();
                    return resolve(true)
                }

            });

            db?.detach()
            resolve(true)


        } catch (err) {
            console.log(err)
            db?.detach();
            return reject(err)
        }
    })
}