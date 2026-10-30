// Packeges
const { app, BrowserWindow, ipcMain, Menu } = require("electron");
const { spawn } = require('child_process');
const WebSocket = require("ws");

// App globals
var socket = null;
var fbCredentials = null;
var engine = null;

// WebSocket opcodes
const OPCODES = {
    "LOGIN_FB_SIGNATURE2": 616
};

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

// Convert string to Int8Array
function asciiTOint8(str) {
    const result = new Int8Array(str.length);
    for (let i = 0; i < str.length; i++) result[i] = str.charCodeAt(i);
    return result;
}

// Convert string to 16-bit character bytes
function strTOint8(str) {
    const result = new Int8Array(2 * str.length);
    for (let i = 0; i < str.length; i++) {
        const charCode = str.charCodeAt(i);
        result[2 * i] = charCode >> 8;
        result[2 * i + 1] = charCode;
    } return result;
}

// Write Byte
function writeByte(val, buf) {
    buf.data.push(new Int8Array([val]));
    buf.length++;
}

// Write 16-bit integer (2 bytes)
function writeShort(val, buf) {
    buf.data.push(new Int8Array([val >> 8, val]));
    buf.length += 2;
}

// Write 32-bit integer (4 bytes)
function writeInt(val, buf) {
    buf.data.push(new Int8Array([val >> 24, val >> 16, val >> 8, val]));
    buf.length += 4;
}

// Write 64-bit integer (8 bytes)
function writeLong(val, buf) {
    let negative = false;
    if (val < 0) {
        val = 0x8000000000000000n + BigInt(val) + 1n;
        negative = true;
    } else val = BigInt(val);
    const bytes = new Int8Array([
        Number((val >> 56n) & 0xFFn),
        Number((val >> 48n) & 0xFFn),
        Number((val >> 40n) & 0xFFn),
        Number((val >> 32n) & 0xFFn),
        Number((val >> 24n) & 0xFFn),
        Number((val >> 16n) & 0xFFn),
        Number((val >> 8n) & 0xFFn),
        Number(val & 0xFFn)
    ]); if (negative) bytes[0] |= 128;
    buf.data.push(bytes);
    buf.length += 8;
}
    
// Write ASCII
function writeAscii(str, buf) {
    if (str == null) str = "";
    if (str.length > 255) str = str.substring(0, 255);
    writeByte(str.length, buf);
    buf.data.push(asciiTOint8(str));
    buf.length += str.length;
}

// Write long ASCII
function writeLongAscii(str, buf) {
    if (str == null) str = "";
    writeInt(str.length, buf);
    buf.data.push(asciiTOint8(str));
    buf.length += str.length;
}

// Write string (2-byte length prefix)
function writeString(str, buf) {
    if (str == null) str = "";
    writeShort(str.length, buf);
    buf.data.push(strTOint8(str));
    buf.length += 2 * str.length;
}

// Login FB signature
function loginFbSignature2() {
    let token = { data: [], length: 0 };
    writeShort(OPCODES["LOGIN_FB_SIGNATURE2"], token);
    writeAscii(fbCredentials.id, token);
    writeLongAscii(fbCredentials.signature, token);
    writeString(fbCredentials.name, token);
    writeAscii(fbCredentials.photo, token);
    writeAscii(fbCredentials.locale, token);
    writeAscii("FBIG_CHESS", token);
    writeAscii("5.0.1", token);
    writeAscii(null, token);
    writeAscii("chess", token);
    writeByte(1, token);
    writeLong(0, token);
    writeAscii(null, token);
    writeByte(1, token);
    return Buffer.concat(token.data.map(chunk => Buffer.from(chunk)));
}

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
        let login = loginFbSignature2();
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
    win.loadFile("ui.html"); // DEBUG
    win.maximize();
    win.on("close", () => { if (socket) socket.close(); });
} app.whenReady().then(createWindow);
app.on("quit", () => { if (socket) socket.close(); });
ipcMain.on("gui", (event, command) => {
    console.log(`GUI: ${command}`)
    if (command == "connect") {
        initEngine(event.sender);
        connect(event.sender);
    } else if (command == "disconnect") {
        if (socket) socket.close();
        if (engine) engine.kill();
    } else socket.send(Buffer.from(command, "hex"));
});

ipcMain.on("uci", (event, command) => {
    console.log(`UCI: ${command}`)
    engine.stdin.write(command + "\n");
});


