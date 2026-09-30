
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$w = 2880
$h = 1800
$bmp = New-Object System.Drawing.Bitmap($w, $h)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen(0, 0, 0, 0, (New-Object System.Drawing.Size($w, $h)))
$bmp.Save('scratch\test3_excel_tabular.jpg', [System.Drawing.Imaging.ImageFormat]::Jpeg)
$g.Dispose()
$bmp.Dispose()
