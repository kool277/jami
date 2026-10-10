/*
 * Copyright (C) 2022-2025 Savoir-faire Linux Inc.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation; either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public
 * License along with this program.  If not, see
 * <https://www.gnu.org/licenses/>.
 */

import * as http from 'node:http'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

import { app, BrowserWindow, ipcMain, Menu, utilityProcess } from 'electron'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = 8080
const SERVER_URL = `http://localhost:${PORT}`
const isMac = process.platform === 'darwin'

let serverProcess: ReturnType<typeof utilityProcess.fork> | null = null

function startServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    const serverScript = path.join(__dirname, '../../server/dist/index.js')
    const serverDir = path.join(__dirname, '../../server')

    serverProcess = utilityProcess.fork(serverScript, [], {
      cwd: serverDir,
      env: {
        ...process.env,
        JAMI_ELECTRON: 'true',
        NODE_ENV: 'production',
      },
    })

    serverProcess.on('exit', (code: number) => {
      if (code !== 0) {
        console.error(`Server process exited with code ${code}`)
      }
      serverProcess = null
    })

    // Poll until the server is ready
    const maxAttempts = 60
    let attempts = 0
    const interval = setInterval(() => {
      attempts++
      http
        .get(`${SERVER_URL}/api/admin/check`, (res) => {
          if (res.statusCode === 200) {
            clearInterval(interval)
            resolve()
          }
        })
        .on('error', () => {
          if (attempts >= maxAttempts) {
            clearInterval(interval)
            reject(new Error('Server failed to start within timeout'))
          }
        })
    }, 500)
  })
}

async function createWindow() {
  const preloadPath = path.join(__dirname, 'preload.js')

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 12, y: 12 },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
    },
  })

  win.loadURL(SERVER_URL)
}

app.whenReady().then(async () => {
  // IPC handlers for frameless window controls
  ipcMain.on('window-minimize', () => {
    BrowserWindow.getFocusedWindow()?.minimize()
  })
  ipcMain.on('window-maximize', () => {
    const win = BrowserWindow.getFocusedWindow()
    if (win?.isMaximized()) {
      win.unmaximize()
    } else {
      win?.maximize()
    }
  })
  ipcMain.on('window-close', () => {
    BrowserWindow.getFocusedWindow()?.close()
  })

  // Application menu
  const menuTemplate: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [{ role: 'front' as const }] : [{ role: 'close' as const }]),
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate))

  try {
    await startServer()
    await createWindow()
  } catch (e) {
    console.error('Failed to start:', e)
    app.quit()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill()
    serverProcess = null
  }
})
