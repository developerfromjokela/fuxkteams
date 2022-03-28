const { app, BrowserWindow, session, globalShortcut, ipcMain } = require('electron');
const debug = process.env.ADFRIFY_DEBUG || false;


//const DBus = require('dbus');
function createWindow () {
    const win = new BrowserWindow({
        width: 1290,
        height: 750,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false,
            webviewTag: true
        },
        icon: 'icon.png'
    })
    win.loadFile('index.html');
    return win;
}

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit()
})

function sendEvent(window, name, ...args) {
    if (window != null) {
        ipcMain.emit(name);
    }
}


app.whenReady().then(() => {
    let win = createWindow();
})

