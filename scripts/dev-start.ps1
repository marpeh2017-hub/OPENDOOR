# Urban Renewal OS - Local Development Startup
# Usage: pwsh scripts/dev-start.ps1
# Starts: PostgreSQL, MinIO, Redis (Windows native), API Gateway, CRM, Portal

$root = Split-Path -Parent $PSScriptRoot
$minioExe = "C:\Users\Me\AppData\Local\Microsoft\WinGet\Packages\MinIO.Server_Microsoft.Winget.Source_8wekyb3d8bbwe\minio.exe"
$mc = "C:\Users\Me\AppData\Local\Microsoft\WinGet\Packages\MinIO.Client_Microsoft.Winget.Source_8wekyb3d8bbwe\mc.exe"
$redisDir = "C:\Users\Me\AppData\Local\redis-windows"
$redisExe = "$redisDir\redis-server.exe"
$redisCli = "$redisDir\redis-cli.exe"

Write-Host "=== Urban Renewal OS - Dev Startup ===" -ForegroundColor Cyan

# 1. PostgreSQL (canonical dev database)
# Verified paths: single installation at C:\Program Files\PostgreSQL\17,
# data directory confirmed to contain PG_VERSION + postgresql.conf.
$pgBin  = "C:\Program Files\PostgreSQL\17\bin"
$pgCtl  = "$pgBin\pg_ctl.exe"
$pgData = "C:\Program Files\PostgreSQL\17\data"

function Test-PgPort {
  try {
    $c = New-Object System.Net.Sockets.TcpClient
    $iar = $c.BeginConnect("127.0.0.1", 5432, $null, $null)
    $ok = $iar.AsyncWaitHandle.WaitOne(1000, $false)
    if ($ok) { $c.EndConnect($iar); $c.Close(); return $true }
    $c.Close(); return $false
  } catch { return $false }
}

# Wait until the postmaster actually ACCEPTS connections, not just until the
# port is bound. pg_isready is the authoritative check.
function Wait-PgReady([int]$TimeoutSec = 60) {
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  $isReady = "$pgBin\pg_isready.exe"
  while ((Get-Date) -lt $deadline) {
    if (Test-Path $isReady) {
      & $isReady -h 127.0.0.1 -p 5432 -q 2>$null | Out-Null
      if ($LASTEXITCODE -eq 0) { return $true }
    } elseif (Test-PgPort) {
      return $true
    }
    Start-Sleep -Milliseconds 500
  }
  return $false
}

if (Wait-PgReady -TimeoutSec 2) {
  Write-Host "PostgreSQL already running" -ForegroundColor Green
} else {
  Write-Host "Starting PostgreSQL..." -ForegroundColor Yellow
  $started = $false

  # Preferred: the registered Windows service (postgresql-x64-17).
  $pgSvc = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($null -ne $pgSvc) {
    try {
      Start-Service $pgSvc.Name -ErrorAction Stop
      Write-Host "  started via service '$($pgSvc.Name)'" -ForegroundColor DarkGray
      $started = $true
    } catch {
      # Usually "access denied" - starting a service needs elevation.
      Write-Host "  service '$($pgSvc.Name)' could not be started (needs admin); falling back to pg_ctl" -ForegroundColor DarkYellow
    }
  }

  # Fallback: launch the postmaster detached via pg_ctl (no admin required).
  if (-not $started) {
    if ((Test-Path $pgCtl) -and (Test-Path "$pgData\PG_VERSION")) {
      $pgLogDir = "C:\Users\Me\AppData\Local\pgsql"
      New-Item -ItemType Directory -Force $pgLogDir | Out-Null
      Start-Process -FilePath $pgCtl `
        -ArgumentList "start", "-D", "`"$pgData`"", "-l", "`"$pgLogDir\pg.log`"" `
        -WindowStyle Hidden
      $started = $true
    } elseif (-not (Test-Path $pgCtl)) {
      Write-Host "PostgreSQL not installed at $pgBin. Install with:" -ForegroundColor Red
      Write-Host '  winget install PostgreSQL.PostgreSQL.17 --override "--mode unattended --unattendedmodeui none --superpassword postgres --serverport 5432"' -ForegroundColor Yellow
    } else {
      Write-Host "PostgreSQL data directory invalid: $pgData (no PG_VERSION)" -ForegroundColor Red
    }
  }

  if ($started -and (Wait-PgReady -TimeoutSec 60)) {
    Write-Host "PostgreSQL ready on 127.0.0.1:5432" -ForegroundColor Green
  } else {
    Write-Host "PostgreSQL failed to start - API Gateway will not serve data" -ForegroundColor Red
    Write-Host "  check C:\Users\Me\AppData\Local\pgsql\pg.log" -ForegroundColor DarkYellow
  }
}

# 2. MinIO
$minioRunning = try { (Invoke-WebRequest "http://localhost:9000/minio/health/live" -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200 } catch { $false }
if (-not $minioRunning) {
  Write-Host "Starting MinIO..." -ForegroundColor Yellow
  $env:MINIO_ROOT_USER = "minioadmin"
  $env:MINIO_ROOT_PASSWORD = "minioadmin"
  Start-Process -FilePath $minioExe -ArgumentList "server C:\minio-data --console-address :9001 --address :9000" -WindowStyle Hidden
  Start-Sleep -Seconds 3
  & $mc alias set local http://localhost:9000 minioadmin minioadmin 2>$null | Out-Null
  & $mc mb --ignore-existing local/urban-renewal 2>$null | Out-Null
  Write-Host "MinIO ready" -ForegroundColor Green
} else {
  Write-Host "MinIO already running" -ForegroundColor Green
}

# 3. Redis (Windows native binary ג€” no WSL/admin required)
$redisRunning = try { & $redisCli ping 2>$null | Select-Object -First 1 } catch { $null }
if ($redisRunning -ne "PONG") {
  Write-Host "Starting Redis (Windows native)..." -ForegroundColor Yellow
  if (-not (Test-Path $redisExe)) {
    Write-Host "Redis binary not found at $redisExe" -ForegroundColor Red
    Write-Host "Run: Invoke-WebRequest -Uri 'https://github.com/microsoftarchive/redis/releases/download/win-3.2.100/Redis-x64-3.2.100.zip' -OutFile redis.zip; Expand-Archive redis.zip $redisDir" -ForegroundColor Yellow
  } else {
    $redisConf = "$redisDir\redis.windows-dev.conf"
    if (-not (Test-Path $redisConf)) {
      @"
port 6379
bind 127.0.0.1
daemonize no
loglevel warning
"@ | Set-Content $redisConf
    }
    $logFile = "$redisDir\redis-dev.log"
    Start-Process -FilePath $redisExe -ArgumentList $redisConf -WorkingDirectory $redisDir -WindowStyle Hidden -RedirectStandardOutput $logFile
    Start-Sleep -Seconds 2
    $redisRunning = try { & $redisCli ping 2>$null | Select-Object -First 1 } catch { $null }
    if ($redisRunning -eq "PONG") {
      Write-Host "Redis ready on 127.0.0.1:6379" -ForegroundColor Green
    } else {
      Write-Host "Redis failed to start - API Gateway will use in-memory fallback" -ForegroundColor DarkYellow
    }
  }
} else {
  Write-Host "Redis already running" -ForegroundColor Green
}

# 4. API Gateway
Write-Host "Starting API Gateway on :4000..." -ForegroundColor Yellow
Start-Process -FilePath "pnpm" -ArgumentList "--filter @urban-renewal/api-gateway dev" -WorkingDirectory $root -WindowStyle Normal

Start-Sleep -Seconds 2

# 5. CRM
Write-Host "Starting CRM on :3001..." -ForegroundColor Yellow
Start-Process -FilePath "pnpm" -ArgumentList "--filter @urban-renewal/crm dev" -WorkingDirectory $root -WindowStyle Normal

# 6. Portal
Write-Host "Starting Resident Portal on :3002..." -ForegroundColor Yellow
Start-Process -FilePath "pnpm" -ArgumentList "--filter @urban-renewal/portal dev" -WorkingDirectory $root -WindowStyle Normal

Write-Host ""
Write-Host "=== Services Starting ===" -ForegroundColor Cyan
Write-Host "API Gateway:      http://localhost:4000" -ForegroundColor White
Write-Host "Swagger:          http://localhost:4000/api/docs" -ForegroundColor White
Write-Host "CRM:              http://localhost:3001" -ForegroundColor White
Write-Host "Resident Portal:  http://localhost:3002" -ForegroundColor White
Write-Host "MinIO Console:    http://localhost:9001 (minioadmin/minioadmin)" -ForegroundColor White
Write-Host ""
Write-Host "Login: admin@opendoor.co.il / demo1234" -ForegroundColor Cyan

