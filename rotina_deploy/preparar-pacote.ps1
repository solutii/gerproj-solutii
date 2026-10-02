<#
.SYNOPSIS
  Prepara o PACOTE DE DEPLOY do gerproj-solutii. Rode na MAQUINA DE DESENVOLVIMENTO.

.DESCRIPTION
  O que faz, nesta ordem:
    1. (opcional) confere tipos, lint e testes: se algo falhar, NAO gera pacote;
    2. copia o projeto para uma pasta temporaria (SEM node_modules, SEM .env) e gera
       o build de producao la -- assim o seu "pnpm dev" e a sua pasta .next NAO sao
       tocados e nao ha mistura de build de dev com build de producao;
    3. monta a pasta do pacote: .next, package.json, pnpm-lock.yaml,
       pnpm-workspace.yaml, patches, public, next.config.mjs, execGerProj.bat e o
       servidor.ps1 (o script que aplica o pacote no servidor);
    4. confere que o pacote NAO tem .env nem node_modules e grava um manifesto.

  Nada e enviado para o servidor: voce copia a pasta do pacote para la.

.PARAMETER PularVerificacoes
  Nao roda tsc/lint/testes (so o build). Use apenas se acabou de rodar tudo.

.PARAMETER PastaDestino
  Onde criar o pacote. Padrao: pasta "deploy-pacotes" ao lado do projeto.

.EXAMPLE
  .\rotina_deploy\preparar-pacote.ps1
#>
[CmdletBinding()]
param(
    [switch]$PularVerificacoes,
    [string]$PastaDestino = ""
)

$ErrorActionPreference = "Stop"

function Passo([string]$texto) { Write-Host ""; Write-Host "==> $texto" -ForegroundColor Cyan }
function Ok([string]$texto) { Write-Host "    OK  $texto" -ForegroundColor Green }
function Aviso([string]$texto) { Write-Host "    ATENCAO  $texto" -ForegroundColor Yellow }
function Falha([string]$texto) { Write-Host "    ERRO  $texto" -ForegroundColor Red; throw $texto }

function Executar([string]$descricao, [scriptblock]$comando) {
    & $comando
    if ($LASTEXITCODE -ne 0) { Falha "$descricao falhou (codigo $LASTEXITCODE). Nenhum pacote foi gerado." }
    Ok $descricao
}

# robocopy devolve 0 a 7 quando deu certo (8 ou mais = erro)
function Copiar-Pasta([string]$origem, [string]$destino, [string[]]$excluirPastas = @(), [string[]]$excluirArquivos = @()) {
    $opcoes = @($origem, $destino, "/E", "/NFL", "/NDL", "/NJH", "/NJS", "/NP")
    if ($excluirPastas.Count -gt 0) { $opcoes += "/XD"; $opcoes += $excluirPastas }
    if ($excluirArquivos.Count -gt 0) { $opcoes += "/XF"; $opcoes += $excluirArquivos }
    & robocopy @opcoes | Out-Null
    if ($LASTEXITCODE -ge 8) { Falha "Falha ao copiar $origem (robocopy codigo $LASTEXITCODE)." }
    $global:LASTEXITCODE = 0
}

function Hash-Arquivo([string]$caminho) {
    return (Get-FileHash -LiteralPath $caminho -Algorithm SHA256).Hash
}

$raiz = Split-Path -Parent $PSScriptRoot
$carimbo = Get-Date -Format "yyyy-MM-dd_HHmm"
$temp = Join-Path $env:TEMP ("gerproj-build-" + $carimbo)
$junction = Join-Path $temp "node_modules"

try {
    Passo "Conferindo o projeto"
    $pacoteJson = Join-Path $raiz "package.json"
    if (-not (Test-Path $pacoteJson)) { Falha "package.json nao encontrado em $raiz. Rode este script de dentro da pasta rotina_deploy do projeto." }
    $infoPacote = Get-Content -LiteralPath $pacoteJson -Raw | ConvertFrom-Json
    if ($infoPacote.name -ne "gerproj-solutii") { Falha "Este nao parece ser o projeto gerproj-solutii (nome: $($infoPacote.name))." }
    if (-not (Test-Path (Join-Path $raiz "node_modules"))) { Falha "node_modules nao existe aqui. Rode 'pnpm install' na pasta do projeto primeiro." }
    if (-not (Test-Path (Join-Path $raiz "rotina_deploy\servidor.ps1"))) { Falha "rotina_deploy\servidor.ps1 nao encontrado." }
    Ok "projeto gerproj-solutii (Next $($infoPacote.dependencies.next))"

    if ($PastaDestino -eq "") { $PastaDestino = Join-Path (Split-Path -Parent $raiz) "deploy-pacotes" }
    $pacote = Join-Path $PastaDestino ("pacote-" + $carimbo)
    if (Test-Path $pacote) { Falha "A pasta $pacote ja existe. Aguarde 1 minuto e rode de novo." }

    if (-not $PularVerificacoes) {
        Passo "Conferindo tipos, lint e testes (se algo falhar, nada e gerado)"
        Push-Location $raiz
        try {
            Executar "Tipos (tsc)" { & node node_modules\typescript\bin\tsc --noEmit -p tsconfig.json }
            Executar "Lint" { & node node_modules\next\dist\bin\next lint }
            Executar "Testes automatizados" { & node node_modules\vitest\vitest.mjs run }
        }
        finally { Pop-Location }
    }
    else {
        Aviso "Verificacoes PULADAS (-PularVerificacoes). Tenha certeza de que rodou tsc, lint e testes."
    }

    Passo "Gerando o build de producao numa copia temporaria (seu pnpm dev nao e tocado)"
    New-Item -ItemType Directory -Path $temp -Force | Out-Null
    # sem node_modules, sem .env, sem pastas de teste/documentacao/artefatos
    Copiar-Pasta $raiz $temp @("node_modules", ".next", ".git", ".playwright-mcp", "test-results", "playwright-report", "e2e", "docs", "logs", "rotas-removidas", ".vscode", ".claude", "_backups") @(".env", ".env.*", "*.log", "tsconfig.tsbuildinfo")
    # o build usa o node_modules da maquina de desenvolvimento por um atalho (junction)
    & cmd /c mklink /J "$junction" (Join-Path $raiz "node_modules") | Out-Null
    if (-not (Test-Path $junction)) { Falha "Nao foi possivel criar o atalho para o node_modules." }

    Push-Location $temp
    try {
        $env:NEXT_TELEMETRY_DISABLED = "1"
        Executar "Build de producao (next build)" { & node node_modules\next\dist\bin\next build }
    }
    finally { Pop-Location }

    if (-not (Test-Path (Join-Path $temp ".next\BUILD_ID"))) { Falha "O build terminou sem gerar .next\BUILD_ID." }

    Passo "Montando o pacote em $pacote"
    New-Item -ItemType Directory -Path $pacote -Force | Out-Null
    Copiar-Pasta (Join-Path $temp ".next") (Join-Path $pacote ".next") @((Join-Path $temp ".next\cache"))
    foreach ($arquivo in @("package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "next.config.mjs", "execGerProj.bat")) {
        $origemArquivo = Join-Path $raiz $arquivo
        if (Test-Path $origemArquivo) { Copy-Item -LiteralPath $origemArquivo -Destination (Join-Path $pacote $arquivo) -Force }
        else { Aviso "$arquivo nao existe no projeto (ignorado)." }
    }
    Copiar-Pasta (Join-Path $raiz "patches") (Join-Path $pacote "patches")
    if (Test-Path (Join-Path $raiz "public")) { Copiar-Pasta (Join-Path $raiz "public") (Join-Path $pacote "public") }
    Copy-Item -LiteralPath (Join-Path $raiz "rotina_deploy\servidor.ps1") -Destination (Join-Path $pacote "servidor.ps1") -Force
    Ok "arquivos copiados"

    Passo "Conferencias de seguranca do pacote"
    $envNoPacote = @(Get-ChildItem -LiteralPath $pacote -Recurse -Force -File | Where-Object { $_.Name -like ".env*" })
    if ($envNoPacote.Count -gt 0) { Falha "O pacote contem arquivo .env ($($envNoPacote[0].FullName)). Isso nao pode ir para o servidor." }
    if (Test-Path (Join-Path $pacote "node_modules")) { Falha "O pacote contem node_modules. Isso nao pode ir para o servidor." }
    if (-not (Test-Path (Join-Path $pacote ".next\BUILD_ID"))) { Falha "O pacote ficou sem .next\BUILD_ID." }
    Ok "sem .env, sem node_modules, com BUILD_ID"

    Passo "Gravando o manifesto"
    $buildId = (Get-Content -LiteralPath (Join-Path $pacote ".next\BUILD_ID") -Raw).Trim()
    $hashes = @{}
    foreach ($arquivo in @("package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "next.config.mjs")) {
        $c = Join-Path $pacote $arquivo
        if (Test-Path $c) { $hashes[$arquivo] = Hash-Arquivo $c }
    }
    $manifesto = @{
        geradoEm = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
        buildId  = $buildId
        next     = $infoPacote.dependencies.next
        node     = (& node -v)
        sha256   = $hashes
    }
    ($manifesto | ConvertTo-Json -Depth 4) | Set-Content -LiteralPath (Join-Path $pacote "manifesto.json") -Encoding ASCII
    Ok "manifesto.json (BUILD_ID $buildId)"

    $tamanho = [math]::Round(((Get-ChildItem -LiteralPath $pacote -Recurse -File | Measure-Object -Property Length -Sum).Sum) / 1MB, 1)

    Write-Host ""
    Write-Host "=======================================================================" -ForegroundColor Green
    Write-Host " PACOTE PRONTO  ($tamanho MB)" -ForegroundColor Green
    Write-Host " $pacote" -ForegroundColor Green
    Write-Host "=======================================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "PROXIMOS PASSOS (nada foi enviado ao servidor):"
    Write-Host "  1. Copie a pasta do pacote inteira para o servidor (qualquer pasta, ex.: C:\GERPROJ\pacote)."
    Write-Host "  2. No servidor, feche a janela do next-server (a que o .bat abriu)."
    Write-Host "  3. No PowerShell do servidor, dentro da pasta do pacote:"
    Write-Host "         .\servidor.ps1 -Verificar     (so olha, nao muda nada)"
    Write-Host "         .\servidor.ps1 -Aplicar       (backup + instala o que mudou + troca o .next)"
    Write-Host "  4. Abra o execGerProj.bat e confira: login, lista de chamados, um apontamento de teste."
    Write-Host "  Se algo der errado:  .\servidor.ps1 -Reverter"
    Write-Host ""
}
finally {
    # remove o atalho ANTES da pasta temporaria (para nunca apagar o node_modules de verdade)
    if (Test-Path $junction) { & cmd /c rmdir "$junction" | Out-Null }
    if ((Test-Path $temp) -and -not (Test-Path $junction)) { & cmd /c rmdir /s /q "$temp" | Out-Null }
}
