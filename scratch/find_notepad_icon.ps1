Add-Type -AssemblyName System.Drawing

$bmp = [System.Drawing.Bitmap]::FromFile("$PSScriptRoot\..\runs\t0_final_pass.jpg")

# Find where Notepad shortcut icon is in lower right
for ($y = 800; $y -lt 890; $y += 5) {
    for ($x = 750; $x -lt 900; $x += 10) {
        $c = $bmp.GetPixel($x, $y)
        # Notepad shortcut has cyan/blue icon
        if ($c.B -gt 150 -and $c.R -lt 100) {
            Write-Host "Blue icon pixel at ($x, $y): R=$($c.R), G=$($c.G), B=$($c.B)"
        }
    }
}
$bmp.Dispose()
