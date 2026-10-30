// Copyright (C) 2026 Over9rowth
// SPDX-License-Identifier: GPL-3.0-only
// Electron 主进程
import { app, BrowserWindow, ipcMain, clipboard, dialog, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

const isDev = process.env.NODE_ENV === 'development';
const PRODUCT_NAME = '剪贴板考古台';

// Squirrel 安装/更新/卸载生命周期处理
const squirrelEvent = process.platform === 'win32'
  ? ['--squirrel-install', '--squirrel-updated', '--squirrel-uninstall', '--squirrel-obsolete'].find((a) => process.argv.includes(a))
  : undefined;

if (squirrelEvent) {
  try {
    const exeName = path.basename(process.execPath);
    const appDir = path.resolve(path.dirname(process.execPath), '..');
    const stub = path.join(appDir, exeName);
    const startMenu = path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs');
    const links = [
      path.join(startMenu, PRODUCT_NAME + '.lnk'),
      path.join(startMenu, 'Over9rowth', PRODUCT_NAME + '.lnk'),
      path.join(app.getPath('desktop'), PRODUCT_NAME + '.lnk')
    ];
    const removing = squirrelEvent === '--squirrel-uninstall' || squirrelEvent === '--squirrel-obsolete';
    if (removing) {
      for (const lnk of links) {
        try { fs.unlinkSync(lnk); } catch { /* ignore */ }
      }
      try {
        const overDir = path.join(startMenu, 'Over9rowth');
        if (fs.existsSync(overDir) && fs.readdirSync(overDir).length === 0) {
          fs.rmdirSync(overDir);
        }
      } catch { /* ignore */ }
    } else {
      for (const lnk of links) {
        shell.writeShortcutLink(lnk, 'create', {
          target: stub,
          args: '',
          icon: stub,
          iconIndex: 0,
          description: PRODUCT_NAME
        });
      }
    }
  } catch {
    try {
      const exeName = path.basename(process.execPath);
      const updateExe = path.resolve(path.dirname(process.execPath), '..', 'Update.exe');
      const args = squirrelEvent === '--squirrel-uninstall' || squirrelEvent === '--squirrel-obsolete'
        ? ['--removeShortcut', exeName] : ['--createShortcut', exeName];
      require('node:child_process').spawnSync(updateExe, args, { timeout: 20000, windowsHide: true, stdio: 'ignore' });
    } catch { /* ignore */ }
  }
  app.exit(0);
}

app.disableHardwareAcceleration();

let win: BrowserWindow | null = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 880,
    minHeight: 600,
    title: PRODUCT_NAME,
    show: true,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.on('page-title-updated', (e) => e.preventDefault());
  win.setMenuBarVisibility(false);

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  ipcMain.handle('read-clipboard-text', () => {
    try {
      return clipboard.readText();
    } catch (e) {
      return '';
    }
  });

  ipcMain.handle('write-clipboard-text', (_, text: string) => {
    try {
      clipboard.writeText(text);
      return true;
    } catch (e) {
      return false;
    }
  });

  ipcMain.handle('export-report', async (_, jsonContent: string) => {
    if (!win) return false;
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: '导出剪贴板考古安全报告',
      defaultPath: '剪贴板考古报告.json',
      filters: [{ name: 'JSON 数据文件', extensions: ['json'] }]
    });
    if (canceled || !filePath) return false;
    fs.writeFileSync(filePath, jsonContent, 'utf8');
    return true;
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
});
