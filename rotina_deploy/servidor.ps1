<#
.SYNOPSIS
  Aplica (ou reverte) um pacote de deploy do gerproj-solutii. Rode NO SERVIDOR,
  de dentro da pasta do pacote gerado por preparar-pacote.ps1.

.DESCRIPTION
  Tres modos (escolha UM):

    -Verificar   So olha e relata (BUILD_ID atual, versao do Node, porta, patch do
                 node-firebird, backups e a SITUACAO DE CADA VARIAVEL do .env:
                 ativa / so comentada / ausente / duplicada, sem mostrar valores).
                 NAO muda nada.

    -Aplicar     1. confere o pacote e o servidor (.env com as chaves necessarias e
                    apontando para o banco de PRODUCAO, Node, porta livre);
                 2. faz BACKUP do que esta no ar (.next, package.json, lock, ...);
                 3. se package.json / pnpm-lock.yaml / pnpm-workspace.yaml / patches
                    mudaram: copia e roda "pnpm install --frozen-lockfile --prod" e
                    confere o patch dos acentos do node-firebird;
                 4. troca a pasta .next e copia public, next.config.mjs e o .bat;
                 5. se qualquer passo falhar, DESFAZ sozinho (volta ao backup).
                 NAO inicia o sistema (a menos que use -Iniciar).

    -Reverter    Volta ao ultimo backup (ou ao que voce indicar em -Backup),
                 reinstalando as dependencias se elas eram diferentes.

  Regras que o script garante: nunca copia node_modules, nunca toca no .env do
  servidor (so le os NOMES das chaves, nunca mostra valores), nunca usa
  --no-frozen-lockfile e recusa rodar com o sistema no ar.

.PARAMETER AppDir
  Pasta da aplicacao no servidor. Padrao: C:\GERPROJ\web-app-2

.PARAMETER Backup
  (so com -Reverter) nome da pasta de backup em _backups. Padrao: o mais recente.

.PARAMETER Porta
  Porta do sistema. Padrao: 3000

.PARAMETER Iniciar
  (so com -Aplicar/-Reverter) abre o execGerProj.bat no fim.

.PARAMETER Forcar
  Aceita avisos que normalmente interrompem (ex.: .env apontando para localhost).

.PARAMETER NaoInstalar
  Nao roda o pnpm install (use so em teste ou se voce mesmo vai instalar).

.EXAMPLE
  .\servidor.ps1 -Verificar
  .\servidor.ps1 -Aplicar
  .\servidor.ps1 -Reverter
#>
[CmdletBinding()]
param(
    [switch]$Aplicar,
    [switch]$Reverter,
    [switch]$Verificar,
    [string]$AppDir = "C:\GERPROJ\web-app-2",
    [string]$Backup = "",
    [int]$Porta = 3000,
    [switch]$Iniciar,
    [switch]$Forcar,
    [switch]$NaoInstalar
)

$ErrorActionPreference = "Stop"

# ---------------------------------------------------------------- mensagens
function Passo([string]$texto) { Write-Host ""; Write-Host "==> $texto" -ForegroundColor Cyan }
function Ok([string]$texto) { Write-Host "    OK  $texto" -ForegroundColor Green }
function Aviso([string]$texto) { Write-Host "    ATENCAO  $texto" -ForegroundColor Yellow }
function Info([string]$texto) { Write-Host "    $texto" }
function Falha([string]$texto) { Write-Host "    ERRO  $texto" -ForegroundColor Red; throw $texto }

$ChavesObrigatorias = @("NEXTAUTH_URL", "NEXTAUTH_SECRET", "FIREBIRD_HOST", "FIREBIRD_DATABASE", "FIREBIRD_USER", "FIREBIRD_PASSWORD")
$ChavesOpcionais = @("FIREBIRD_PORT")
$ArquivosDoApp = @("package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "next.config.mjs", "execGerProj.bat")

# ---------------------------------------------------------------- utilidades
function Porta-EmUso([int]$numero) {
    $cliente = New-Object System.Net.Sockets.TcpClient
    try {
        $tentativa = $cliente.BeginConnect("127.0.0.1", $numero, $null, $null)
        $respondeu = $tentativa.AsyncWaitHandle.WaitOne(700, $false)
        return ($respondeu -and $cliente.Connected)
    }
    catch { return $false }
    finally { $cliente.Close() }
}

# robocopy: 0 a 7 = sucesso; 8 ou mais = erro
function Copiar-Pasta([string]$origem, [string]$destino, [string[]]$excluirPastas = @()) {
    $opcoes = @($origem, $destino, "/E", "/NFL", "/NDL", "/NJH", "/NJS", "/NP")
    if ($excluirPastas.Count -gt 0) { $opcoes += "/XD"; $opcoes += $excluirPastas }
    & robocopy @opcoes | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "Falha ao copiar $origem (robocopy codigo $LASTEXITCODE)." }
    $global:LASTEXITCODE = 0
}

function Remover-Pasta([string]$caminho) {
    if (Test-Path -LiteralPath $caminho) {
        & cmd /c rmdir /s /q "$caminho" | Out-Null
        if (Test-Path -LiteralPath $caminho) { throw "Nao foi possivel apagar $caminho (algum arquivo em uso? feche o sistema)." }
    }
}

# Analisa o .env LINHA A LINHA so para relatar o ESTADO de cada chave -- os
# valores NUNCA sao mostrados. Para cada chave devolve:
#   Ativas     numeros das linhas em que ela esta ativa (CHAVE=valor)
#   Comentadas numeros das linhas em que so existe comentada (# CHAVE=valor)
#   Valores    valores das linhas ativas (uso interno: comparar e classificar)
function Analisar-Env([string]$caminho, [string[]]$chaves) {
    $resultado = @{}
    foreach ($chave in $chaves) { $resultado[$chave] = @{ Ativas = @(); Comentadas = @(); Valores = @() } }

    $linhas = [System.IO.File]::ReadAllLines($caminho)
    for ($i = 0; $i -lt $linhas.Count; $i++) {
        $numero = $i + 1
        foreach ($chave in $chaves) {
            $padrao = [regex]::Escape($chave)
            if ($linhas[$i] -match ('^\s*' + $padrao + '\s*=\s*(.*)$')) {
                $resultado[$chave].Ativas += $numero
                $resultado[$chave].Valores += $Matches[1].Trim().Trim('"')
            }
            elseif ($linhas[$i] -match ('^\s*#+\s*' + $padrao + '\s*=')) {
                $resultado[$chave].Comentadas += $numero
            }
        }
    }
    return $resultado
}

function Hash-Dependencias([string]$pasta) {
    $partes = @()
    foreach ($nome in @("package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml")) {
        $c = Join-Path $pasta $nome
        if (Test-Path -LiteralPath $c) { $partes += ($nome + ":" + (Get-FileHash -LiteralPath $c -Algorithm SHA256).Hash) }
        else { $partes += ($nome + ":ausente") }
    }
    $pastaPatches = Join-Path $pasta "patches"
    if (Test-Path -LiteralPath $pastaPatches) {
        foreach ($f in @(Get-ChildItem -LiteralPath $pastaPatches -File -Recurse | Sort-Object FullName)) {
            $partes += ("patch/" + $f.Name + ":" + (Get-FileHash -LiteralPath $f.FullName -Algorithm SHA256).Hash)
        }
    }
    $sha = [System.Security.Cryptography.SHA256]::Create()
    $bytes = $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes(($partes -join "|")))
    return ([System.BitConverter]::ToString($bytes) -replace "-", "")
}

# Quantas linhas do patch dos acentos existem no node-firebird instalado (deve ser 2)
function Contar-Patch([string]$pastaApp) {
    $base = Join-Path $pastaApp "node_modules\.pnpm"
    if (-not (Test-Path -LiteralPath $base)) { return -1 }
    $total = 0
    foreach ($d in @(Get-ChildItem -LiteralPath $base -Directory -Filter "node-firebird*")) {
        $arquivo = Join-Path $d.FullName "node_modules\node-firebird\lib\wire\serialize.js"
        if (Test-Path -LiteralPath $arquivo) {
            $total += @(Select-String -LiteralPath $arquivo -Pattern "PATCH \(gerproj-solutii").Count
        }
    }
    return $total
}

function Versao-Node {
    $comando = Get-Command node -ErrorAction SilentlyContinue
    if (-not $comando) { return $null }
    return ((& node -v) | Out-String).Trim()
}

function Node-Suficiente([string]$versao) {
    if ($versao -notmatch '^v(\d+)\.(\d+)') { return $false }
    $maior = [int]$Matches[1]
    $menor = [int]$Matches[2]
    return ($maior -gt 18) -or ($maior -eq 18 -and $menor -ge 18)
}

function Instalar-Dependencias([string]$pastaApp) {
    if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) { throw "pnpm nao encontrado no PATH. Instale com: npm install -g pnpm" }
    Push-Location $pastaApp
    try {
        & pnpm install --frozen-lockfile --prod
        if ($LASTEXITCODE -ne 0) { throw "pnpm install falhou (codigo $LASTEXITCODE)." }
    }
    finally { Pop-Location }
    $patch = Contar-Patch $pastaApp
    if ($patch -ne 2) { throw "O patch dos acentos do node-firebird NAO foi aplicado (encontrei $patch linha(s), esperado 2). Instale sempre com pnpm." }
}

function Texto-Linhas([int[]]$numeros) {
    if ($numeros.Count -eq 1) { return ("linha " + $numeros[0]) }
    return ("linhas " + ($numeros -join ", "))
}

function Banco-Local([string]$endereco) {
    return ($endereco -match '^(localhost|127\.0\.0\.1|::1)$')
}

# Relatorio por variavel (ativa / so comentada / ausente / duplicada), SEM mostrar valores.
# No modo rigido (-Aplicar) qualquer problema interrompe; no -Verificar so avisa.
function Conferir-Env([string]$pastaApp, [bool]$rigido) {
    $caminho = Join-Path $pastaApp ".env"
    if (-not (Test-Path -LiteralPath $caminho)) {
        if ($rigido) { Falha ".env nao encontrado em $pastaApp. O servidor precisa do proprio .env (nunca copie o da maquina de desenvolvimento)." }
        Aviso ".env nao encontrado em $pastaApp"
        return
    }

    $analise = Analisar-Env $caminho ($ChavesObrigatorias + $ChavesOpcionais)
    $problemas = @()
    $avisos = @()

    Info "Situacao das variaveis no .env (os valores NAO sao mostrados):"
    foreach ($chave in $ChavesObrigatorias) {
        $a = $analise[$chave]
        $nome = $chave.PadRight(18)

        if ($a.Ativas.Count -eq 0) {
            if ($a.Comentadas.Count -gt 0) {
                $estado = "SO COMENTADA (" + (Texto-Linhas $a.Comentadas) + "): NAO esta valendo"
                $problemas += "$chave esta so comentada"
            }
            else {
                $estado = "AUSENTE"
                $problemas += "$chave esta ausente"
            }
            Write-Host ("      " + $nome + " " + $estado) -ForegroundColor Red
            continue
        }

        $texto = "ativa (" + (Texto-Linhas $a.Ativas) + ")"
        $cor = "Green"

        if (@($a.Valores | Where-Object { $_ -ne "" }).Count -eq 0) {
            $texto += " | VAZIA"
            $problemas += "$chave esta ativa mas vazia"
            $cor = "Red"
        }
        if ($a.Ativas.Count -gt 1) {
            $distintos = @($a.Valores | Select-Object -Unique).Count
            if ($distintos -gt 1) {
                $texto += " | DEFINIDA " + $a.Ativas.Count + " VEZES COM VALORES DIFERENTES"
                $problemas += "$chave esta ativa em mais de um lugar com valores diferentes (deixe so uma)"
                $cor = "Red"
            }
            else {
                $texto += " | definida " + $a.Ativas.Count + " vezes (mesmo valor)"
                $avisos += "$chave aparece ativa mais de uma vez; deixe so uma"
                if ($cor -eq "Green") { $cor = "Yellow" }
            }
        }
        if ($a.Comentadas.Count -gt 0) { $texto += " | tambem existe comentada (" + (Texto-Linhas $a.Comentadas) + ")" }

        if ($chave -eq "FIREBIRD_HOST") {
            $local = @($a.Valores | Where-Object { Banco-Local $_ }).Count -gt 0
            if ($local) {
                $texto += " | banco: LOCAL (esta propria maquina)"
                $cor = "Red"
                $msg = "FIREBIRD_HOST aponta para o banco LOCAL: provavel .env de desenvolvimento copiado por engano. O .env do servidor deve apontar para o banco de PRODUCAO."
                if ($rigido -and -not $Forcar) { $problemas += "$msg Use -Forcar so se for isso mesmo que voce quer." } else { $avisos += $msg }
            }
            else { $texto += " | banco: remoto" }
        }
        if ($chave -eq "NEXTAUTH_URL" -and @($a.Valores | Where-Object { $_ -match 'localhost|127\.0\.0\.1' }).Count -gt 0) {
            $texto += " | aponta para localhost"
            if ($cor -eq "Green") { $cor = "Yellow" }
            $avisos += "NEXTAUTH_URL aponta para localhost: depois do login o navegador iria para localhost. Ajuste no .env do servidor."
        }

        Write-Host ("      " + $nome + " " + $texto) -ForegroundColor $cor
    }

    # opcionais: so informam
    foreach ($chave in $ChavesOpcionais) {
        $a = $analise[$chave]
        if ($a.Ativas.Count -gt 0) { $estado = "ativa (" + (Texto-Linhas $a.Ativas) + ")" }
        elseif ($a.Comentadas.Count -gt 0) { $estado = "so comentada (" + (Texto-Linhas $a.Comentadas) + "): vale o padrao do sistema" }
        else { $estado = "ausente: vale o padrao do sistema" }
        Write-Host ("      " + $chave.PadRight(18) + " (opcional) " + $estado) -ForegroundColor DarkGray
    }

    foreach ($a in $avisos) { Aviso $a }
    if ($problemas.Count -gt 0) {
        $lista = $problemas -join " | "
        if ($rigido) { Falha ".env do servidor com problema: $lista" }
        else { Aviso ".env do servidor com problema: $lista" }
    }
    else { Ok ".env com todas as variaveis necessarias ativas" }
}

function Fazer-Backup([string]$pastaApp) {
    $raizBackups = Join-Path $pastaApp "_backups"
    $pasta = Join-Path $raizBackups (Get-Date -Format "yyyy-MM-dd_HHmmss")
    New-Item -ItemType Directory -Path $pasta -Force | Out-Null

    $next = Join-Path $pastaApp ".next"
    if (Test-Path -LiteralPath $next) { Copiar-Pasta $next (Join-Path $pasta ".next") @((Join-Path $next "cache")) }
    foreach ($arquivo in $ArquivosDoApp) {
        $origemArquivo = Join-Path $pastaApp $arquivo
        if (Test-Path -LiteralPath $origemArquivo) { Copy-Item -LiteralPath $origemArquivo -Destination (Join-Path $pasta $arquivo) -Force }
    }
    $patches = Join-Path $pastaApp "patches"
    if (Test-Path -LiteralPath $patches) { Copiar-Pasta $patches (Join-Path $pasta "patches") }

    # guarda so os 3 backups mais recentes
    $todos = @(Get-ChildItem -LiteralPath $raizBackups -Directory | Sort-Object Name -Descending)
    if ($todos.Count -gt 3) {
        foreach ($velho in $todos[3..($todos.Count - 1)]) { Remover-Pasta $velho.FullName }
    }
    return $pasta
}

# Volta o app para o estado guardado numa pasta de backup
function Restaurar-Backup([string]$pastaBackup, [string]$pastaApp) {
    $next = Join-Path $pastaApp ".next"
    Remover-Pasta $next
    if (Test-Path -LiteralPath (Join-Path $pastaBackup ".next")) { Copiar-Pasta (Join-Path $pastaBackup ".next") $next }
    foreach ($arquivo in $ArquivosDoApp) {
        $doBackup = Join-Path $pastaBackup $arquivo
        if (Test-Path -LiteralPath $doBackup) { Copy-Item -LiteralPath $doBackup -Destination (Join-Path $pastaApp $arquivo) -Force }
    }
    if (Test-Path -LiteralPath (Join-Path $pastaBackup "patches")) { Copiar-Pasta (Join-Path $pastaBackup "patches") (Join-Path $pastaApp "patches") }
}

function Garantir-SistemaParado {
    if (Porta-EmUso $Porta) {
        Falha "O sistema esta no ar na porta $Porta. Feche a janela do next-server (a que o execGerProj.bat abriu) e rode de novo."
    }
    Ok "porta $Porta livre (sistema parado)"
}

function Garantir-AppDir {
    if (-not (Test-Path -LiteralPath $AppDir)) { Falha "Pasta da aplicacao nao encontrada: $AppDir (use -AppDir para indicar outra)." }
    Ok "aplicacao em $AppDir"
}

function Mostrar-Fim([string]$titulo) {
    Write-Host ""
    Write-Host "=======================================================================" -ForegroundColor Green
    Write-Host " $titulo" -ForegroundColor Green
    Write-Host "=======================================================================" -ForegroundColor Green
}

function Registrar([string]$linha) {
    $registro = Join-Path $AppDir "_deploy.log"
    Add-Content -LiteralPath $registro -Value ((Get-Date -Format "yyyy-MM-dd HH:mm:ss") + "  " + $linha)
}

function Iniciar-Sistema {
    $bat = Join-Path $AppDir "execGerProj.bat"
    if (-not (Test-Path -LiteralPath $bat)) { Aviso "execGerProj.bat nao encontrado em $AppDir"; return }
    Start-Process -FilePath $bat -WorkingDirectory $AppDir
    Ok "execGerProj.bat aberto: aguarde a linha 'Ready' e 'Local: http://localhost:$Porta'"
}

# ================================================================ VERIFICAR
function Modo-Verificar {
    Passo "Verificando (nada sera alterado)"
    Garantir-AppDir

    $buildAtual = Join-Path $AppDir ".next\BUILD_ID"
    if (Test-Path -LiteralPath $buildAtual) { Info ("BUILD_ID no ar: " + (Get-Content -LiteralPath $buildAtual -Raw).Trim()) } else { Aviso "Nao ha .next\BUILD_ID no servidor (build nao instalado?)." }

    $manifesto = Join-Path $PSScriptRoot "manifesto.json"
    if (Test-Path -LiteralPath $manifesto) {
        $m = Get-Content -LiteralPath $manifesto -Raw | ConvertFrom-Json
        Info ("Pacote: BUILD_ID " + $m.buildId + " | Next " + $m.next + " | gerado em " + $m.geradoEm)
        if (Test-Path -LiteralPath (Join-Path $PSScriptRoot "package.json")) {
            if ((Hash-Dependencias $PSScriptRoot) -ne (Hash-Dependencias $AppDir)) { Aviso "As DEPENDENCIAS do pacote sao diferentes das do servidor: -Aplicar vai rodar pnpm install." }
            else { Ok "dependencias iguais as do servidor: -Aplicar nao precisa instalar nada" }
        }
    }

    $versao = Versao-Node
    if ($null -eq $versao) { Aviso "node nao encontrado no PATH" }
    elseif (Node-Suficiente $versao) { Ok "Node $versao (o Next 15 exige 18.18 ou mais)" }
    else { Aviso "Node $versao e antigo: o Next 15 exige 18.18 ou mais." }

    if (Get-Command pnpm -ErrorAction SilentlyContinue) { Ok "pnpm encontrado" } else { Aviso "pnpm nao encontrado no PATH (npm install -g pnpm)" }

    Conferir-Env $AppDir $false

    $patch = Contar-Patch $AppDir
    if ($patch -eq 2) { Ok "patch dos acentos do node-firebird aplicado" }
    elseif ($patch -eq -1) { Aviso "node_modules nao encontrado: ainda nao foi feito o pnpm install" }
    else { Aviso "patch dos acentos do node-firebird com $patch linha(s) (esperado 2): acentos podem corromper" }

    if (Porta-EmUso $Porta) { Info "Porta ${Porta}: EM USO (sistema no ar). Para aplicar/reverter, feche-o antes." } else { Info "Porta ${Porta}: livre (sistema parado)." }

    $raizBackups = Join-Path $AppDir "_backups"
    if (Test-Path -LiteralPath $raizBackups) {
        $lista = @(Get-ChildItem -LiteralPath $raizBackups -Directory | Sort-Object Name -Descending)
        Info ("Backups disponiveis (" + $lista.Count + "): " + (($lista | ForEach-Object { $_.Name }) -join ", "))
    }
    else { Info "Ainda nao ha backups." }
}

# ================================================================ APLICAR
function Modo-Aplicar {
    $pacote = $PSScriptRoot

    Passo "Conferindo o pacote"
    if (-not (Test-Path -LiteralPath (Join-Path $pacote ".next\BUILD_ID"))) { Falha "Este pacote nao tem .next\BUILD_ID. Gere de novo com preparar-pacote.ps1." }
    if (-not (Test-Path -LiteralPath (Join-Path $pacote "package.json"))) { Falha "Este pacote nao tem package.json." }
    if (Test-Path -LiteralPath (Join-Path $pacote "node_modules")) { Falha "O pacote contem node_modules: isso quebra o servidor (nunca copie node_modules)." }
    $novoBuild = (Get-Content -LiteralPath (Join-Path $pacote ".next\BUILD_ID") -Raw).Trim()
    Ok "pacote com BUILD_ID $novoBuild"

    Passo "Conferindo o servidor"
    Garantir-AppDir
    if (($pacote.TrimEnd('\') -eq $AppDir.TrimEnd('\'))) { Falha "O pacote nao pode estar dentro da propria pasta da aplicacao ($AppDir). Coloque o pacote em outra pasta." }
    Conferir-Env $AppDir $true
    $versao = Versao-Node
    if ($null -eq $versao) { Falha "node nao encontrado no PATH." }
    if (-not (Node-Suficiente $versao)) { Falha "Node $versao e antigo: o Next 15 exige 18.18 ou mais." }
    Ok "Node $versao"
    Garantir-SistemaParado

    $mudouDependencias = ((Hash-Dependencias $pacote) -ne (Hash-Dependencias $AppDir))
    if ($mudouDependencias) {
        Info "Dependencias MUDARAM (package.json / lock / workspace / patches): sera feito o pnpm install."
        if (-not $NaoInstalar -and -not (Get-Command pnpm -ErrorAction SilentlyContinue)) { Falha "pnpm nao encontrado no PATH (npm install -g pnpm)." }
    }
    else { Info "Dependencias iguais as do servidor: nao precisa instalar nada." }

    Passo "Backup do que esta no ar"
    $pastaBackup = Fazer-Backup $AppDir
    Ok "backup em $pastaBackup"
    Registrar ("APLICAR iniciado | pacote BUILD_ID $novoBuild | backup " + (Split-Path -Leaf $pastaBackup))

    try {
        if ($mudouDependencias) {
            Passo "Atualizando as dependencias"
            foreach ($arquivo in @("package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml")) {
                $doPacote = Join-Path $pacote $arquivo
                if (Test-Path -LiteralPath $doPacote) { Copy-Item -LiteralPath $doPacote -Destination (Join-Path $AppDir $arquivo) -Force }
            }
            if (Test-Path -LiteralPath (Join-Path $pacote "patches")) { Copiar-Pasta (Join-Path $pacote "patches") (Join-Path $AppDir "patches") }
            if ($NaoInstalar) { Aviso "-NaoInstalar: pnpm install NAO foi executado." }
            else { Instalar-Dependencias $AppDir; Ok "pnpm install concluido e patch dos acentos conferido" }
        }

        Passo "Trocando a pasta .next"
        Remover-Pasta (Join-Path $AppDir ".next")
        Copiar-Pasta (Join-Path $pacote ".next") (Join-Path $AppDir ".next")
        $conferido = (Get-Content -LiteralPath (Join-Path $AppDir ".next\BUILD_ID") -Raw).Trim()
        if ($conferido -ne $novoBuild) { throw "O BUILD_ID do servidor ($conferido) nao e o do pacote ($novoBuild)." }
        Ok ".next novo instalado (BUILD_ID $conferido)"

        Passo "Copiando arquivos de apoio"
        if (Test-Path -LiteralPath (Join-Path $pacote "public")) { Copiar-Pasta (Join-Path $pacote "public") (Join-Path $AppDir "public"); Ok "public" }
        foreach ($arquivo in @("next.config.mjs", "execGerProj.bat")) {
            $doPacote = Join-Path $pacote $arquivo
            if (Test-Path -LiteralPath $doPacote) { Copy-Item -LiteralPath $doPacote -Destination (Join-Path $AppDir $arquivo) -Force; Ok $arquivo }
        }
    }
    catch {
        $erro = $_.Exception.Message
        Write-Host ""
        Write-Host "    ERRO durante a aplicacao: $erro" -ForegroundColor Red
        Write-Host "    Desfazendo: voltando ao backup $pastaBackup ..." -ForegroundColor Yellow
        try {
            $depsAgora = Hash-Dependencias $AppDir
            Restaurar-Backup $pastaBackup $AppDir
            if ((Hash-Dependencias $AppDir) -ne $depsAgora -and -not $NaoInstalar) {
                Write-Host "    Dependencias voltaram ao que eram: reinstalando..." -ForegroundColor Yellow
                Instalar-Dependencias $AppDir
            }
            Registrar "APLICAR FALHOU ($erro): backup restaurado"
            Write-Host "    Tudo voltou ao que estava no ar antes. Nada foi perdido." -ForegroundColor Green
        }
        catch {
            Registrar ("APLICAR FALHOU e a restauracao tambem: " + $_.Exception.Message)
            Write-Host "    A restauracao automatica FALHOU: $($_.Exception.Message)" -ForegroundColor Red
            Write-Host "    Restaure a mao a partir de: $pastaBackup" -ForegroundColor Red
        }
        throw $erro
    }

    Registrar ("APLICAR concluido | BUILD_ID $novoBuild")
    Mostrar-Fim "PACOTE APLICADO (BUILD_ID $novoBuild)"
    Write-Host ""
    Write-Host "O sistema NAO foi iniciado. Agora:"
    Write-Host "  1. Abra o execGerProj.bat (ou, na proxima vez, use -Aplicar -Iniciar para ele abrir sozinho)."
    Write-Host "     Deve aparecer 'Next.js 15...', 'Ready' e 'Local: http://localhost:$Porta'."
    Write-Host "  2. Abra o sistema, faca login e confira: lista de chamados, um apontamento de teste"
    Write-Host "     e o download de um anexo."
    Write-Host "  3. Se algo estiver errado:  .\servidor.ps1 -Reverter   (feche o sistema antes)"
    Write-Host ""
    if ($Iniciar) { Iniciar-Sistema }
}

# ================================================================ REVERTER
function Modo-Reverter {
    Passo "Escolhendo o backup"
    Garantir-AppDir
    $raizBackups = Join-Path $AppDir "_backups"
    if (-not (Test-Path -LiteralPath $raizBackups)) { Falha "Nao ha backups em $raizBackups." }
    $lista = @(Get-ChildItem -LiteralPath $raizBackups -Directory | Sort-Object Name -Descending)
    if ($lista.Count -eq 0) { Falha "Nao ha backups em $raizBackups." }

    if ($Backup -ne "") {
        $escolhido = $lista | Where-Object { $_.Name -eq $Backup } | Select-Object -First 1
        if ($null -eq $escolhido) { Falha ("Backup '" + $Backup + "' nao existe. Disponiveis: " + (($lista | ForEach-Object { $_.Name }) -join ", ")) }
    }
    else { $escolhido = $lista[0] }
    Ok "usando o backup $($escolhido.Name)"

    if (-not (Test-Path -LiteralPath (Join-Path $escolhido.FullName ".next\BUILD_ID"))) { Falha "O backup $($escolhido.Name) nao tem .next\BUILD_ID (esta incompleto)." }
    Garantir-SistemaParado

    Passo "Restaurando"
    $depsAntes = Hash-Dependencias $AppDir
    Restaurar-Backup $escolhido.FullName $AppDir
    if ((Hash-Dependencias $AppDir) -ne $depsAntes) {
        Info "As dependencias do backup sao diferentes das atuais."
        if ($NaoInstalar) { Aviso "-NaoInstalar: pnpm install NAO foi executado." }
        else { Instalar-Dependencias $AppDir; Ok "dependencias reinstaladas e patch conferido" }
    }
    $build = (Get-Content -LiteralPath (Join-Path $AppDir ".next\BUILD_ID") -Raw).Trim()
    Registrar ("REVERTER concluido | backup " + $escolhido.Name + " | BUILD_ID $build")
    Mostrar-Fim "REVERTIDO para o backup $($escolhido.Name) (BUILD_ID $build)"
    Write-Host ""
    Write-Host "O sistema NAO foi iniciado: abra o execGerProj.bat e confira o login."
    Write-Host ""
    if ($Iniciar) { Iniciar-Sistema }
}

# ================================================================ principal
$modos = @($Aplicar.IsPresent, $Reverter.IsPresent, $Verificar.IsPresent) | Where-Object { $_ }
if (@($modos).Count -ne 1) {
    Write-Host ""
    Write-Host "Use UM destes modos:" -ForegroundColor Yellow
    Write-Host "  .\servidor.ps1 -Verificar   (so olha, nao muda nada)"
    Write-Host "  .\servidor.ps1 -Aplicar     (backup + instala o que mudou + troca o .next)"
    Write-Host "  .\servidor.ps1 -Reverter    (volta ao ultimo backup)"
    Write-Host ""
    Write-Host "Opcoes: -AppDir <pasta> -Porta <n> -Backup <nome> -Iniciar -Forcar -NaoInstalar"
    Write-Host "Ajuda completa: Get-Help .\servidor.ps1 -Full"
    Write-Host ""
    exit 2
}

try {
    if ($Verificar) { Modo-Verificar }
    elseif ($Aplicar) { Modo-Aplicar }
    else { Modo-Reverter }
    exit 0
}
catch {
    Write-Host ""
    Write-Host "FALHOU: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
