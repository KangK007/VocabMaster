$script:VocabMasterProjectRoot = Split-Path -Parent $PSScriptRoot

function Get-VocabMasterProjectRoot {
  return $script:VocabMasterProjectRoot
}

function Import-VocabMasterReleaseMetadata {
  param(
    [string]$MetadataPath = ""
  )

  $Root = Get-VocabMasterProjectRoot
  if (!$MetadataPath) {
    $DefaultPath = Join-Path $Root ".release.local.ps1"
    if (Test-Path $DefaultPath) {
      $MetadataPath = $DefaultPath
    }
  }
  if (!$MetadataPath) {
    return $null
  }
  if (![System.IO.Path]::IsPathRooted($MetadataPath)) {
    $MetadataPath = Join-Path $Root $MetadataPath
  }
  if (!(Test-Path $MetadataPath)) {
    throw "Release metadata file not found: $MetadataPath"
  }

  $ResolvedPath = (Resolve-Path -LiteralPath $MetadataPath).Path
  . $ResolvedPath
  return $ResolvedPath
}

function Test-VocabMasterPlaceholderValue {
  param(
    [AllowNull()][string]$Value
  )

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return $true
  }

  $Lower = $Value.Trim().ToLowerInvariant()
  $PlaceholderMarkers = @(
    "example.com",
    "example.org",
    "example.net",
    "example.invalid",
    ".example",
    ".invalid",
    ".test",
    ".local",
    "your-domain",
    "your-company",
    "your company",
    "changeme",
    "placeholder",
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "todo",
    "vocabmaster contributors"
  )

  foreach ($Marker in $PlaceholderMarkers) {
    if ($Lower.Contains($Marker)) {
      return $true
    }
  }
  return $false
}

function Test-VocabMasterHttpsUrl {
  param(
    [AllowNull()][string]$Value
  )

  if (Test-VocabMasterPlaceholderValue $Value) {
    return $false
  }

  $Uri = $null
  if (![System.Uri]::TryCreate($Value.Trim(), [System.UriKind]::Absolute, [ref]$Uri)) {
    return $false
  }
  if ($Uri.Scheme -ne [System.Uri]::UriSchemeHttps) {
    return $false
  }
  if ($Uri.Host -notmatch "\.") {
    return $false
  }
  return $true
}

function Test-VocabMasterPrivacyContact {
  param(
    [AllowNull()][string]$Value
  )

  if (Test-VocabMasterHttpsUrl $Value) {
    return $true
  }
  if (Test-VocabMasterPlaceholderValue $Value) {
    return $false
  }
  return $Value.Trim() -match "^mailto:[^@\s]+@[^@\s]+\.[^@\s]+$"
}

function Resolve-VocabMasterSignTool {
  param(
    [string]$SignToolPath = ""
  )

  if ($SignToolPath) {
    if (!(Test-Path $SignToolPath)) {
      throw "signtool.exe not found: $SignToolPath"
    }
    return (Resolve-Path -LiteralPath $SignToolPath).Path
  }

  $Command = Get-Command signtool.exe -ErrorAction SilentlyContinue
  if ($Command) {
    return $Command.Source
  }

  $SearchRoots = New-Object System.Collections.Generic.List[string]
  $ProgramFilesX86 = [Environment]::GetEnvironmentVariable("ProgramFiles(x86)")
  if ($ProgramFilesX86) {
    $SearchRoots.Add((Join-Path $ProgramFilesX86 "Windows Kits")) | Out-Null
  }
  if ($env:ProgramFiles) {
    $SearchRoots.Add((Join-Path $env:ProgramFiles "Windows Kits")) | Out-Null
  }

  $Candidates = @()
  foreach ($SearchRoot in $SearchRoots) {
    if (Test-Path $SearchRoot) {
      $Candidates += Get-ChildItem -Path $SearchRoot -Recurse -Filter signtool.exe -ErrorAction SilentlyContinue
    }
  }

  $Preferred = $Candidates |
    Where-Object { $_.FullName -match "\\x64\\signtool\.exe$" } |
    Sort-Object FullName -Descending |
    Select-Object -First 1
  if (!$Preferred) {
    $Preferred = $Candidates | Sort-Object FullName -Descending | Select-Object -First 1
  }
  if ($Preferred) {
    return $Preferred.FullName
  }

  throw "signtool.exe not found. Install Windows SDK or set SIGNTOOL_PATH."
}
