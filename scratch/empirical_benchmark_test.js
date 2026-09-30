const { execSync } = require('child_process');
const fs = require('fs');

console.log("=== EMPIRICAL TEST: MEASURING INPUT & COORDINATE SPEED ===");

// 1. Check primary screen dimensions via PowerShell
const screenInfo = execSync(`powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::PrimaryScreen.Bounds"`).toString().trim();
console.log("Primary Screen Bounds:\n", screenInfo);

// 2. Measure PowerShell cold-spawn latency
const t0 = Date.now();
execSync(`powershell -NoProfile -Command "exit"`);
const coldPsLatency = Date.now() - t0;
console.log(`Cold PowerShell Spawn Latency: ${coldPsLatency} ms`);

console.log("=== END TEST ===");
