param([int]$Port = 8766)
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
Write-Host "CN 练习站：http://127.0.0.1:$Port/app/"
python -m http.server $Port --bind 127.0.0.1
