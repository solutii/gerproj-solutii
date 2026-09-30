// Caminho base onde ficam os anexos de chamado (ex: CALLTECH/<codChamado>/arquivo.ext).
//
// Em produção, os dois apps (gerproj-solutii e gerproj-dashboard-cliente-local)
// gravam no mesmo caminho de rede (configurado em PARAMETROS.PASTA no banco,
// hoje = C:\GERPROJ\Dropbox\DOC). Em desenvolvimento local, o dashboard usa
// UPLOAD_PATH_DEV (drive mapeado, ex: Z:\Dropbox\DOC) para contornar um bug do
// Node no Windows com caminhos UNC (\\servidor\share\...). Sem essa mesma
// variável aqui, os dois apps ficavam gravando/lendo anexos em pastas
// diferentes durante o teste local -- por isso replicamos a mesma convenção.
export function getAnexosBasePath(): string {
    if (process.env.NODE_ENV !== 'production' && process.env.UPLOAD_PATH_DEV) {
        return process.env.UPLOAD_PATH_DEV;
    }
    return 'C:\\GERPROJ\\Dropbox\\DOC';
}
