Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$width = 1440
$height = 900
$bmp = New-Object System.Drawing.Bitmap($width, $height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$size = New-Object System.Drawing.Size($width, $height)
$g.CopyFromScreen(0, 0, 0, 0, $size)

$dest = "c:\Users\Aaryan shukla\OneDrive\Desktop\UI-TARS-desktop-main\runs\test_capture.png"
$bmp.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
Write-Host "Success: saved to $dest"
