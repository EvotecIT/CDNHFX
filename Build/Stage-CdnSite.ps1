#requires -Version 7.0
<#
.SYNOPSIS
Stages the public CDN files for static hosting.
.PARAMETER OutputPath
An absent or empty destination. Defaults to _site in the repository root.
.EXAMPLE
./Build/Stage-CdnSite.ps1 -OutputPath /tmp/cdnhfx-site
#>
[CmdletBinding()]
param(
    [ValidateNotNullOrEmpty()]
    [string] $OutputPath = (Join-Path $PSScriptRoot '../_site')
)

$ErrorActionPreference = 'Stop'
$sourceRoot = [IO.Path]::TrimEndingDirectorySeparator([IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')))
$outputRoot = [IO.Path]::TrimEndingDirectorySeparator($ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputPath))
$separator = [IO.Path]::DirectorySeparatorChar
$comparison = [StringComparison]::Ordinal
if ($IsWindows) {
    $comparison = [StringComparison]::OrdinalIgnoreCase
}

$defaultOutput = Join-Path $sourceRoot '_site'
if ($outputRoot.Equals($sourceRoot, $comparison) -or
    $sourceRoot.StartsWith($outputRoot + $separator, $comparison) -or
    ($outputRoot.StartsWith($sourceRoot + $separator, $comparison) -and
        -not $outputRoot.Equals($defaultOutput, $comparison))) {
    throw 'Output must be _site or a separate directory outside the source tree.'
}

foreach ($root in @($sourceRoot, $outputRoot)) {
    $ancestor = [IO.DirectoryInfo]::new($root)
    while ($null -ne $ancestor) {
        if (Test-Path -LiteralPath $ancestor.FullName) {
            $item = Get-Item -LiteralPath $ancestor.FullName -Force
            if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
                throw "Linked paths are not supported: $($item.FullName)"
            }
        }
        $ancestor = $ancestor.Parent
    }
}

if (Test-Path -LiteralPath $outputRoot) {
    if (-not (Get-Item -LiteralPath $outputRoot -Force).PSIsContainer -or
        @(Get-ChildItem -LiteralPath $outputRoot -Force | Select-Object -First 1).Count -gt 0) {
        throw "Output must be an absent or empty directory: $outputRoot"
    }
}

$publicPaths = @('Fonts', 'Images', 'Scripts', 'Styles', 'v', 'preview', 'index.html', '.nojekyll')
foreach ($name in $publicPaths) {
    $source = Get-Item -LiteralPath (Join-Path $sourceRoot $name) -Force
    $entries = @($source)
    if ($source.PSIsContainer) {
        $entries += @(Get-ChildItem -LiteralPath $source.FullName -Recurse -Force)
    }
    foreach ($entry in $entries) {
        if ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) {
            throw "Linked source entries are not supported: $($entry.FullName)"
        }
    }
}

[IO.Directory]::CreateDirectory($outputRoot) | Out-Null
foreach ($name in $publicPaths) {
    Copy-Item -LiteralPath (Join-Path $sourceRoot $name) -Destination $outputRoot -Recurse
}
Write-Host "Staged CDN assets to $outputRoot"
