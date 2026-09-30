Add-Type -AssemblyName System.Drawing

$img = [System.Drawing.Bitmap]::FromFile("$PSScriptRoot\..\runs\t0_final_pass.jpg")
Write-Host "Image dimensions: $($img.Width)x$($img.Height)"

$whitePixels = @()
for ($y = 450; $y -lt 650; $y++) {
    for ($x = 600; $x -lt 750; $x++) {
        $px = $img.GetPixel($x, $y)
        # White paper has high brightness
        if ($px.R -gt 230 -and $px.G -gt 230 -and $px.B -gt 230) {
            $whitePixels += [PSCustomObject]@{ X = $x; Y = $y }
        }
    }
}

if ($whitePixels.Count -gt 0) {
    $minX = ($whitePixels | Measure-Object -Property X -Minimum).Minimum
    $maxX = ($whitePixels | Measure-Object -Property X -Maximum).Maximum
    $minY = ($whitePixels | Measure-Object -Property Y -Minimum).Minimum
    $maxY = ($whitePixels | Measure-Object -Property Y -Maximum).Maximum
    $centerX = [math]::Round(($minX + $maxX) / 2)
    $centerY = [math]::Round(($minY + $maxY) / 2)
    Write-Host "test_notepad icon bounding box: X=[$minX, $maxX], Y=[$minY, $maxY], Center=($centerX, $centerY)"
} else {
    Write-Host "No white pixels found for test_notepad"
}

# Scan Notepad shortcut around (750..850, 800..900)
$notepadPixels = @()
for ($y = 800; $y -lt 900; $y++) {
    for ($x = 750; $x -lt 860; $x++) {
        $px = $img.GetPixel($x, $y)
        # Blue shortcut arrow or cyan pad
        if ($px.B -gt 200 -and $px.G -gt 150) {
            $notepadPixels += [PSCustomObject]@{ X = $x; Y = $y }
        }
    }
}
if ($notepadPixels.Count -gt 0) {
    $minX = ($notepadPixels | Measure-Object -Property X -Minimum).Minimum
    $maxX = ($notepadPixels | Measure-Object -Property X -Maximum).Maximum
    $minY = ($notepadPixels | Measure-Object -Property Y -Minimum).Minimum
    $maxY = ($notepadPixels | Measure-Object -Property Y -Maximum).Maximum
    $centerX = [math]::Round(($minX + $maxX) / 2)
    $centerY = [math]::Round(($minY + $maxY) / 2)
    Write-Host "Notepad.lnk icon bounding box: X=[$minX, $maxX], Y=[$minY, $maxY], Center=($centerX, $centerY)"
}

$img.Dispose()
