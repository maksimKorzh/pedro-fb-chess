// Packeges
const { app, BrowserWindow, ipcMain, Menu } = require("electron");
const { spawn } = require('child_process');
const WebSocket = require("ws");

// App globals
var socket = null;
var fbCredentials = null;
var engine = null;

// DEBUG
fbCredentials = {
    id: '29468922622700128',
    locale: 'en_GB',
    name: null,
    photo: null,
    signature: 'i-XwFMGTd1e3LmhELauJBpKKpQLqwClPvKlGUB09p4U.eyJhbGdvcml0aG0iOiJITUFDLVNIQTI1NiIsImlzc3VlZF9hdCI6MTc5MzM2OTE4NiwicGxheWVyX2lkIjoiMjk0Njg5MjI2MjI3MDAxMjgiLCJyZXF1ZXN0X3BheWxvYWQiOiJoZWxsbyJ9',
    timestamp: 1793369186350
};

/*******************************\
 ===============================
            
              ENGINE
            
 ===============================
\*******************************/

// Hook chess engine
function initEngine(sender) {
    engine = spawn( "./stockfish", { detached: true, stdio: ["pipe", "pipe", "pipe"] });
    engine.stdout.on("data", (data) => {
        let response = data.toString();
        if (response.includes("bestmove")) {
            let move = response.split("bestmove ")[1].split(" ")[0];
            sender.send("data", "uci:" + move + "\n");
        }
        console.log("ENGINGE:", response);
    }); engine.on("exit", (code, signal) => { console.error("engine: exited"); });
    engine.on("error", (err) => { console.error("engine:", err); });
    engine.stderr.on("data", (data) => { console.log("engine:", data.toString()); });
}

/*******************************\
 ===============================
            
            WEB SOCKET
            
 ===============================
\*******************************/

//

// Login via facebook instant games
function fbLogin(win) {
    win.loadURL("https://www.facebook.com/gaming/play/194060244713436/");
    const interval = setInterval(async () => {
        const frames = win.webContents.mainFrame.framesInSubtree;
        for (const frame of frames) {
            if (!frame.url.includes("194060244713436")) continue;
            try {
                const credentials = await frame.executeJavaScript(`
                    (async () => {
                        if (!window.FBInstant) { throw new Error("FBInstant is unavailable"); }
                        const signedInfo = await FBInstant.player.getSignedPlayerInfoAsync("hello");
                        let playerId = FBInstant.player.getID();
                        if (playerId == null || playerId === "") playerId = signedInfo.getPlayerID();
                        return {
                            id: playerId,
                            name: FBInstant.player.getName?.() ?? null,
                            photo: FBInstant.player.getPhoto?.() ?? null,
                            signature: signedInfo.getSignature(),
                            locale: FBInstant.getLocale(),
                            timestamp: Date.now()
                        };
                    })();
                `); if (credentials?.id && credentials?.signature) {
                    fbCredentials = credentials;
                    console.log("Credentials stored globally:", fbCredentials);
                    clearInterval(interval);
                    await win.loadFile("ui.html");
                    break;
                }
            } catch (err) { console.log("Waiting for credentials:", err.message); }
        }
    }, 3000);
}

// Connect to WebSocket
function connect(sender) {
    socket = new WebSocket("wss://chess.game8.io/ws/gameServer", { headers: { "Origin": "null" } });
    socket.on("open", function () {
        let login = "0268113239343638393232363232373030313238000000bc486173685256385f4f6d576a4631594746796c6a58495277784f73416658385a5774464a7272767a4d6d772e65794a6862476476636d6c30614730694f694a49545546444c564e49515449314e694973496d6c7a6333566c5a463968644349364d5463354d7a45784d6a45354f437769634778686557567958326c6b496a6f694d6a6b304e6a67354d6a49324d6a49334d4441784d6a67694c434a795a5846315a584e305833426865577876595751694f694a6f5a57787362794a3900000005656e5f47420a464249475f434845535305352e302e31196c617374506f7075703d3d313739333130393036363637350a0563686573730100000000000000000001";
        socket.send(Buffer.from(login, "hex"));
        sender.send("data", "Connected to WebSocket\n");
        setInterval(function() { socket.send(Buffer.from("012d", "hex")); }, 10000);
    });
    socket.on("message", function (data) { sender.send("data", Buffer.from(data).toString("hex") + "\n"); });
    socket.on("error", function (error) { sender.send("data", "WebSocket error\n"); });
    socket.on("close", function () { sender.send("data", "WebSocket connection closed.\n"); }); return socket;
}

/*******************************\
 ===============================
            
               UI
            
 ===============================
\*******************************/

// Main window
function createWindow() {
    const win = new BrowserWindow({
        fullscreen: false,
        width: 1024,
        minWidth:1024,
        height: 518,
        webPreferences: { preload: __dirname + "/preload.js" }
    }); const template = [
        {
            label: "View",
            submenu: [
                { label: "Reload", role: "reload" },
                { label: "Toggle Developer Tools", role: "toggleDevTools" },
                { label: "Fullscreen", role: "togglefullscreen" },
                { label: "Exit", role: "quit" },
            ]
        }
    ]; const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
    //fbLogin(win);
    win.loadFile("ui.html"); 
    win.maximize();
    win.on("close", () => { if (socket) socket.close(); });
} app.whenReady().then(createWindow);
app.on("quit", () => { if (socket) socket.close(); });
ipcMain.on("command", (event, command) => {
    if (command == "connect") {
        initEngine(event.sender);
        connect(event.sender);
    } else if (command == "disconnect") {
        if (socket) socket.close();
        if (engine) engine.kill();
    } else if (command.includes("uci:")) {
        command = command.split("uci:")[1];
        engine.stdin.write(command + "\n");
    } else socket.send(Buffer.from(command, "hex"));
});