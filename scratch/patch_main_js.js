const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, '../apps/ui-tars/dist/main/main.js');
let content = fs.readFileSync(targetFile, 'utf8');

const targetStr = `      if (action_type === "click" || action_type === "left_click" || action_type === "left_single") {
        if (startX !== null && startY !== null) {
          logger.info(\`[NutJSElectronOperator] click at (\${startX}, \${startY})\`);
          await distExports$2.mouse.setPosition(new distExports$2.Point(startX, startY));
          await sleep$2(50);
          await distExports$2.mouse.click(distExports$2.Button.LEFT);
        }
        return { status: agent_StatusEnum.RUNNING };
      }
      if (action_type === "left_double" || action_type === "double_click") {
        if (startX !== null && startY !== null) {
          logger.info(\`[NutJSElectronOperator] doubleClick at (\${startX}, \${startY})\`);
          await distExports$2.mouse.setPosition(new distExports$2.Point(startX, startY));
          await sleep$2(50);
          await distExports$2.mouse.doubleClick(distExports$2.Button.LEFT);
        }
        return { status: agent_StatusEnum.RUNNING };
      }
      if (action_type === "right_click" || action_type === "right_single") {
        if (startX !== null && startY !== null) {
          logger.info(\`[NutJSElectronOperator] rightClick at (\${startX}, \${startY})\`);
          await distExports$2.mouse.setPosition(new distExports$2.Point(startX, startY));
          await sleep$2(50);
          await distExports$2.mouse.click(distExports$2.Button.RIGHT);
        }
        return { status: agent_StatusEnum.RUNNING };
      }`;

const replacementStr = `      const runWindowsMouse = (action, x, y) => {
        try {
          const { execSync } = require('child_process');
          const path = require('path');
          const scriptPath = path.resolve(__dirname, '../../resources/windows_click.ps1');
          const fallbackScript = 'c:/Users/Aaryan shukla/OneDrive/Desktop/UI-TARS-desktop-main/scripts/windows_click.ps1';
          const finalScript = require('fs').existsSync(scriptPath) ? scriptPath : fallbackScript;
          execSync(\`powershell -NoProfile -ExecutionPolicy Bypass -File "\${finalScript}" \${action} \${Math.round(x)} \${Math.round(y)}\`);
          return true;
        } catch (e) {
          logger.error(\`[NutJSElectronOperator] windows_click.ps1 failed:\`, e);
          return false;
        }
      };
      if (action_type === "click" || action_type === "left_click" || action_type === "left_single") {
        if (startX !== null && startY !== null) {
          logger.info(\`[NutJSElectronOperator] click at (\${startX}, \${startY})\`);
          if (!runWindowsMouse('click', startX, startY)) {
            await distExports$2.mouse.setPosition(new distExports$2.Point(startX, startY));
            await sleep$2(50);
            await distExports$2.mouse.click(distExports$2.Button.LEFT);
          }
        }
        return { status: agent_StatusEnum.RUNNING };
      }
      if (action_type === "left_double" || action_type === "double_click") {
        if (startX !== null && startY !== null) {
          logger.info(\`[NutJSElectronOperator] doubleClick at (\${startX}, \${startY})\`);
          if (!runWindowsMouse('doubleClick', startX, startY)) {
            await distExports$2.mouse.setPosition(new distExports$2.Point(startX, startY));
            await sleep$2(50);
            await distExports$2.mouse.doubleClick(distExports$2.Button.LEFT);
          }
        }
        return { status: agent_StatusEnum.RUNNING };
      }
      if (action_type === "right_click" || action_type === "right_single") {
        if (startX !== null && startY !== null) {
          logger.info(\`[NutJSElectronOperator] rightClick at (\${startX}, \${startY})\`);
          if (!runWindowsMouse('rightClick', startX, startY)) {
            await distExports$2.mouse.setPosition(new distExports$2.Point(startX, startY));
            await sleep$2(50);
            await distExports$2.mouse.click(distExports$2.Button.RIGHT);
          }
        }
        return { status: agent_StatusEnum.RUNNING };
      }`;

const isCRLF = content.includes('\r\n');
if (isCRLF) {
  content = content.replace(/\r\n/g, '\n');
}

if (!content.includes(targetStr)) {
  console.log('Target string not found in main.js!');
  process.exit(1);
}

content = content.replace(targetStr, replacementStr);
if (isCRLF) {
  content = content.replace(/\n/g, '\r\n');
}
fs.writeFileSync(targetFile, content, 'utf8');
console.log('Successfully patched apps/ui-tars/dist/main/main.js with runWindowsMouse!');
