# Import bazy pytan z Excela (xlsx) do questions.js. Bez Node/Pythona: czyta XML arkusza bezposrednio z archiwum.
# Uzycie: powershell -ExecutionPolicy Bypass -File dev\import.ps1 <plik.xlsx> [questions.js]
# Kolumny arkusza 1 (wiersz 1 = naglowki): A ID, D Poziom trudnosci, E Pytanie, F-I odpowiedzi A-D, J poprawna (litera).
# Poziom: "Bardzo latwy"=1, "Latwy"=2, "Sredni"=3, "Trudny"=4, "Ekspercki"=5.
# Plik trzymaj w ASCII (PowerShell 5.1 czyta skrypt jako ANSI); polskie znaki tylko jako ~XXXX przez Expand-Pl.
param([Parameter(Mandatory = $true)][string]$Xlsx, [string]$Out)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$root = Split-Path -Parent $PSScriptRoot
if (-not $Out) { $Out = Join-Path $root 'questions.js' }
$Xlsx = (Resolve-Path $Xlsx).Path

$zip = [IO.Compression.ZipFile]::OpenRead($Xlsx)
try {
  $entry = $zip.GetEntry('xl/worksheets/sheet1.xml')
  if (-not $entry) { throw 'Brak arkusza xl/worksheets/sheet1.xml' }
  $rd = New-Object IO.StreamReader($entry.Open(), [Text.Encoding]::UTF8)
  [xml]$sheet = $rd.ReadToEnd(); $rd.Close()
  # Wspolne napisy (gdy Excel zapisal komorki jako t="s").
  $shared = @()
  $se = $zip.GetEntry('xl/sharedStrings.xml')
  if ($se) {
    $rd = New-Object IO.StreamReader($se.Open(), [Text.Encoding]::UTF8)
    [xml]$ss = $rd.ReadToEnd(); $rd.Close()
    $shared = @($ss.sst.si | ForEach-Object { $_.InnerText })
  }
} finally { $zip.Dispose() }

function Get-Cell($c) {
  if ($c.t -eq 'inlineStr') { return $c.is.InnerText }
  if ($c.t -eq 's') { return $shared[[int]$c.v] }
  return [string]$c.v
}
function Get-Tier([string]$s) {
  $s = $s.Trim()
  if ($s -like 'Bardzo*') { return 1 }
  if ($s -like '?atwy') { return 2 }
  if ($s -like '?redni') { return 3 }
  if ($s -like 'Trudny') { return 4 }
  if ($s -like 'Eksperck*') { return 5 }
  return 0
}
function ConvertTo-Js([string]$s) {
  $s = ($s -replace '\s+', ' ').Trim()
  return "'" + $s.Replace('\', '\\').Replace("'", "\'") + "'"
}

$lines = New-Object Collections.Generic.List[string]
$errors = New-Object Collections.Generic.List[string]
$ids = @{}; $texts = @{}; $count = @{ 1 = 0; 2 = 0; 3 = 0; 4 = 0; 5 = 0 }
$rows = @($sheet.worksheet.sheetData.row) | Select-Object -Skip 1
foreach ($row in $rows) {
  $v = @{}
  foreach ($c in @($row.c)) { $col = ($c.r -replace '\d', ''); $v[$col] = Get-Cell $c }
  $n = $row.r
  $id = [string]$v['A']; $q = [string]$v['E']
  if (-not $id -and -not $q) { continue }
  $a = @([string]$v['F'], [string]$v['G'], [string]$v['H'], [string]$v['I']) | ForEach-Object { ($_ -replace '\s+', ' ').Trim() }
  $tier = Get-Tier ([string]$v['D'])
  $ok = 'ABCD'.IndexOf(([string]$v['J']).Trim().ToUpper())
  $qt = ($q -replace '\s+', ' ').Trim()
  $bad = @()
  if (-not $id) { $bad += 'brak ID' } elseif ($ids.ContainsKey($id)) { $bad += "powtorzone ID $id" }
  if ($tier -eq 0) { $bad += "nieznany poziom '$($v['D'])'" }
  if (-not $qt -or $qt.Length -gt 300) { $bad += 'pytanie puste albo > 300 znakow' }
  if (@($a | Where-Object { -not $_ -or $_.Length -gt 120 }).Count) { $bad += 'odpowiedz pusta albo > 120 znakow' }
  if (@($a | Select-Object -Unique).Count -ne 4) { $bad += 'powtorzone odpowiedzi' }
  if ($ok -lt 0 -or ([string]$v['J']).Trim().Length -ne 1) { $bad += "zla poprawna '$($v['J'])'" }
  if ($bad.Count) { $errors.Add("wiersz ${n} ($id): " + ($bad -join '; ')); continue }
  if ($texts.ContainsKey($qt.ToLower())) { Write-Host "Uwaga: wiersz $n ($id) ma te sama tresc co $($texts[$qt.ToLower()])" }
  $ids[$id] = 1; $texts[$qt.ToLower()] = $id; $count[$tier]++
  $lines.Add("  { id: $(ConvertTo-Js $id), d: $tier, q: $(ConvertTo-Js $qt), a: [$(($a | ForEach-Object { ConvertTo-Js $_ }) -join ', ')], ok: $ok },")
}

if ($errors.Count) {
  Write-Host "Bledy ($($errors.Count)) - questions.js NIE zostal zapisany:"
  $errors | ForEach-Object { Write-Host "  $_" }
  exit 1
}
foreach ($t in 1..5) { if (-not $count[$t]) { Write-Host "Brak pytan na stopien $t - questions.js NIE zostal zapisany."; exit 1 } }

$src = Split-Path -Leaf $Xlsx
function Expand-Pl([string]$s) { [regex]::Replace($s, '~([0-9a-f]{4})', { param($m) [string][char][Convert]::ToInt32($m.Groups[1].Value, 16) }) }
$head = Expand-Pl("/* Baza pyta~0144 teleturnieju Milion. PLIK GENEROWANY przez dev/import.ps1 z ""$src"" ~2014 nie edytuj r~0119cznie, popraw Excel i uruchom import.`n" +
  "   Format: { id, d: stopie~0144 trudno~015bci 1..5 (bardzo ~0142atwy, ~0142atwy, ~015bredni, trudny, ekspercki), q, a: [4 odpowiedzi], ok: indeks poprawnej 0..3 }.`n" +
  "   Kt~00f3re stopnie trafiaj~0105 na kt~00f3re z 12 pyta~0144, decyduje ML.DIFFS (ml.js). Kolejno~015b~0107 odpowiedzi jest tasowana przy losowaniu. */")
$js = $head + "`nwindow.ML_QUESTIONS = [`n" + ($lines -join "`n") + "`n];`n"
[IO.File]::WriteAllText($Out, $js, (New-Object Text.UTF8Encoding($false)))
Write-Host "Zapisano $($lines.Count) pytan do $Out"
foreach ($t in 1..5) { Write-Host "  stopien ${t}: $($count[$t])" }
