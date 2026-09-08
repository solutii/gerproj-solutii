import StandbyCallService from '@/services/call/standby'
import { NextResponse, type NextRequest } from 'next/server'
import AdmZip  from 'adm-zip'
import fs from 'fs';
import path from 'path';
import { getAnexosBasePath } from '@/services/anexos';

async function handler(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const codChamado = searchParams.get('codChamado')

  try {

    const folderPath = path.resolve(path.join(getAnexosBasePath(), 'CALLTECH', String(codChamado)));

    if (!fs.existsSync(folderPath)) {
        return NextResponse.json({ message: 'Chamado sem anexo!', caminho: folderPath });
    }

    const zip = new AdmZip();

    // Lê todos os arquivos da pasta
    const files = fs.readdirSync(folderPath);

    // Adiciona cada arquivo ao ZIP
    files.forEach((file) => {
        const filePath = path.join(folderPath, file);
        zip.addLocalFile(filePath);
    });
    
     // Gera o buffer do arquivo ZIP
    const zipBuffer = zip.toBuffer();

    // Define os cabeçalhos para download
    const headers = new Headers({
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename=files.zip',
    });

  // Retorna o ZIP como uma resposta NextResponse com os cabeçalhos
  return new NextResponse(zipBuffer, {
    headers,
  });

    
  } catch(error) {


    return NextResponse.json(error)
  }
  
  

  
}

export { handler as GET, handler as POST };