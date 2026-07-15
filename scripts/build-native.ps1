$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
$Native = Join-Path $Root 'native\windows-audio-helper'
$Bin = Join-Path $Native 'bin'
$VsWhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
$VsPath = & $VsWhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (-not $VsPath) { throw 'MSVC x64 toolchain not found' }

$DevCmd = Join-Path $VsPath 'Common7\Tools\VsDevCmd.bat'
New-Item -ItemType Directory -Force -Path $Bin | Out-Null

$Compile = 'call "{0}" -arch=x64 -host_arch=x64 && cl /nologo /std:c++17 /EHsc /W4 /DUNICODE /D_UNICODE /Fe:"{1}" "{2}\main.cpp" "{2}\wasapi_capture.cpp" "{2}\audio_processing.cpp" ole32.lib uuid.lib avrt.lib' -f $DevCmd, (Join-Path $Bin 'whisper-audio-helper.exe'), $Native
cmd.exe /d /s /c $Compile
if ($LASTEXITCODE -ne 0) { throw "Native helper compilation failed with exit code $LASTEXITCODE" }

$TestCompile = 'call "{0}" -arch=x64 -host_arch=x64 && cl /nologo /std:c++17 /EHsc /W4 /Fe:"{1}" "{2}\native_tests.cpp" "{2}\audio_processing.cpp"' -f $DevCmd, (Join-Path $Bin 'native-tests.exe'), $Native
cmd.exe /d /s /c $TestCompile
if ($LASTEXITCODE -ne 0) { throw "Native test compilation failed with exit code $LASTEXITCODE" }
& (Join-Path $Bin 'native-tests.exe')
if ($LASTEXITCODE -ne 0) { throw "Native tests failed with exit code $LASTEXITCODE" }
