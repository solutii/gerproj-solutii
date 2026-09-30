import { Firebird, options } from "../../../services/firebird";
import { NextResponse, type NextRequest } from 'next/server'
 
async function handler(request: NextRequest) {
  
  const {
    CNPJ,
  } = await request.json();
  

  try {
    const request = await new Promise((resolve, reject) => {
            Firebird.attach(options, async (err: any, db: any) => {
                if (err) return reject(err);

                db.query(
                    `
                    SELECT *
                    FROM SIX
                    
                    WHERE
                    CNPJ=?
                    `,
                    [CNPJ],
                    async (err: any, result: any) => {
                        if (err) {
                            db.detach();
                            return reject(err);
                        }

                        if (!result.length) {
                            db.detach();
                            return resolve([]);
                        }

                        try {

                            db.detach();
                            resolve(result[0]);
                        } catch (e) {
                            db.detach();
                            reject(e);
                        }
                    }
                );
            });
        });

 
    

    return NextResponse.json(request)
  } catch(error) {


    return NextResponse.json(error)
  }
  
  

  
}

export { handler as POST };