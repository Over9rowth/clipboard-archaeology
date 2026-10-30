import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

const root = path.resolve(import.meta.dirname, '..');

// 清理 ELECTRON_RUN_AS_NODE 环境变量
delete process.env.ELECTRON_RUN_AS_NODE;

app.whenReady().then(async () => {
  console.log('Smoke test starting...');

  const win = new BrowserWindow({
    width: 1024,
    height: 700,
    show: false,
    webPreferences: {
      preload: path.join(root, 'dist/preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  await win.loadFile(path.join(root, 'dist/renderer/index.html'));

  // 延时等待 React 渲染并验证 DOM 元素
  await new Promise(r => setTimeout(r, 2000));

  const result = await win.webContents.executeJavaScript(`
    (() => {
      const title = document.querySelector('h1')?.innerText || '';
      const cards = document.querySelectorAll('.history-card').length;
      const statusText = document.getElementById('smoke-status-text')?.innerText || '';
      const statValues = Array.from(document.querySelectorAll('.stat-value')).map(el => el.innerText);
      return { title, cards, statusText, statValues };
    })()
  `);

  console.log('Render inspection result:', result);

  if (!result.title.includes('剪贴板考古台')) {
    console.error('Smoke failed: Title mismatch');
    app.exit(1);
  }

  if (result.cards < 10) {
    console.error(`Smoke failed: Expected >= 10 cards, got ${result.cards}`);
    app.exit(1);
  }

  // 检查说明书 PDF 是否有效存在
  const pdfPath = path.join(root, 'resources/剪贴板考古台-0.1.0-用户使用说明书.pdf');
  if (!fs.existsSync(pdfPath)) {
    console.error('Smoke failed: Manual PDF does not exist');
    app.exit(1);
  }
  const pdfBuf = fs.readFileSync(pdfPath);
  if (pdfBuf.length < 20000 || !pdfBuf.slice(0, 5).toString().startsWith('%PDF')) {
    console.error('Smoke failed: Manual PDF invalid or too small');
    app.exit(1);
  }

  console.log('SMOKE PASS');
  app.quit();
});
