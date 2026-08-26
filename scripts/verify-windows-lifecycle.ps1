param(
  [string]$OutputRoot = 'dist-windows-beta'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$outputPath = (Resolve-Path $OutputRoot).Path
$installer = Get-ChildItem $outputPath -Filter 'exact-extract-*-setup.exe' -File |
  Sort-Object Name |
  Select-Object -Last 1
$candidateExe = Join-Path $outputPath 'win-unpacked\exact-extract.exe'
$acceptanceRoot = Join-Path $outputPath 'acceptance-lifecycle'
$profilePath = Join-Path $acceptanceRoot 'profile'
$stdoutPath = Join-Path $acceptanceRoot 'stdout.log'
$stderrPath = Join-Path $acceptanceRoot 'stderr.log'
$uninstallKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*'

if (-not $installer) {
  throw 'Windows beta installer is missing.'
}
if (-not (Test-Path $candidateExe)) {
  throw 'Unpacked candidate executable is missing.'
}
if (Get-ItemProperty $uninstallKey -ErrorAction SilentlyContinue |
    Where-Object DisplayName -EQ 'EXACT EXTRACT') {
  throw 'EXACT EXTRACT is already installed. Uninstall it before lifecycle acceptance.'
}

Remove-Item $acceptanceRoot -Recurse -Force -ErrorAction SilentlyContinue
New-Item $profilePath -ItemType Directory -Force | Out-Null

$installedRoot = $null
$uninstaller = $null
$installExitCode = $null
$reinstallExitCode = $null
$uninstallExitCode = $null
$launchEvidence = $null

try {
  $install = Start-Process $installer.FullName -ArgumentList '/S' -PassThru -Wait
  $installExitCode = $install.ExitCode
  if ($installExitCode -ne 0) {
    throw "Install failed with exit code $installExitCode."
  }

  $registration = Get-ItemProperty $uninstallKey |
    Where-Object DisplayName -EQ 'EXACT EXTRACT' |
    Select-Object -First 1
  if (-not $registration -or $registration.UninstallString -notmatch '^"([^"]+)"') {
    throw 'The installed application has no valid uninstaller registration.'
  }

  $uninstaller = $Matches[1]
  $installedRoot = Split-Path $uninstaller
  $installedExe = Join-Path $installedRoot 'exact-extract.exe'
  $candidateHash = (Get-FileHash $candidateExe -Algorithm SHA256).Hash.ToLowerInvariant()
  $installedHash = (Get-FileHash $installedExe -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($installedHash -ne $candidateHash) {
    throw 'The installed executable does not match the unpacked candidate.'
  }

  $application = Start-Process $installedExe `
    -ArgumentList "--user-data-dir=$profilePath" `
    -WorkingDirectory $installedRoot `
    -RedirectStandardOutput $stdoutPath `
    -RedirectStandardError $stderrPath `
    -PassThru
  if (-not $application.WaitForInputIdle(30000)) {
    throw 'The installed application did not become input-idle within 30 seconds.'
  }

  $windowDeadline = [DateTime]::UtcNow.AddSeconds(30)
  while (-not $application.HasExited -and
    $application.MainWindowHandle -eq 0 -and
    [DateTime]::UtcNow -lt $windowDeadline) {
    $application.Refresh()
    [System.Threading.Thread]::Sleep(100)
  }
  if ($application.HasExited -or $application.MainWindowHandle -eq 0) {
    throw 'The installed application did not open a native window within 30 seconds.'
  }

  $profileDeadline = [DateTime]::UtcNow.AddSeconds(15)
  while (-not (Test-Path (Join-Path $profilePath 'Preferences')) -and
    [DateTime]::UtcNow -lt $profileDeadline) {
    [System.Threading.Thread]::Sleep(100)
  }

  $childProcesses = Get-CimInstance Win32_Process -Filter "Name = 'exact-extract.exe'" |
    Where-Object ParentProcessId -EQ $application.Id
  $launchEvidence = [ordered]@{
    processId = $application.Id
    responding = $application.Responding
    windowTitle = $application.MainWindowTitle
    appModelIdPresent = @($childProcesses.CommandLine -match '--app-user-model-id=com.exactextract.app').Count -gt 0
    isolatedProfileCreated = Test-Path (Join-Path $profilePath 'Preferences')
    stderrBytes = (Get-Item $stderrPath).Length
  }
  if (-not $launchEvidence.responding -or
    $launchEvidence.windowTitle -ne 'EXACT EXTRACT' -or
    -not $launchEvidence.appModelIdPresent -or
    -not $launchEvidence.isolatedProfileCreated -or
    $launchEvidence.stderrBytes -ne 0) {
    throw 'Installed launch acceptance failed.'
  }

  $closeRequested = $application.CloseMainWindow()
  if (-not $closeRequested -or -not $application.WaitForExit(15000)) {
    throw 'The installed application did not exit cleanly after its window was closed.'
  }
  $launchEvidence.exitCode = $application.ExitCode
  if ($application.ExitCode -ne 0) {
    throw "The installed application exited with code $($application.ExitCode)."
  }

  $reinstall = Start-Process $installer.FullName -ArgumentList '/S' -PassThru -Wait
  $reinstallExitCode = $reinstall.ExitCode
  if ($reinstallExitCode -ne 0) {
    throw "Reinstall failed with exit code $reinstallExitCode."
  }
  if ((Get-FileHash $installedExe -Algorithm SHA256).Hash.ToLowerInvariant() -ne $candidateHash) {
    throw 'Reinstall changed the installed executable hash.'
  }

  $registration = Get-ItemProperty $uninstallKey |
    Where-Object DisplayName -EQ 'EXACT EXTRACT' |
    Select-Object -First 1
  if (-not $registration -or $registration.QuietUninstallString -notmatch '^"([^"]+)"\s*(.*)$') {
    throw 'The installed application has no valid quiet uninstaller registration.'
  }
  $uninstaller = $Matches[1]
  $uninstall = Start-Process $uninstaller -ArgumentList $Matches[2] -PassThru -Wait
  $uninstallExitCode = $uninstall.ExitCode
  if ($uninstallExitCode -ne 0) {
    throw "Uninstall failed with exit code $uninstallExitCode."
  }

  $remainingRegistration = Get-ItemProperty $uninstallKey -ErrorAction SilentlyContinue |
    Where-Object DisplayName -EQ 'EXACT EXTRACT'
  $remainingProcesses = Get-CimInstance Win32_Process -Filter "Name = 'exact-extract.exe'" |
    Where-Object ExecutablePath -Like "$installedRoot*"
  $desktopShortcut = Join-Path ([Environment]::GetFolderPath('Desktop')) 'EXACT EXTRACT.lnk'
  $startShortcut = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\EXACT EXTRACT.lnk'
  if ($remainingRegistration -or
    $remainingProcesses -or
    (Test-Path $installedRoot) -or
    (Test-Path $desktopShortcut) -or
    (Test-Path $startShortcut)) {
    throw 'Uninstall left application registration, files, shortcuts, or processes behind.'
  }

  $evidence = [ordered]@{
    schemaVersion = 1
    generatedAt = [DateTime]::UtcNow.ToString('o')
    productName = 'EXACT EXTRACT'
    appId = 'com.exactextract.app'
    installer = $installer.Name
    installerSignature = (Get-AuthenticodeSignature $installer.FullName).Status.ToString()
    executableSignature = (Get-AuthenticodeSignature $candidateExe).Status.ToString()
    candidateExecutableSha256 = $candidateHash
    installExitCode = $installExitCode
    reinstallExitCode = $reinstallExitCode
    uninstallExitCode = $uninstallExitCode
    launch = $launchEvidence
    cleanup = [ordered]@{
      registrationRemoved = $true
      installDirectoryRemoved = $true
      shortcutsRemoved = $true
      processesRemaining = 0
      isolatedUserDataRetained = Test-Path (Join-Path $profilePath 'Preferences')
    }
  }
  $evidence | ConvertTo-Json -Depth 5 |
    Set-Content (Join-Path $outputPath 'lifecycle-manifest.json') -Encoding utf8
  Write-Output "PASS install=$installExitCode launch=0 reinstall=$reinstallExitCode uninstall=$uninstallExitCode hash=match cleanup=complete"
} finally {
  Get-CimInstance Win32_Process -Filter "Name = 'exact-extract.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $installedRoot -and $_.ExecutablePath -Like "$installedRoot*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

  if ($uninstaller -and (Test-Path $uninstaller) -and
    (Get-ItemProperty $uninstallKey -ErrorAction SilentlyContinue |
      Where-Object DisplayName -EQ 'EXACT EXTRACT')) {
    Start-Process $uninstaller -ArgumentList '/currentuser', '/S' -Wait | Out-Null
  }
}