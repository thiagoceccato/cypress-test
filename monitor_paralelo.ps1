# monitor_paralelo.ps1
# Monitora os 4 grupos rodando em paralelo

param([int]$IntervaloSegundos = 30)

$inicio = Get-Date
$elementosPorUrl = 25

while ($true) {
    Clear-Host
    $agora = Get-Date
    $tempoDecorrido = $agora - $inicio
    $tempoStr = "{0:hh\:mm\:ss}" -f $tempoDecorrido
    
    $totalGeral = 0
    $comGaGeral = 0
    
    Write-Host ""
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host "     MONITOR PARALELO - 4 GRUPOS EM EXECUCAO" -ForegroundColor Cyan
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  TEMPO DECORRIDO: $tempoStr" -ForegroundColor White
    Write-Host ""
    Write-Host "----------------------------------------------------------------" -ForegroundColor DarkGray
    
    $grupos = @(
        @{ Num = 1; Nome = "Cartoes+Maq"; Urls = 26 },
        @{ Num = 2; Nome = "Consorcio"; Urls = 22 },
        @{ Num = 3; Nome = "Seguros+Cred"; Urls = 35 },
        @{ Num = 4; Nome = "Outros"; Urls = 24 }
    )
    
    foreach ($g in $grupos) {
        $csv = "cypress/results_novo/grupo$($g.Num)_coleta.csv"
        
        if (Test-Path $csv) {
            $conteudo = Get-Content $csv
            $linhas = [Math]::Max(0, ($conteudo | Measure-Object).Count - 1)
            $comGa = ($conteudo | Select-String ",true," | Measure-Object).Count
            
            $totalGeral += $linhas
            $comGaGeral += $comGa
            
            if ($linhas -gt 0) {
                $taxa = [math]::Round(($comGa / $linhas) * 100, 0)
                $estimado = $g.Urls * $elementosPorUrl
                $progresso = [math]::Min(100, [math]::Round(($linhas / $estimado) * 100, 0))
                
                $status = "[OK]"
                $cor = "Green"
                if ($taxa -lt 80) { $status = "[!!]"; $cor = "Yellow" }
                if ($taxa -lt 60) { $status = "[XX]"; $cor = "Red" }
                
                Write-Host "  $status " -NoNewline -ForegroundColor $cor
                Write-Host "$($g.Nome.PadRight(14))" -NoNewline -ForegroundColor White
                Write-Host " | Linhas: $($linhas.ToString().PadLeft(4))" -NoNewline
                Write-Host " | GA4: $($comGa.ToString().PadLeft(3))" -NoNewline -ForegroundColor Green
                Write-Host " | Taxa: $($taxa.ToString().PadLeft(2))%" -NoNewline -ForegroundColor $cor
                Write-Host " | Prog: $($progresso.ToString().PadLeft(3))%" -ForegroundColor Cyan
            } else {
                Write-Host "  [..] $($g.Nome.PadRight(14)) | Iniciando..." -ForegroundColor Yellow
            }
        } else {
            Write-Host "  [??] $($g.Nome.PadRight(14)) | Aguardando CSV..." -ForegroundColor DarkGray
        }
    }
    
    Write-Host ""
    Write-Host "----------------------------------------------------------------" -ForegroundColor DarkGray
    
    # Resumo geral
    $taxaGeral = if ($totalGeral -gt 0) { [math]::Round(($comGaGeral / $totalGeral) * 100, 1) } else { 0 }
    $corGeral = if ($taxaGeral -ge 80) { "Green" } elseif ($taxaGeral -ge 60) { "Yellow" } else { "Red" }
    
    Write-Host ""
    Write-Host "  TOTAL: $totalGeral linhas | Com GA4: $comGaGeral | Taxa: $taxaGeral%" -ForegroundColor $corGeral
    
    # Estimativa de tempo
    $totalEstimado = 107 * $elementosPorUrl
    if ($totalGeral -gt 100 -and $tempoDecorrido.TotalMinutes -gt 1) {
        $velocidade = $totalGeral / $tempoDecorrido.TotalMinutes
        $faltando = $totalEstimado - $totalGeral
        
        if ($velocidade -gt 0 -and $faltando -gt 0) {
            $minutosRestantes = $faltando / $velocidade
            $horasRest = [math]::Floor($minutosRestantes / 60)
            $minsRest = [math]::Round($minutosRestantes % 60)
            Write-Host ""
            Write-Host "  TEMPO RESTANTE: ~${horasRest}h ${minsRest}min" -ForegroundColor Yellow
            Write-Host "  VELOCIDADE: $([math]::Round($velocidade, 1)) linhas/min" -ForegroundColor Magenta
        }
    }
    
    $progressoTotal = [math]::Round(($totalGeral / $totalEstimado) * 100, 1)
    Write-Host ""
    Write-Host "  PROGRESSO TOTAL: $progressoTotal% de ~$totalEstimado linhas" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "================================================================" -ForegroundColor DarkGray
    Write-Host "  Pressione Ctrl+C para parar o monitor" -ForegroundColor DarkGray
    Write-Host ""
    
    Start-Sleep -Seconds $IntervaloSegundos
}
