<#
  Registers MinIO and Redis to start automatically at logon.

  WHY SCHEDULED TASKS AND NOT WINDOWS SERVICES
  --------------------------------------------
  A true Windows service (`sc create` / `New-Service`) requires an elevated
  shell. These tasks achieve the same practical goal — the processes come back
  by themselves after a reboot and nobody has to relaunch them by hand — and can
  be registered by the ordinary user who runs the dev stack.

  The trade-off is real and worth knowing: a logon task starts when THIS USER
  logs in, not at boot, and it dies when they log out. For a development machine
  that is the normal case. If you later want them running headless before logon,
  re-run the equivalent `New-Service` from an elevated prompt — see
  docs/GETTING_STARTED.md.

  Re-running this script is safe: existing tasks with the same names are
  replaced (-Force), not duplicated.
#>

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

$tasks = @(
  @{ Name = 'UROS MinIO'; Script = Join-Path $scriptDir 'start-minio.cmd' },
  @{ Name = 'UROS Redis'; Script = Join-Path $scriptDir 'start-redis.cmd' }
)

foreach ($t in $tasks) {
  if (-not (Test-Path $t.Script)) {
    throw "Launcher not found: $($t.Script)"
  }

  $action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c `"$($t.Script)`""
  $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
  # No idle/battery stop conditions: a dev dependency that quits when the laptop
  # unplugs looks exactly like a code bug from the application side.
  $settings = New-ScheduledTaskSettingsSet `
      -AllowStartIfOnBatteries `
      -DontStopIfGoingOnBatteries `
      -ExecutionTimeLimit ([TimeSpan]::Zero) `
      -RestartCount 3 `
      -RestartInterval (New-TimeSpan -Minutes 1)

  # Register-ScheduledTask raises a NON-TERMINATING CimException on access
  # denied, so `$ErrorActionPreference = 'Stop'` alone does not stop the script
  # and a plain success message here would be printed for a task that was never
  # created. Force it to terminate, then confirm by reading the task back.
  try {
    Register-ScheduledTask -TaskName $t.Name -Action $action -Trigger $trigger `
        -Settings $settings -Description 'Urban Renewal OS local development dependency' `
        -Force -ErrorAction Stop | Out-Null
  } catch {
    Write-Host "FAILED to register '$($t.Name)': $($_.Exception.Message)"
    Write-Host 'Access denied usually means this shell is not elevated.'
    Write-Host 'Re-run this script from an Administrator PowerShell prompt,'
    Write-Host 'or use the no-admin fallback described in docs/GETTING_STARTED.md.'
    exit 1
  }

  if (-not (Get-ScheduledTask -TaskName $t.Name -ErrorAction SilentlyContinue)) {
    Write-Host "FAILED: '$($t.Name)' reported success but is not present."
    exit 1
  }
  Write-Host "Registered scheduled task: $($t.Name)"
}

Write-Host ''
Write-Host 'Verify with:  Get-ScheduledTask -TaskName "UROS *"'
Write-Host 'Start now with: Start-ScheduledTask -TaskName "UROS MinIO"; Start-ScheduledTask -TaskName "UROS Redis"'
