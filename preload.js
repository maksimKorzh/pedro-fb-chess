const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("fbchess", {
    sendGUICommand: (cmd) => ipcRenderer.send("gui", cmd),
    sendUCICommand: (cmd) => ipcRenderer.send("uci", cmd),
    onData: (callback) => ipcRenderer.on("data", (_, data) => callback(data))
});