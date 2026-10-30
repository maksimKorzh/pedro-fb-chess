const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("fbchess", {
    sendGUICommand: (cmd) => ipcRenderer.send("gui", cmd),
    sendUCICommand: (cmd) => ipcRenderer.send("uci", cmd),
    onWebSocketMsg: (callback) => ipcRenderer.on("websocket", (_, data) => callback(data)),
    onEngineMsg: (callback) => ipcRenderer.on("engine", (_, data) => callback(data))
});