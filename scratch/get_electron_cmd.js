const { execSync } = require('child_process');

try {
  const ps = `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter 'Name = \\'electron.exe\\'' | Select-Object -Property ProcessId, CommandLine | ConvertTo-Json"`;
  const out = execSync(ps).toString();
  console.log(out);
} catch (e) {
  console.log("Error:", e.message);
}
