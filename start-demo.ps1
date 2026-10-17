$ErrorActionPreference = 'Stop'
$localNodeDirectory = Join-Path $PSScriptRoot '.tools\node-v24.19.0-win-x64'
if (Test-Path -LiteralPath (Join-Path $localNodeDirectory 'node.exe')) {
    $env:PATH = $localNodeDirectory + ';' + $env:PATH
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Install Node.js 22.13 or newer, then run this script again.'
}
Push-Location (Join-Path $PSScriptRoot 'crosscheck')
try {
    if (-not (Test-Path -LiteralPath 'node_modules\vinext')) {
        throw 'Run npm ci inside the crosscheck directory first.'
    }
    node scripts/run-framework.mjs dev
} finally {
    Pop-Location
}
