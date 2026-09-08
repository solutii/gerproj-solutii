import { ChamadosType, STATUS_CHAMADO, STATUS_CHAMADO_COD } from "@/models/chamados";
import { Firebird, getConnection } from "../firebird";
import iconv from "iconv-lite"

export default async function UpdateOsService(
    codOs: any,
    description: string,
    date: string,
    startTime: string,
    endTime: string,
    ): Promise<boolean> {


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
            
            let success = await new Promise((resolve, reject) => {
                transaction.query(
                `UPDATE OS  SET DTINI_OS= ?, HRINI_OS= ?, HRFIM_OS= ?, OBS= ? WHERE COD_OS = ?`,
                    [
                        new Date(`${date} 00:00`).toLocaleString('pt-br', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replaceAll('/', '.').replaceAll(',', ''),
                        startTime.replace(":", ""),
                        endTime.replace(":", ""),
                        iconv.encode( description, 'WIN1252'),
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