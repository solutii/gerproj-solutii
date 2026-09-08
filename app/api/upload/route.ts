import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import mime from 'mime';
import { getAnexosBasePath } from '@/services/anexos';

export const runtime = 'nodejs'; // allow fs usage in Next.js route

function sanitizeName(name: string) {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
}

export async function POST(request: Request) {
  try {
    if (request.method !== 'POST') {
      return NextResponse.json({ message: 'Método não permitido. Use POST.' }, { status: 405 });
    }

    const url = new URL(request.url);
    const codChamado = url.searchParams.get('codChamado');
    if (!codChamado) {
      return NextResponse.json({ message: 'O parâmetro codChamado é obrigatório.' }, { status: 400 });
    }

    const safeCod = sanitizeName(codChamado);
    const folderPath = path.resolve(path.join(getAnexosBasePath(), 'CALLTECH', safeCod));

    await fs.promises.mkdir(folderPath, { recursive: true });

    const contentType = request.headers.get('content-type') || '';
    let fileName = `uploaded_file`;
    let buffer: Uint8Array;

    if (contentType.includes('multipart/form-data')) {
      // Handle multipart form uploads (field can be named 'file' or any file field)
      const form = await request.formData();
      let file: File | null = null;

      form.forEach((value) => {
        if (value instanceof File) {
          file = value;
        }
      });

      if (!file) {
        return NextResponse.json({ message: 'Nenhum arquivo encontrado no form-data.' }, { status: 400 });
      }

      // In Node runtime the DOM File type may not be fully available to TypeScript here,
      // so assert to any to access name and arrayBuffer safely.
      const f: any = file;
      fileName = (f.name as string) || fileName;
      buffer = new Uint8Array(await f.arrayBuffer());
    } else {
      // Raw body (fetch with file in body and proper content-type)
      const ext = contentType ? mime.getExtension(contentType) || 'bin' : 'bin';
      fileName = `${fileName}.${ext}`;
      const ab = await request.arrayBuffer();
      buffer = new Uint8Array(ab);
    }

    // sanitize filename and ensure unique
    const safeFileName = sanitizeName(path.basename(fileName));
    const filePath = path.join(folderPath, safeFileName);

    await fs.promises.writeFile(filePath, buffer);

    return NextResponse.json({ message: 'Upload realizado com sucesso!', caminho: filePath });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ message: 'Erro ao realizar upload.', error: errorMessage }, { status: 500 });
  }
}
