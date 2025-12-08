# monitor_coleta.ps1
# Monitora a qualidade da coleta GA4 em tempo real

param(
    [int]$IntervaloSegundos = 30,
    [string]$CsvPath = "cypress/results_novo/cartoes_coleta.csv",
    [int]$TaxaMinimaGA = 60,
    [int]$TotalUrls = 16,           # Quantas URLs estão sendo processadas
    [int]$ElementosPorUrl = 30      # Estimativa de elementos por página (sem header/footer)
)

$ultimaContagem = 0
$inicio = Get-Date
$totalEstimado = $TotalUrls * $ElementosPorUrl

Clear-Host
Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║         MONITOR DE COLETA GA4 - SICREDI                      ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "  CSV: $CsvPath" -ForegroundColor Gray
Write-Host "  URLs a processar: $TotalUrls" -ForegroundColor Gray
Write-Host "  Elementos estimados: ~$totalEstimado" -ForegroundColor Gray
Write-Host "  Intervalo de checagem: ${IntervaloSegundos}s" -ForegroundColor Gray
Write-Host ""
Write-Host "  Pressione Ctrl+C para parar o monitor" -ForegroundColor DarkGray
Write-Host ""
Write-Host "────────────────────────────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host ""

# Histórico para calcular velocidade
$historicoLinhas = @()
$historicoTempo = @()

while ($true) {
    $agora = Get-Date
    $tempoDecorrido = $agora - $inicio
    $tempoDecorridoStr = "{0:hh\:mm\:ss}" -f $tempoDecorrido
    
    if (Test-Path $CsvPath) {
        $csv = Get-Content $CsvPath
        $totalLinhas = ($csv | Measure-Object).Count - 1  # -1 para header
        
        if ($totalLinhas -gt 0) {
            $comGa = ($csv | Select-String ",true," | Measure-Object).Count
            $semGa = ($csv | Select-String ",false,sem_ga" | Measure-Object).Count
            $taxaGa = [math]::Round(($comGa / $totalLinhas) * 100, 1)
            
            $novasLinhas = $totalLinhas - $ultimaContagem
            
            # Adiciona ao histórico para calcular velocidade
            $historicoLinhas += $totalLinhas
            $historicoTempo += $agora
            
            # Mantém só últimos 10 pontos
            if ($historicoLinhas.Count -gt 10) {
                $historicoLinhas = $historicoLinhas[-10..-1]
                $historicoTempo = $historicoTempo[-10..-1]
            }
            
            # Calcula velocidade (linhas por minuto)
            $velocidade = 0
            $tempoRestanteStr = "Calculando..."
            if ($historicoLinhas.Count -ge 2) {
                $deltaLinhas = $historicoLinhas[-1] - $historicoLinhas[0]
                $deltaTempo = ($historicoTempo[-1] - $historicoTempo[0]).TotalMinutes
                if ($deltaTempo -gt 0) {
                    $velocidade = [math]::Round($deltaLinhas / $deltaTempo, 1)
                    
                    # Estima tempo restante
                    $linhasFaltando = $totalEstimado - $totalLinhas
                    if ($velocidade -gt 0 -and $linhasFaltando -gt 0) {
                        $minutosRestantes = $linhasFaltando / $velocidade
                        $horasRestantes = [math]::Floor($minutosRestantes / 60)
                        $minsRestantes = [math]::Round($minutosRestantes % 60)
                        $tempoRestanteStr = "${horasRestantes}h ${minsRestantes}min"
                    } elseif ($linhasFaltando -le 0) {
                        $tempoRestanteStr = "Finalizando..."
                    }
                }
            }
            
            # Progresso em %
            $progresso = [math]::Min(100, [math]::Round(($totalLinhas / $totalEstimado) * 100, 1))
            $barraProgresso = ""
            $barraCheia = [math]::Floor($progresso / 5)
            $barraVazia = 20 - $barraCheia
            $barraProgresso = ("█" * $barraCheia) + ("░" * $barraVazia)
            
            $ultimaContagem = $totalLinhas
            
            # Última linha para ver qual elemento
            $ultimaLinha = $csv | Select-Object -Last 1
            $partes = $ultimaLinha -split ","
            $ultimoElemento = if ($partes.Length -gt 6) { 
                $elem = $partes[6] -replace '"', ''
                $elem.Substring(0, [Math]::Min(50, $elem.Length)) 
            } else { "..." }
            
            # Status colorido
            $corTaxa = if ($taxaGa -ge 80) { "Green" } elseif ($taxaGa -ge $TaxaMinimaGA) { "Yellow" } else { "Red" }
            
            # Output formatado
            Write-Host ""
            Write-Host "  ⏱️  Tempo: " -NoNewline -ForegroundColor DarkGray
            Write-Host "$tempoDecorridoStr" -NoNewline -ForegroundColor White
            Write-Host "  |  🏁 Restante: " -NoNewline -ForegroundColor DarkGray
            Write-Host "$tempoRestanteStr" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "  📊 Progresso: [$barraProgresso] $progresso%" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "  📝 Linhas: " -NoNewline -ForegroundColor DarkGray
            Write-Host "$totalLinhas" -NoNewline -ForegroundColor White
            Write-Host " / ~$totalEstimado" -NoNewline -ForegroundColor DarkGray
            Write-Host "  (+$novasLinhas)" -ForegroundColor Gray
            Write-Host ""
            Write-Host "  ✅ Com GA4: " -NoNewline -ForegroundColor DarkGray
            Write-Host "$comGa" -NoNewline -ForegroundColor Green
            Write-Host "  |  ❌ Sem GA4: " -NoNewline -ForegroundColor DarkGray
            Write-Host "$semGa" -NoNewline -ForegroundColor Red
            Write-Host "  |  📈 Taxa: " -NoNewline -ForegroundColor DarkGray
            Write-Host "$taxaGa%" -ForegroundColor $corTaxa
            Write-Host ""
            Write-Host "  🚀 Velocidade: " -NoNewline -ForegroundColor DarkGray
            Write-Host "$velocidade linhas/min" -ForegroundColor Magenta
            Write-Host ""
            Write-Host "  📍 Último: " -NoNewline -ForegroundColor DarkGray
            Write-Host "$ultimoElemento" -ForegroundColor DarkGray
            Write-Host ""
            Write-Host "────────────────────────────────────────────────────────────────" -ForegroundColor DarkGray
            
            # Alerta se taxa muito baixa
            if ($taxaGa -lt $TaxaMinimaGA -and $totalLinhas -gt 10) {
                Write-Host ""
                Write-Host "  ⚠️  ALERTA: Taxa de GA4 abaixo do esperado! ($taxaGa%)" -ForegroundColor Red
                Write-Host "  Verifique se o teste está funcionando corretamente." -ForegroundColor Red
                Write-Host ""
            }
        } else {
            Write-Host "  [$($agora.ToString('HH:mm:ss'))] ⏳ Aguardando dados..." -ForegroundColor Yellow
        }
    } else {
        Write-Host "  [$($agora.ToString('HH:mm:ss'))] 📂 CSV não encontrado. Teste ainda não iniciou?" -ForegroundColor Yellow
    }
    
    Start-Sleep -Seconds $IntervaloSegundos
}
