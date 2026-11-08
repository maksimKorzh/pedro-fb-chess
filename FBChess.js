// Temp
DEBUG = true;

// Packeges
const { app, BrowserWindow, ipcMain, Menu } = require("electron");
const { spawn } = require('child_process');
const WebSocket = require("ws");

// App globals
var socket = null;
var fbCredentials = null;
var engine = null;

// App constants
const COORDS = [
    "a1", "b1", "c1", "d1", "e1", "f1", "g1", "h1",
    "a2", "b2", "c2", "d2", "e2", "f2", "g2", "h2",
    "a3", "b3", "c3", "d3", "e3", "f3", "g3", "h3",
    "a4", "b4", "c4", "d4", "e4", "f4", "g4", "h4",
    "a5", "b5", "c5", "d5", "e5", "f5", "g5", "h5",
    "a6", "b6", "c6", "d6", "e6", "f6", "g6", "h6",
    "a7", "b7", "c7", "d7", "e7", "f7", "g7", "h7",
    "a8", "b8", "c8", "d8", "e8", "f8", "g8", "h8",
];

const KEEP_ALIVE_INTERVAL = 7500;
const OPCODES = {
    "PONG": 300,
    "PING": 301,
    "ENTER_PLACE": 401,               // 0x0191
    "ENTER_CHILD_PLACE": 402,
    "CREATE_RULE": 405,
    "PLAYER_ENTERED": 406,
    "PLAYER_EXITED": 407,
    "KICK_PLAYER": 410,
    "TABLE_IN_ROOM_CHANGED": 415,
    "SLOT_IN_TABLE_CHANGED": 416,
    "START_MATCH": 417,
    "GAME_OVER": 418,
    "SET_TURN": 420,
    "SHOW_LUCKY_WHEEL": 424,
    "SET_PLAYER_STATUS": 421, // is ready
    "GET_CURRENT_PATH": 430,
    "OWNER_CHANGED": 432,
    "PLAY": 502,
    "MOVE": 529,
    "LOGIN_FB_SIGNATURE2": 616
};

if (DEBUG) {
    fbCredentials = {
        id: '29468922622700128',
        locale: 'en_GB',
        name: null,
        photo: null,
        signature: 'FkSdC6dMvchVq5kGJh2CV0D1M0-6yNAZiRKUEki_9U8.eyJhbGdvcml0aG0iOiJITUFDLVNIQTI1NiIsImlzc3VlZF9hdCI6MTc5NDEzMzcwNCwicGxheWVyX2lkIjoiMjk0Njg5MjI2MjI3MDAxMjgiLCJyZXF1ZXN0X3BheWxvYWQiOiJoZWxsbyJ9',
        timestamp: 1794133705034
    };
}

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
            let src = move[0] + move[1];
            let dst = move[2] + move[3];
            let msg = {"src": src, "dst": dst, "prom": move[4]};
            sender.send("engine", JSON.stringify(msg));
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
                    await win.loadFile("lobby.html");
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
        socket.send(login);
        sender.send("websocket", { "command": "Connected to WebSocket" });
        setInterval(function() { socket.send(keepAlive()); }, KEEP_ALIVE_INTERVAL);
    }); socket.on("message", function (data) { sender.send("websocket", parseMessage(data)); });
    socket.on("error", function (error) { sender.send("websocket", { "command": "WebSocket Error" }); });
    socket.on("close", function () { sender.send("websocket", { "command": "WebSocket connection closed" }); }); return socket;
}

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

// Encode message
function encode(buf) {
    const result = new Int8Array(buf.length);
    let offset = 0;
    for (const chunk of buf.data) {
        result.set(chunk, offset);
        offset += chunk.length;
    } return result;
}

// Array of bytes into a string
function bin2String(arr) {
    let result = "";
    for (let i = 0; i < arr.length; i++) result += String.fromCharCode(arr[i]);
    return result;
}

// Uint8Array to ASCII
function int8TOascii(arr) {
    return bin2String(arr);
}

// Int8Array to string.
function int8TOstr(arr) {
    const chars = new Uint16Array(arr.length / 2);
    for (let i = 0; i < chars.length; i++) {
        let value = arr[2 * i] << 8;
        value |= 255 & arr[2 * i + 1];
        chars[i] = value;
    } return bin2String(chars);
}

// Int8Array to array of signed bytes
function int8TObytes(arr) {
    const result = [];
    for (let i = 0; i < arr.length; i++) {
        let value = arr[i];
        if (value > 127) value -= 256;
        result[i] = value;
    } return result;
}

// Read 1 byte (signed)
function readByte(buf) {
    let value = buf.data[buf.offset++];
    if (value > 127) value -= 256;
    return value;
}

// Read an Int8Array of specified length
function readInt8Array(length, buf) {
    const result = new Int8Array(length);

    for (let i = 0; i < length; i++) {
        result[i] = buf.data[buf.offset++];
    }

    return result;
}

// Read ASCII (1-byte length prefix)
function readAscii(buf) {
    let length = readByte(buf);
    if (length < 0) length += 256;
    return int8TOascii(readInt8Array(length, buf));
}

// Read signed 16-bit integer (big-endian)
function readShort(buf) {
    let value = buf.data[buf.offset++];
    value <<= 8;
    value |= 255 & buf.data[buf.offset++];
    if (value > 32767) value -= 65536;
    return value;
}

// Read signed 32-bit integer (big-endian)
function readInt(buf) {
    let value = buf.data[buf.offset++]; value <<= 8;
    value |= 255 & buf.data[buf.offset++]; value <<= 8;
    value |= 255 & buf.data[buf.offset++]; value <<= 8;
    value |= 255 & buf.data[buf.offset++]; return value;
}

// Multiply by 2 to the power of the specified number.
function lshift(value, bits) {
    return value * Math.pow(2, bits);
}

// Read a 64-bit integer (8 bytes, big-endian).
function readLong(buf) {
    let value = buf.data[buf.offset++];
    value = lshift(value, 8);
    value = lshift(value | (255 & buf.data[buf.offset++]), 8);
    value = lshift(value | (255 & buf.data[buf.offset++]), 8);
    value = lshift(value | (255 & buf.data[buf.offset++]), 8);
    value = lshift(value + (255 & buf.data[buf.offset++]), 8);
    value = lshift(value + (255 & buf.data[buf.offset++]), 8);
    value = lshift(value + (255 & buf.data[buf.offset++]), 8);
    value += 255 & buf.data[buf.offset++];
    return value;
}

// Read string (2-byte length prefix, UTF-16)
function readString(buf) {
    const length = readShort(buf);
    return int8TOstr(readInt8Array(2 * length, buf));
}

// Read byte array (2-byte length prefix)
function readByteArray(buf) {
    const length = readShort(buf);
    return int8TObytes(readInt8Array(length, buf));
}

// Read array of strings (2-byte element count)
function readStringArray(buf) {
    const result = [];
    const length = readShort(buf);
    for (let i = 0; i < length; i++) result[i] = readString(buf);
    return result;
}

// Create message with opcode
function createMessage(opcode, writePayload = () => {}) {
    const msg = { data: [], length: 0 };
    writeShort(OPCODES[opcode], msg);
    writePayload(msg);
    return encode(msg);
}

// Login FB signature
function loginFbSignature2() {
    return createMessage("LOGIN_FB_SIGNATURE2", msg => {
        writeAscii(fbCredentials.id, msg);
        writeLongAscii(fbCredentials.signature, msg);
        writeString(fbCredentials.name, msg);
        writeAscii(fbCredentials.photo, msg);
        writeAscii(fbCredentials.locale, msg);
        writeAscii("FBIG_CHESS", msg);
        writeAscii("5.0.1", msg);
        writeAscii(null, msg);
        writeAscii("chess", msg); // gameId
        writeByte(1, msg);
        writeLong(0, msg);
        writeAscii(null, msg);
        writeByte(1, msg);
    });
}

// Keep alive message
function keepAlive() {
    return createMessage("PING");
}

// Encode move
function encodeMove(src, dst, prom) {
    return createMessage("PLAY", msg => {
        writeByte(src, msg);
        writeByte(dst, msg);
        if (prom) writeByte(prom, msg);
    });
}

// Get player location
function getCurrentPath() {
    return createMessage("GET_CURRENT_PATH", msg => {
        writeAscii("chess", msg);
    });
}

// Enter place
function enterPlace(placePath) {
    return createMessage("ENTER_PLACE", msg => {
        writeAscii(placePath + "", msg);
        writeString("", msg); // password, skipped for now
        writeByte(0, msg); // always enter in view mode
        writeAscii("chess", msg);
    });
}

// Enter child place
function enterChildPlace(placeName, tableId, gameMode) {
    return createMessage("ENTER_CHILD_PLACE", msg => {
        writeAscii(placeName + "", msg);
        writeString(tableId, msg);
        writeByte(gameMode, msg);
    });
}

// Create game table
function createTable(betAmountId, tableArgs, tableName) {
    return createMessage("CREATE_RULE", msg => {
        writeByte(betAmountId, msg);
        writeByte(Object.keys(tableArgs).length, msg);
        for (let key in tableArgs) {
            writeAscii(key, msg);
            writeString(tableArgs[key], msg);
        } writeAscii(tableName, msg);
    });
}

// Kick player off table
function kickPlayer(playerId) {
    return createMessage("KICK_PLAYER", msg => {
        writeLong(playerId, msg);
    });
}

// Get user avatar
function getAvatar(response) {
    let url = null;
    let cdnHost = "https://chesscdn.game8.io/";
    let avatarUrl = response.params.avatarUrl;
    let avatarId = response.params.avatarId;
    if (avatarUrl != null && avatarUrl !== "") {
        url = avatarUrl;
        if (!url.startsWith("http") && !url.startsWith("//")) url = cdnHost + url;
    } else url = cdnHost + "com/ftl/game/images/avatar/builtin" + avatarId + ".png";
    response.params.avatarUrl = url;
}

// Parse web socket message
function parseMessage(data) { // tableSlot is side to move, 0 - White; 1 -Black; -2 None;
    let response = { "command": "", "params": {} };
    let buf = { "data": data, "offset": 0 };
    let opcode = readShort(buf);
    switch (opcode) {
        case 300: response.command = "PONG"; break;
        case 406:
            response.command = "PLAYER_ENTERED";
            response.params = {
                "enterStatus": readByte(buf),
                "playerId": readLong(buf),
                "playerName": readString(buf),
                "playerChipBalance": readLong(buf),
                "playerEloRating": readLong(buf),
                "avatarUrl": readAscii(buf),
                "avatarId": readInt(buf),
                "playerLevel": readInt(buf),
                "mode": readByte(buf),
                "starBalance": readLong(buf)
            }; break;
        case 407: response.command = "PLAYER_EXITED"; break;
        case 410:
            response.command = "KICK_PLAYER";
            response.params = {
                "status": readByte(buf),
                "message": readString(buf)
            };
            break;
        case 415:
            response.command = "TABLE_IN_ROOM_CHANGED";
            response.params = {
                "id": readShort(buf),
                "name": readString(buf),
                "type": readByte(buf),
                "betAmountId": readByte(buf),
                "slots": readByte(buf),
                "playing": readByte(buf),
                "private": readByte(buf),
                "filter": readByte(buf),
            }; break;
        case 416:
            response.command = "SLOT_IN_TABLE_CHANGED";
            response.params = {
                "playerName": readString(buf),
                "tableSlot": readByte(buf),
                "playerChipBalance": readLong(buf),
                "playerEloRating": readLong(buf),
                "playerLevel": readByte(buf),
                "avatarId": readShort(buf),
                "avatarUrl": readAscii(buf),
                "gender": ((readByte(buf) == 1) ? "MALE" : "FEMALE"),
                "tableOwner": (readByte(buf) == 1),
                "playerId": readLong(buf),
                "starBalance": readLong(buf) 
            }; getAvatar(response); break;
        case 417: response.command = "START_MATCH"; break;
        case 418: response.command = "GAME_OVER"; break;
        case 420:
            response.command = "SET_TURN";
            let tableSlot = readByte(buf);
            let countdown = readShort(buf);
            let timeLeft = readShort(buf) * 1e3;
            let countdownMinutes = String(Math.floor(countdown / 60)).padStart(2, "0");
            let countdownSeconds = String(countdown % 60).padStart(2, "0");
            let totalSeconds = Math.floor(timeLeft / 1000);
            let remainingMinutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
            let remainingSeconds = String(totalSeconds % 60).padStart(2, "0");
            response.params = {
                "tableSlot": tableSlot,
                "countdown": countdown,
                "timeLeft": timeLeft,
                "formatCountdown": countdownMinutes + ":" + countdownSeconds,
                "formatTimeLeft": remainingMinutes + ":" + remainingSeconds,
            }; break;
        case 421:
            response.command = "SET_PLAYER_STATUS";
            response.params = {
                "tableSlot": readByte(buf),
                "matchPoint": readAscii(buf)
            }; break;
        case 424: response.command = "SHOW_LUCKY_WHEEL"; break;
        case 430:
            readByte(buf);
            response.command = "GET_CURRENT_PATH";
            response.params = { "places": [] };
            let pathCount = readByte(buf);
            let path = {};
            for (let i = 0; i < pathCount; i++) {
                path = {
                    "roomType": readAscii(buf).toLowerCase(),
                    "roomId": readAscii(buf),
                    "roomName": readString(buf),
                }; response.params.places.push(path);
            } response.params.avatarUrl = readAscii(buf);
            response.params.avatarId = readInt(buf);
            response.params.playerChipBalance = readLong(buf);
            response.params.starBalance = readLong(buf);
            response.params.playerEloRating = readLong(buf);
            response.params.cssOffset = readByte(buf);
            getAvatar(response);
            break;
        case 432:
            response.command = "OWNER_CHANGED";
            response.params = {
                "tableSlot": readByte(buf)
            }; break;
        case 529:
            response.command = "MOVE";
            response.params = {
                "src": COORDS[readByte(buf)],
                "dst": COORDS[readByte(buf)]
            }; break;
        case 616:
            readByte(buf);
            response.command = "LOGIN_FB_SIGNATURE2";
            response.params = {
                "refresh": readString(buf),
                "loginCookie": readAscii(buf),
                "playerId": readLong(buf),
                "playerNickName": readAscii(buf),
                "playerFullName": readString(buf),
                "gameProviderId": readLong(buf),
                "providerNickName": readAscii(buf),
                "providerFullName": readString(buf),
                "activeTournaments": readByte(buf),
                "cdnHost": readAscii(buf),
                "unreadMail": readShort(buf),
                "serverTimeoutOffset": readLong(buf) - Date.now(),
                "bannerInterval": readShort(buf),
                "rooms": [],
                "bets": [],
                "taxes": []
            }; let roomCount = readByte(buf);
            for (let i = 0; i < roomCount; i++) {
                var room = {
                    "id": readByte(buf),
                    "name": readString(buf),
                    "clientCount": readShort(buf),
                    "tableCount": readShort(buf),
                    "maxTable": Math.min(readShort(buf), 80),
                    "currency": readByte(buf)
                }; response.params.rooms.push(room);
            }; let betCount = readByte(buf), bets = [];
            for (let i = 0; i < betCount; i++) {
                const bet = { id: i, value: readInt(buf) };
                bets.push(bet);
            } response.params.bets = bets;
            let taxCount = readByte(buf);
            for (let i = 0; i < taxCount; i++) response.params.taxes.push(readInt(buf) / 1e6);
            response.params.zoneEntranceRate = readInt(buf) / 1e6;
            response.params.shouldRefineProfile = (1 == readByte(buf));
            break;
    } return response;
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
    if (DEBUG) win.loadFile("lobby.html");
    else fbLogin(win);
    win.maximize();
    win.on("close", () => { if (socket) socket.close(); });
} app.whenReady().then(createWindow);
app.on("quit", () => { if (socket) socket.close(); });
ipcMain.on("gui", (event, msg) => {
    if (msg.command == "connect") {
        initEngine(event.sender);
        connect(event.sender);
    } else if (msg.command == "disconnect") {
        if (socket) socket.close();
        if (engine) engine.kill();
    } else if (msg.command == "move") {
        let src = msg.params.src;
        let dst = msg.params.dst;
        let prom = msg.params.prom;
        let move = encodeMove(src, dst, prom);
        socket.send(move);
    } else if (msg.command == "path") {
        let path = getCurrentPath();
        socket.send(path);
    } else if (msg.command == "lobby") {
        let lobby = enterPlace("Lobby.chess");
        socket.send(lobby);
    } else if (msg.command == "room") {
        let room = enterChildPlace(msg.params.roomId);
        socket.send(room);
    } else if (msg.command == "game") {
        let betAmountId = msg.params.betAmountId;
        let tableArgs = msg.params.tableArgs;
        let tableName = msg.params.tableName;
        let game = createTable(betAmountId, tableArgs, tableName);
        socket.send(game);
    } else if (msg.command == "kick") {
        let playerId = msg.params.playerId;
        let kick = kickPlayer(playerId);
        socket.send(kick);
    } else if (msg.command == "hex") {
        socket.send(Buffer.from(msg.params.data, "hex"));
    }
}); ipcMain.on("uci", (event, msg) => {
    console.log(`UCI: ${msg}`)
    engine.stdin.write(msg + "\n");
});


