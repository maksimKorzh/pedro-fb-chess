const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("fbchess", {
    sendCommand: (cmd) => ipcRenderer.send("command", cmd),
    onData: (callback) => ipcRenderer.on("data", (_, data) => callback(data))
});