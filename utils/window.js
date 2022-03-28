const { app, BrowserWindow, session, globalShortcut, ipcMain } = require('electron');

function createMainWindow() {
    const win = new BrowserWindow({
        width: 1290,
        height: 750,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false,
            webviewTag: true,
        },
        icon: 'ui/icon.png'
    })
    win.loadFile('ui/index.html');
    return win;
}

function createResourceWindow(url) {
    const win = new BrowserWindow({
        width: 1290,
        height: 750,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false,
            webviewTag: true,
        },
        icon: 'ui/icon.png'
    })
    win.loadURL(url, {userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.82 Safari/537.36'});
    return win;
}

module.exports = {
    createMainWindow,
    createResourceWindow
}