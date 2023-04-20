const { Menu, MenuItem, ipcMain } = require('electron')
const file = require('../../utils/file.js')

const menuBarTemplate = [
  new MenuItem({
    label: 'File',
    submenu: [
      { 
        label: 'Open File...',
        accelerator: process.platform === 'darwin' ? 'Cmd+O' : 'Ctrl+O',
        click: (menuItem, browserWindow, event) => {
          file.openFile(browserWindow)
            .then(response => {
              if (response) {
                browserWindow.webContents.send('load-file', response)
              }
            })
        }
      },
      {
        label: 'Save',
        accelerator: process.platform === 'darwin' ? 'Cmd+S' : 'Ctrl+S',
        click: (menuItem, browserWindow, event) => {
          browserWindow.webContents.send('save')
        }
      },
      { role: 'quit' }
    ]
  }),
]

ipcMain.handle('save-file', (event, response) => {
  file.saveFile(response.path, response.content)
})

const menu = Menu.buildFromTemplate(menuBarTemplate)
Menu.setApplicationMenu(menu)