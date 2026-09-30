const { execSync } = require('child_process');

try {
  const psCmd = `Get-Process | Where-Object { [string]::IsNullOrWhiteSpace($_.MainWindowTitle) -eq $false } | ForEach-Object { "$($_.Id) | $($_.ProcessName) | $($_.MainWindowTitle)" }`;
  const out = execSync(`powershell -NoProfile -Command "${psCmd}"`).toString();
  console.log("Visible Windows:\n" + out);
} catch (e) {
  console.log("Error:", e.message);
}
