import { Firebird, getConnection } from "../../../services/firebird";
import { NextResponse, type NextRequest } from 'next/server'
import iconv from 'iconv-lite';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const items = Array.isArray(body) ? body : body?.items ?? body?.data ?? [];
    if (!Array.isArray(items)) {
      return NextResponse.json({ error: "Expected an array of records" }, { status: 400 });
    }
    if (items.length === 0) {
      return NextResponse.json({ inserted: 0 });
    }

    // normalize keys (accept either upper/lower/mixed)
    const normalizedItems = items.map((it: any) => ({
      COD_RECURSO: it.COD_RECURSO ?? it.COD_RECURSO ?? it.codRecurso,
      COD_AREA: it.COD_AREA ?? it.COD_AREA ?? it.codArea,
      OBS_RECAREA: iconv.encode( it.OBS_RECAREA, 'WIN1252')
    }));

    const codRecurso = normalizedItems[0].COD_RECURSO;
    if (codRecurso == null) {
      return NextResponse.json({ error: "COD_RECURSO is required on items" }, { status: 400 });
    }
    // ensure all items belong to same resource
    if (normalizedItems.some((i: any) => i.COD_RECURSO !== codRecurso)) {
      return NextResponse.json({ error: "All items must have the same COD_RECURSO" }, { status: 400 });
    }

    const result = await new Promise((resolve, reject) => {
      getConnection( (attachErr: any, db: any) => {
        if (attachErr) return reject(attachErr);

        const deleteSql = `DELETE FROM RECAREA WHERE COD_RECURSO = ?`;
        db.query(deleteSql, [codRecurso], (delErr: any) => {
          if (delErr) {
            db?.detach();
            return reject(delErr);
          }

          if (normalizedItems.length === 0) {
            db?.detach();
            return resolve({ inserted: 0 });
          }

          const insertSql = `INSERT INTO RECAREA (COD_RECURSO, COD_AREA, OBS_RECAREA) VALUES (?, ?, ?)`;
          let i = 0;
          const runNext = () => {
            const row = normalizedItems[i];
            db.query(insertSql, [row.COD_RECURSO, row.COD_AREA, row.OBS_RECAREA], (insErr: any) => {
              if (insErr) {
                db?.detach();
                return reject(insErr);
              }
              i++;
              if (i >= normalizedItems.length) {
                db?.detach();
                return resolve({ inserted: normalizedItems.length });
              }
              runNext();
            });
          };
          runNext();
        });
      });
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}