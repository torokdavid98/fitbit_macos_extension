import { join } from 'path'
import { config as loadEnv } from 'dotenv'
import { app, BrowserWindow, Menu, nativeImage, Tray } from 'electron'
import { registerIpc } from './ipc'

let widget: BrowserWindow | null = null
let tray: Tray | null = null

// Load credentials: project root in dev (cwd), userData/.env in a packaged app.
function loadCredentials(): void {
  loadEnv() // cwd/.env (dev)
  loadEnv({ path: join(app.getPath('userData'), '.env') }) // packaged app
}

function createWidget(): BrowserWindow {
  const win = new BrowserWindow({
    width: 320,
    height: 760,
    show: false,
    frame: false,
    resizable: false,
    fullscreenable: false,
    transparent: true,
    vibrancy: 'under-window',
    visualEffectState: 'active',
    skipTaskbar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // electron-vite injects the dev server URL; falls back to built file in prod.
  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  win.on('blur', () => win.hide())
  return win
}

function toggleWidget(): void {
  if (!widget) return
  if (widget.isVisible()) {
    widget.hide()
    return
  }
  positionUnderTray()
  widget.show()
  widget.focus()
}

// Anchor the widget just below the menubar tray icon.
function positionUnderTray(): void {
  if (!widget || !tray) return
  const trayBounds = tray.getBounds()
  const { width } = widget.getBounds()
  const x = Math.round(trayBounds.x + trayBounds.width / 2 - width / 2)
  const y = Math.round(trayBounds.y + trayBounds.height + 4)
  widget.setPosition(x, y, false)
}

function buildTrayMenu(): Menu {
  return Menu.buildFromTemplate([
    { label: 'Show widget', click: toggleWidget },
    {
      label: 'Launch at login',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked })
    },
    { type: 'separator' },
    { label: 'Quit', role: 'quit' }
  ])
}

function createTray(): void {
  // Empty template image -> macOS shows the text title only. Template mode
  // adapts to light/dark menubar. Replace with a real icon asset later.
  tray = new Tray(nativeImage.createEmpty())
  tray.setTitle('❤︎')
  tray.setToolTip('Fitbit macOS Extension')
  // left click toggles the widget; right click opens the menu
  tray.on('click', toggleWidget)
  tray.on('right-click', () => tray?.popUpContextMenu(buildTrayMenu()))
}

app.whenReady().then(() => {
  loadCredentials()
  app.dock?.hide() // menubar-only, no dock icon
  registerIpc()
  widget = createWidget()
  createTray()
})

// Menubar app: don't quit when the window closes.
app.on('window-all-closed', () => {
  /* keep running in the tray */
})
