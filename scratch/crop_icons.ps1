Add-Type -AssemblyName System.Drawing

$img = [System.Drawing.Bitmap]::FromFile("$PSScriptRoot\..\runs\t0_final_pass.jpg")

function CropAndSave($x, $y, $w, $h, $name) {
    $rect = New-Object System.Drawing.Rectangle($x, $y, $w, $h)
    $cropped = $img.Clone($rect, $img.PixelFormat)
    $cropped.Save("$PSScriptRoot\..\runs\$name.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $cropped.Dispose()
    Write-Host "Saved $name.png ($x, $y, $w, $h)"
}

# In 1440x900:
# Row 0 is at top: Y ~ 20 to 100
# Row 1: Y ~ 150 to 250
# Row 2: Y ~ 300 to 400
# Row 3: Y ~ 500 to 650 (test_notepad.txt is here!)
# Row 4: Y ~ 700 to 800
# Row 5: Y ~ 800 to 900 (bottom icons)

# Let's crop row 3 (where test_notepad is)
CropAndSave 400 500 250 150 "crop_test_notepad"
# Let's crop bottom row around col 5-6 (Notepad icon)
CropAndSave 500 800 150 100 "crop_notepad_icon"

$img.Dispose()
