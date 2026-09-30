Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Bitmap]::FromFile("$PSScriptRoot\..\runs\current_desktop.jpg")

# Search for the Notepad icon in the bottom region (Y from 800 to 900)
# Notepad icon in Windows 11 has a blue cover and white paper with horizontal lines
for ($y = 800; $y -lt $img.Height; $y += 5) {
    for ($x = 400; $x -lt 800; $x += 5) {
        $p = $img.GetPixel($x, $y)
        # Look for the bright blue / cyan bookmark or white notepad paper
        if ($p.R -gt 200 -and $p.G -gt 200 -and $p.B -gt 200) {
            Write-Host "Bright pixel at ($x, $y): R=$($p.R) G=$($p.G) B=$($p.B)"
        }
    }
}
$img.Dispose()
