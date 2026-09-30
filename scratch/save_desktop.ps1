Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size)

$dest = "c:\Users\Aaryan shukla\OneDrive\Desktop\UI-TARS-desktop-main\runs\real_desktop_check.png"
$bmp.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "Desktop saved to $dest"
