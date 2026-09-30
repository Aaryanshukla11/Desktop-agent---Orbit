const { execSync } = require('child_process');
const fs = require('fs');

const ps = `
Get-Process | Where-Object { $_.ProcessName -match "notepad|calc|electron|orbit|ui-tars" } | Select-Object Id, ProcessName, MainWindowTitle, MainWindowHandle | Format-Table -AutoSize
`;
fs.writeFileSync('scratch/temp_win.ps1', ps);
console.log(execSync('powershell -ExecutionPolicy Bypass -File scratch/temp_win.ps1').toString());
