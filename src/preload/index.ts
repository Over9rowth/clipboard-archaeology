// Copyright (C) 2026 Over9rowth
// SPDX-License-Identifier: GPL-3.0-only
// Preload 桥接
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  readClipboard: () => ipcRenderer.invoke('read-clipboard-text'),
  writeClipboard: (text: string) => ipcRenderer.invoke('write-clipboard-text', text),
  exportReport: (jsonContent: string) => ipcRenderer.invoke('export-report', jsonContent)
});
