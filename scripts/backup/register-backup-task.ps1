<#
  Registers a daily PostgreSQL backup as a Windows scheduled task.

  WHY THIS IS DEV-MACHINE SCAFFOLDING, NOT THE PRODUCTION ANSWER
  --------------------------------------------------------------
  On a real server the scheduler is cron, a systemd timer, or the hosting
  provider's own backup feature — and the dumps belong OFF the machine that
  holds the database. A backup sitting on the same disk as the thing it backs
  up survives a bad migration; it does not survive the disk.

  This script exists because the current environment is a Windows development
  machine with no backup at all, and "none" is worse than "local daily". Treat
  it as the floor, not the ceiling. `scripts/backup/pg-backup.sh` is the actual
  logic and is portable; only the scheduling differs per host.

  WHAT IT DOES NOT DO
  -------------------
  It does not copy dumps off-machine, and it does not encrypt them. A dump
  contains every resident's personal data in plaintext, so wherever these files
  end up needs to be somewhere you would be comfortable storing that.

  Re-running is safe: a task with the same name is replaced (-Force), not
  duplicated.

  USAGE
      pwsh scripts/backup/register-backup-task.ps1
      pwsh scripts/backup/register-backup-task.ps1 -At "02:30" -BackupDir "D:\backups"
#>
param(
  [string]$At        = '03:00',
  [string]$BackupDir = '',
  [string]$TaskName  = 'UROS Postgres Backup',
  [int]   $KeepDays  = 30,
  [int]   $KeepMin   = 7
)

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot  = Resolve-Path (Join-Path $scriptDir '..\..')

if (-not $BackupDir) { $BackupDir = Join-Path $repoRoot 'backups' }

$envFile = Join-Path $repoRoot '.env'
if (-not (Test-Path $envFile)) { throw "No .env at $envFile — the task needs DATABASE_URL." }
if (-not (Select-String -Path $envFile -Pattern '^DATABASE_URL=' -Quiet)) {
  throw "DATABASE_URL is not set in $envFile."
}


# ── Preconditions, checked now rather than at 03:00 ─────────────────────────
# GIT Bash specifically, not whatever `bash` happens to resolve to.
#
# On a default Windows install `Get-Command bash` finds the WSL launcher stub
# under AppData\Local\Microsoft\WindowsApps. It exists whether or not a distro
# is installed, it cannot use Windows paths like C:/Users/..., and a task built
# around it fails at 03:00 with an empty log. Checking merely that "a bash
# exists" is not enough: the stub is excluded by path, and the surviving
# candidate is then PROVEN by running it against a real Windows path.
$bashCandidates = @(
  'C:\Program Files\Git\bin\bash.exe',
  'C:\Program Files\Git\usr\bin\bash.exe',
  'C:\Program Files (x86)\Git\bin\bash.exe'
) + @(
  Get-Command bash -All -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue |
    Where-Object { $_ -notlike '*\WindowsApps\*' }
)

$probePath = $envFile -replace '\\','/'
$bashPath = $null
foreach ($candidate in $bashCandidates) {
  if (-not $candidate -or -not (Test-Path $candidate)) { continue }
  $probe = & $candidate -c "test -f '$probePath' && echo OK" 2>$null
  if ($probe -eq 'OK') { $bashPath = $candidate; break }
}
if (-not $bashPath) {
  throw "Git Bash not found, or the one found cannot read Windows paths. Install Git for Windows, or schedule pg-backup.sh through cron/WSL instead."
}
$bash = [pscustomobject]@{ Source = $bashPath }

$pgBin = $null
foreach ($candidate in @(
  (Get-Command pg_dump -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue),
  'C:\Program Files\PostgreSQL\17\bin\pg_dump.exe',
  'C:\Program Files\PostgreSQL\16\bin\pg_dump.exe',
  'C:\Program Files\PostgreSQL\15\bin\pg_dump.exe'
)) {
  if ($candidate -and (Test-Path $candidate)) { $pgBin = Split-Path -Parent $candidate; break }
}
if (-not $pgBin) { throw "pg_dump not found. Install the PostgreSQL client tools, or pass PG_BIN explicitly." }


New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

# ── The command the task runs ───────────────────────────────────────────────
#
# DATABASE_URL is read from .env at run time rather than baked into the task
# definition, so the credential never appears in Task Scheduler's UI, its XML
# export, or an event-log entry.
$scriptPosix    = ($scriptDir -replace '\\','/') + '/pg-backup.sh'
$backupDirPosix = $BackupDir -replace '\\','/'
$envFilePosix   = ($envFile  -replace '\\','/')
$pgBinPosix     = $pgBin     -replace '\\','/'
$logFile        = Join-Path $BackupDir 'backup.log'
$logPosix       = ($logFile -replace '\\','/')

$inner = @(
  "set -a",
  ". '$envFilePosix'",
  "set +a",
  "export PG_BIN='$pgBinPosix'",
  "export BACKUP_DIR='$backupDirPosix'",
  "export KEEP_DAYS=$KeepDays",
  "export KEEP_MIN=$KeepMin",
  "bash '$scriptPosix' >> '$logPosix' 2>&1"
) -join '; '

$action  = New-ScheduledTaskAction -Execute $bash.Source -Argument "-lc `"$inner`""
$trigger = New-ScheduledTaskTrigger -Daily -At $At
$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -DontStopOnIdleEnd `
  -ExecutionTimeLimit (New-TimeSpan -Hours 2) `
  -MultipleInstances IgnoreNew

Register-ScheduledTask `
  -TaskName    $TaskName `
  -Action      $action `
  -Trigger     $trigger `
  -Settings    $settings `
  -Description 'Urban Renewal OS — nightly PostgreSQL dump with verification and retention.' `
  -Force | Out-Null

Write-Host "Registered '$TaskName'"
Write-Host "  runs daily at $At"
Write-Host "  dumps to     $BackupDir"
Write-Host "  log          $logFile"
Write-Host "  retention    delete after $KeepDays days, never below $KeepMin backups"
Write-Host ""
Write-Host "Run it once now to confirm it works:"
Write-Host "  Start-ScheduledTask -TaskName '$TaskName'"
Write-Host ""
Write-Host "-StartWhenAvailable is set, so a backup missed while the machine was off"
Write-Host "runs at the next opportunity instead of being skipped silently."
Write-Host ""
Write-Host "REMEMBER: these dumps sit on the same machine as the database and are"
Write-Host "not encrypted. Copy them somewhere else before relying on them."
