Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Bitmap]::FromFile("$PSScriptRoot\..\runs\t0_final_pass.jpg")
$rect = New-Object System.Drawing.Rectangle(640, 560, 70, 70)
$cropped = $img.Clone($rect, $img.PixelFormat)
$cropped.Save("$PSScriptRoot\..\runs\crop_test_notepad_target.png", [System.Drawing.Imaging.ImageFormat]::Png)
$cropped.Dispose()
$img.Dispose()
Write-Host "Saved crop_test_notepad_target.png"
