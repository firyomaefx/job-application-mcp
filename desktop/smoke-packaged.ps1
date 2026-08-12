$ErrorActionPreference = "Stop"

$releaseDir = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "release"))
$appExe = Get-ChildItem -LiteralPath $releaseDir -Recurse -Filter "Job Application MCP.exe" |
  Where-Object { $_.FullName -match "[\\/]win-unpacked[\\/]Job Application MCP\.exe$" } |
  Select-Object -First 1
if (-not $appExe) { throw "No unpacked Windows application found under $releaseDir" }

$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
$listener.Start()
$port = ([Net.IPEndPoint]$listener.LocalEndpoint).Port
$listener.Stop()

$smokeData = Join-Path ([IO.Path]::GetTempPath()) ("job-mcp-packaged-smoke-" + [guid]::NewGuid().ToString("N"))
$env:JOB_MCP_HTTP_PORT = [string]$port
$env:JOB_MCP_DATA_DIR = $smokeData
$process = $null
try {
  $process = Start-Process -FilePath $appExe.FullName -PassThru -WindowStyle Hidden
  $health = $null
  for ($attempt = 0; $attempt -lt 40; $attempt++) {
    Start-Sleep -Milliseconds 500
    $process.Refresh()
    if ($process.HasExited) { throw "Packaged application exited with code $($process.ExitCode)" }
    try {
      $health = Invoke-RestMethod -Uri "http://127.0.0.1:$port/health" -TimeoutSec 1
      break
    } catch {
      # Bridge startup is asynchronous; retry within the bounded window.
    }
  }
  if (-not $health -or -not $health.ok) { throw "Packaged bridge did not become healthy on port $port" }
  $toolCount = @($health.data.tools).Count
  if ($toolCount -lt 41) { throw "Packaged bridge exposed only $toolCount tools; expected at least 41" }
  Write-Output "PASS packaged Windows launch: main process stable, bridge healthy, $toolCount tools."
} finally {
  if ($process -and -not $process.HasExited) { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Seconds 1
  if (Test-Path -LiteralPath $smokeData) { Remove-Item -LiteralPath $smokeData -Recurse -Force }
}
