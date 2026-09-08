import { Firebird, getConnection } from "../../../services/firebird";
import { NextResponse, type NextRequest } from 'next/server'
 
async function handler(request: NextRequest) {  

  try {

    let db: any = null

    db = await new Promise((resolve, reject) => {
        getConnection( (err: any, db: any) => {
            if (err) {
                return reject(err)
            }
            return resolve(db)
        })
    })

    let os = await new Promise<[number, number|string]>((resolve, reject) => {

                db.query(`
                    select * from OS where NUM_OS is null and OS.dtini_os > '01.12.2025 00:00:00'
                    `,
                    [], async function (err: any, res: any) {
                        if (err) {
                            db?.detach()
                            return reject(err);
                        }
                        return resolve(res)
                    })
            })



        /* let [COD_OS, NUM_OS] = await new Promise<[number, number|string]>((resolve, reject) => {

                db.query(`SELECT MAX(COD_OS) + 1 as COD_OS, MAX(NUM_OS) as NUM_OS FROM OS`,
                    [], async function (err: any, res: any) {
                        if (err) {
                            db?.detach()
                            return reject(err);
                        }
                        return resolve([res[0]['COD_OS'], res[0]['NUM_OS']])
                    })
            })  */   
    

    return NextResponse.json(os)
  } catch(error) {


    return NextResponse.json(error)
  }
  
  

  
}

export { handler as POST };