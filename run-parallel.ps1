# run-parallel.ps1
# Script para executar auditorias de cenários em paralelo
# Execute: .\run-parallel.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Auditoria GA4 - Sicredi.com.br" -ForegroundColor Cyan  
Write-Host "  Execução Paralela por Cenário" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Lista de cenários disponíveis
$cenarios = @(
    "home",
    "seja-associado",
    "cartoes",
    "consorcio",
    "investimentos",
    "seguros",
    "credito",
    "pix",
    "maquina-cartoes",
    "previdencia",
    "outros"
)

# Número máximo de processos paralelos (ajuste conforme sua máquina)
$maxParallel = 3

Write-Host "Cenários disponíveis:" -ForegroundColor Yellow
$cenarios | ForEach-Object { Write-Host "  - $_" }
Write-Host ""

# Pergunta quais cenários executar
Write-Host "Opções:" -ForegroundColor Green
Write-Host "  1. Executar TODOS os cenários em paralelo"
Write-Host "  2. Executar cenários específicos"
Write-Host "  3. Executar um cenário único"
Write-Host ""

$opcao = Read-Host "Escolha uma opção (1/2/3)"

$cenariosParaExecutar = @()

switch ($opcao) {
    "1" {
        $cenariosParaExecutar = $cenarios
    }
    "2" {
        Write-Host "Digite os nomes dos cenários separados por vírgula:" -ForegroundColor Yellow
        Write-Host "(Ex: home,cartoes,pix)"
        $input = Read-Host
        $cenariosParaExecutar = $input -split "," | ForEach-Object { $_.Trim() }
    }
    "3" {
        Write-Host "Digite o nome do cenário:" -ForegroundColor Yellow
        $input = Read-Host
        $cenariosParaExecutar = @($input.Trim())
    }
    default {
        Write-Host "Opção inválida. Executando todos os cenários." -ForegroundColor Red
        $cenariosParaExecutar = $cenarios
    }
}

Write-Host ""
Write-Host "Iniciando auditoria de $($cenariosParaExecutar.Count) cenário(s)..." -ForegroundColor Green
Write-Host "Máximo de processos paralelos: $maxParallel" -ForegroundColor Gray
Write-Host ""

# Cria jobs para execução paralela
$jobs = @()
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"

foreach ($cenario in $cenariosParaExecutar) {
    $specFile = "cypress/e2e/cenarios/$cenario.cy.js"
    
    # Verifica se o arquivo existe
    if (-not (Test-Path $specFile)) {
        Write-Host "  [SKIP] Arquivo não encontrado: $specFile" -ForegroundColor Yellow
        continue
    }

    # Aguarda se já temos o máximo de jobs rodando
    while (($jobs | Where-Object { $_.State -eq 'Running' }).Count -ge $maxParallel) {
        Start-Sleep -Seconds 2
    }

    Write-Host "  [START] $cenario" -ForegroundColor Cyan
    
    $job = Start-Job -ScriptBlock {
        param($specFile, $cenario)
        Set-Location $using:PWD
        $output = npx cypress run --spec $specFile --browser chrome 2>&1
        return @{
            Cenario = $cenario
            Output = $output
            ExitCode = $LASTEXITCODE
        }
    } -ArgumentList $specFile, $cenario
    
    $jobs += $job
}

Write-Host ""
Write-Host "Aguardando conclusão dos testes..." -ForegroundColor Yellow
Write-Host ""

# Aguarda todos os jobs
$jobs | Wait-Job | Out-Null

# Coleta resultados
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  RESULTADOS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$sucessos = 0
$falhas = 0

foreach ($job in $jobs) {
    $result = Receive-Job -Job $job
    $cenario = $result.Cenario
    $exitCode = $result.ExitCode
    
    if ($exitCode -eq 0) {
        Write-Host "  [OK] $cenario" -ForegroundColor Green
        $sucessos++
    } else {
        Write-Host "  [FAIL] $cenario (código: $exitCode)" -ForegroundColor Red
        $falhas++
    }
}

# Remove jobs
$jobs | Remove-Job

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  RESUMO" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Sucessos: $sucessos" -ForegroundColor Green
Write-Host "  Falhas:   $falhas" -ForegroundColor $(if ($falhas -gt 0) { "Red" } else { "Green" })
Write-Host ""
Write-Host "Arquivos Excel gerados em: cypress/downloads/" -ForegroundColor Yellow
Write-Host ""

# Lista arquivos gerados
Get-ChildItem -Path "cypress/downloads" -Filter "auditoria_*.xlsx" | 
    Sort-Object LastWriteTime -Descending | 
    Select-Object -First 20 |
    ForEach-Object {
        Write-Host "  - $($_.Name)" -ForegroundColor Gray
    }

