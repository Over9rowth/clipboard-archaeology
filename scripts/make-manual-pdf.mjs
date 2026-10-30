import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

const root = path.resolve(import.meta.dirname, '..');
const manualPath = path.join(root, 'resources/manual.html');
const outPdfPath = path.join(root, 'resources/剪贴板考古台-0.1.0-用户使用说明书.pdf');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: false
    }
  });

  await win.loadFile(manualPath);
  const data = await win.webContents.printToPDF({
    printBackground: true,
    pageSize: 'A4'
  });

  fs.writeFileSync(outPdfPath, data);
  console.log(`PDF manual generated: ${outPdfPath} (${data.length} bytes)`);
  app.quit();
});
