/* ============================================================
   برنامه آمار غذا — نسخه دسکتاپ ویندوز (Electron)
   فایل‌های وب برنامه از پوشه app/ بارگیری می‌شوند.
   ============================================================ */
const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path');

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: 'برنامه آمار غذا',
    icon: path.join(__dirname, 'app', 'assets', 'icon.ico'),
    autoHideMenuBar: true,      // نوار منو مخفی است؛ با کلید Alt ظاهر می‌شود
    show: false,                // تا کامل آماده نشود نمایش داده نمی‌شود (بدون فلش سفید)
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  });

  win.loadFile(path.join(__dirname, 'app', 'index.html'));

  win.once('ready-to-show', () => { win.maximize(); win.show(); });

  // لینک‌های خارجی در مرورگر باز شوند نه داخل برنامه
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) { shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'allow' };
  });

  // منوی فارسی ساده
  const menu = Menu.buildFromTemplate([
    {
      label: 'برنامه',
      submenu: [
        {
          label: 'چاپ (Ctrl+P)',
          accelerator: 'CmdOrCtrl+P',
          click: () => win.webContents.executeJavaScript('typeof openPrintDialog==="function" && openPrintDialog()')
        },
        { type: 'separator' },
        { label: 'بارگذاری مجدد', role: 'reload' },
        { label: 'تمام‌صفحه', role: 'togglefullscreen' },
        { type: 'separator' },
        { label: 'خروج', role: 'quit' }
      ]
    },
    {
      label: 'نما',
      submenu: [
        { label: 'بزرگ‌نمایی', role: 'zoomIn' },
        { label: 'کوچک‌نمایی', role: 'zoomOut' },
        { label: 'اندازه واقعی', role: 'resetZoom' }
      ]
    },
    {
      label: 'راهنما',
      submenu: [
        {
          label: 'درباره',
          click: () => dialog.showMessageBox(win, {
            type: 'info',
            title: 'درباره برنامه',
            message: 'برنامه آمار غذا',
            detail: 'ثبت و چاپ آمار ناهار، عصرانه و شام پرسنل\nپشتیبانی از همه پرینترها از جمله پرینتر حرارتی رولی\n\nنسخه ' + app.getVersion()
          })
        }
      ]
    }
  ]);
  Menu.setApplicationMenu(menu);
}

// فقط یک نسخه از برنامه اجرا شود
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });
  app.whenReady().then(createWindow);
}
app.on('window-all-closed', () => app.quit());
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
