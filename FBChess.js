// Temp
const DEBUG = true;

// Packages
const { app, BrowserWindow, ipcMain, Menu } = require("electron");
const { spawn } = require("child_process");
const WebSocket = require("ws");
const os = require("os");
const path = require("path");

// App globals
var socket = null;
var fbCredentials = null;
var win = null;
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
    "a8", "b8", "c8", "d8", "e8", "f8", "g8", "h8"
];

const KEEP_ALIVE_INTERVAL = 7500;

const OPCODES = {
    "PONG": 300,
    "PING": 301,
    "ENTER_PLACE": 401,
    "ENTER_CHILD_PLACE": 402,
    "CREATE_RULE": 405,
    "PLAYER_ENTERED": 406,
    "PLAYER_EXITED": 407,
    "KICK_PLAYER": 410,
    "GET_TABLE_DATA": 414,
    "TABLE_IN_ROOM_CHANGED": 415,
    "SLOT_IN_TABLE_CHANGED": 416,
    "START_MATCH": 417,
    "GAME_OVER": 418,
    "SET_TURN": 420,
    "SHOW_LUCKY_WHEEL": 424,
    "SET_PLAYER_STATUS": 421,
    "GET_CURRENT_PATH": 430,
    "OWNER_CHANGED": 432,
    "PLAY": 502,
    "MOVE": 529,
    "LOGIN_FB_SIGNATURE2": 616,
    "CONTEST.ENTER": 641,
    "CONTEST.FETCH_CURRENT": 644,
    "CONTEST.LIST": 645
};

if (DEBUG) {
    fbCredentials = {
      id: '29468922622700128',
      locale: 'en_GB',
      name: null,
      photo: null,
      signature: '-j5n8Bez8tOD5B3mtNSwWBfIYkG6UPo_RTFWpaqcK5I.eyJhbGdvcml0aG0iOiJITUFDLVNIQTI1NiIsImlzc3VlZF9hdCI6MTc5NDk5NDkwNywicGxheWVyX2lkIjoiMjk0Njg5MjI2MjI3MDAxMjgiLCJyZXF1ZXN0X3BheWxvYWQiOiJoZWxsbyJ9',
      timestamp: 1794994907674
    }

}

/*******************************
             ENGINE
*******************************/

// PROFE PINO EDIT #007 BEGIN — Engine speed configuration.
// Verified current working values: 256 MB hash, 4 threads, 500 ms per move.
// Documentation only: no settings changed.
const ENGINE_CONFIG = {
    hashMb: 256,
    threads: 4,
    moveTimeMs: 500
};
// PROFE PINO EDIT #007 END

// PROFE PINO EDIT #001 — Track engine readiness, pending positions,
// and search state so requests can wait for Stockfish initialization.
let engineReady = false;
let engineOutputBuffer = "";
let pendingPosition = null;
let searchInProgress = false;
let engineSender = null;

// PROFE PINO EDIT #003 — Normalize position commands and remove
// unnecessary quotes around FEN text before sending it to Stockfish.
function cleanEnginePosition(command) {
    let value = String(command ?? "").trim();

    // Remove quotation marks surrounding the entire command.
    if (
        (value.startsWith("'") && value.endsWith("'")) ||
        (value.startsWith('"') && value.endsWith('"'))
    ) {
        value = value.slice(1, -1).trim();
    }

    // Remove quotation marks surrounding the FEN.
    const match = value.match(
        /^position\s+fen\s+(['"])(.*?)\1(\s+moves\s+.*)?$/i
    );

    if (match) {
        value =
            "position fen " +
            match[2].trim() +
            (match[3] || "");
    }

    return value;
}

// PROFE PINO EDIT #001 — Send UCI commands safely through stdin.
function writeEngine(command) {
    if (
        !engine ||
        !engine.stdin ||
        !engine.stdin.writable
    ) {
        console.error(
            "Cannot send command; Stockfish stdin unavailable."
        );
        return false;
    }

    try {
        engine.stdin.write(command + "\n");
        return true;
    } catch (error) {
        console.error("Engine write error:", error);
        return false;
    }
}

// PROFE PINO EDIT #002 — Queue requests while initializing or searching;
// stop an old search before starting the latest requested position.
function startEngineSearch(position) {
    if (!position) return;

    position = cleanEnginePosition(position);

    if (!position.startsWith("position ")) {
        console.error(
            "Invalid Stockfish position command:",
            position
        );
        return;
    }

    if (
        !engine ||
        !engine.stdin ||
        !engine.stdin.writable ||
        !engineReady
    ) {
        pendingPosition = position;
        console.log(
            "Position queued until Stockfish is ready."
        );
        return;
    }

    if (searchInProgress) {
        pendingPosition = position;
        writeEngine("stop");
        return;
    }

    searchInProgress = true;

    console.log("Stockfish position:", position);

    if (!writeEngine(position)) {
        searchInProgress = false;
        return;
    }

    writeEngine(
        `go movetime ${ENGINE_CONFIG.moveTimeMs}`
    );
}

// PROFE PINO EDIT #001 — Launch Stockfish and configure its UCI options.
function initEngine(sender) {
    const enginePath =
        "E:\\ftp.files\\games\\DeepFritz\\stockfish\\Stockfish19\\stockfish-windows-x86-64-universal.exe";

    if (engine) {
        try {
            engine.kill();
        } catch (error) {
            console.error(
                "Could not stop previous engine:",
                error
            );
        }
    }

    engineReady = false;
    engineOutputBuffer = "";
    pendingPosition = null;
    searchInProgress = false;
    engineSender = sender || null;

    const availableCpus = os.cpus().length || 1;

    const threads = Math.max(
        1,
        Math.min(
            ENGINE_CONFIG.threads,
            availableCpus
        )
    );

    console.log("Starting Stockfish 19...");
    console.log("Engine path:", enginePath);
    console.log("Threads:", threads);
    console.log("Hash:", ENGINE_CONFIG.hashMb);

    try {
        engine = spawn(enginePath, {
            detached: false,
            stdio: ["pipe", "pipe", "pipe"],
            windowsHide: true
        });
    } catch (error) {
        console.error("Stockfish startup failed:", error);
        engine = null;
        engineReady = false;
        return;
    }

    engine.stdout.on("data", (data) => {
        engineOutputBuffer += data.toString();

        const lines = engineOutputBuffer.split(/\r?\n/);
        engineOutputBuffer = lines.pop() || "";

        for (const rawLine of lines) {
            const line = rawLine.trim();

            if (!line) continue;

            console.log("ENGINE:", line);

            // PROFE PINO EDIT #001 — Maximum skill (20), no artificial
            // strength limit, plus configured hash and CPU threads.
            if (line === "uciok") {
                writeEngine(
                    "setoption name UCI_LimitStrength value false"
                );

                writeEngine(
                    "setoption name Skill Level value 20"
                );

                writeEngine(
                    `setoption name Hash value ${ENGINE_CONFIG.hashMb}`
                );

                writeEngine(
                    `setoption name Threads value ${threads}`
                );

                writeEngine("ucinewgame");
                writeEngine("isready");

                continue;
            }

            if (line === "readyok") {
                engineReady = true;

                console.log(
                    "Stockfish 19 is READY."
                );

                if (pendingPosition) {
                    const position = pendingPosition;
                    pendingPosition = null;

                    startEngineSearch(position);
                }

                continue;
            }

            // PROFE PINO EDIT #002 — Parse bestmove and deliver it to game.js.
            if (line.startsWith("bestmove ")) {
                searchInProgress = false;

                if (pendingPosition) {
                    const position = pendingPosition;
                    pendingPosition = null;

                    startEngineSearch(position);
                    continue;
                }

                const match = line.match(
                    /^bestmove\s+([a-h][1-8][a-h][1-8][qrbn]?|\(none\))/i
                );

                if (
                    !match ||
                    match[1] === "(none)"
                ) {
                    console.log(
                        "Stockfish has no legal move."
                    );
                    continue;
                }

                const move = match[1];

                const message = {
                    src: move.slice(0, 2),
                    dst: move.slice(2, 4),
                    prom: move[4] || null
                };

                console.log(
                    "Stockfish selected move:",
                    message
                );

                if (
                    engineSender &&
                    !engineSender.isDestroyed?.()
                ) {
                    engineSender.send(
                        "engine",
                        JSON.stringify(message)
                    );
                }
            }
        }
    });

    engine.stderr.on("data", (data) => {
        console.log(
            "ENGINE STDERR:",
            data.toString()
        );
    });

    engine.on("error", (error) => {
        console.error("ENGINE ERROR:", error);

        engineReady = false;
        searchInProgress = false;
        engine = null;
    });

    engine.on("exit", (code, signal) => {
        console.error(
            "Stockfish exited:",
            code,
            signal
        );

        engine = null;
        engineReady = false;
        searchInProgress = false;
        pendingPosition = null;
        engineOutputBuffer = "";
    });

    writeEngine("uci");
}
/*******************************
           WEB SOCKET
*******************************/

function fbLogin(win) {
    win.loadURL(
        "https://www.facebook.com/gaming/play/194060244713436/"
    );

    const interval = setInterval(async () => {
        if (!win || win.isDestroyed()) {
            clearInterval(interval);
            return;
        }

        const frames =
            win.webContents.mainFrame.framesInSubtree;

        for (const frame of frames) {
            if (!frame.url.includes("194060244713436")) {
                continue;
            }

            try {
                const credentials =
                    await frame.executeJavaScript(`
                    (async () => {
                        if (!window.FBInstant) {
                            throw new Error("FBInstant is unavailable");
                        }

                        const signedInfo =
                            await FBInstant.player.getSignedPlayerInfoAsync("hello");

                        let playerId = FBInstant.player.getID();

                        if (playerId == null || playerId === "") {
                            playerId = signedInfo.getPlayerID();
                        }

                        return {
                            id: playerId,
                            name: FBInstant.player.getName?.() ?? null,
                            photo: FBInstant.player.getPhoto?.() ?? null,
                            signature: signedInfo.getSignature(),
                            locale: FBInstant.getLocale(),
                            timestamp: Date.now()
                        };
                    })();
                `);

                if (
                    credentials?.id &&
                    credentials?.signature
                ) {
                    fbCredentials = credentials;
                    console.log(fbCredentials);
                    console.log(
                        "Credentials stored globally."
                    );

                    clearInterval(interval);

                    await win.loadFile("menu.html");
                    break;
                }

            } catch (error) {
                console.log(
                    "Waiting for credentials:",
                    error.message
                );
            }
        }
    }, 3000);
}

function connect(sender) {
    socket = new WebSocket(
        "wss://chess.game8.io/ws/gameServer",
        {
            headers: {
                "Origin": "null"
            }
        }
    );

    socket.on("open", function () {
        let login = loginFbSignature2();

        socket.send(login);

        sender.send("websocket", {
            command: "Connected to WebSocket"
        });

        setInterval(function () {
            try {
                if (socket && socket.readyState === WebSocket.OPEN) {
                    socket.send(keepAlive());
                }
            } catch (error) {
                console.error("Keepalive error:", error);
            }
        }, KEEP_ALIVE_INTERVAL);
    });

    socket.on("message", function (data) {
        sender.send(
            "websocket",
            parseMessage(data)
        );
    });

    socket.on("error", function (error) {
        console.error("WebSocket error:", error);

        sender.send("websocket", {
            command: "WebSocket Error"
        });
    });

    socket.on("close", function () {
        sender.send("websocket", {
            command: "WebSocket connection closed"
        });
    });

    return socket;
}

/*******************************
         BINARY HELPERS
*******************************/

function asciiTOint8(str) {
    const result = new Int8Array(str.length);

    for (let i = 0; i < str.length; i++) {
        result[i] = str.charCodeAt(i);
    }

    return result;
}

function strTOint8(str) {
    const result = new Int8Array(2 * str.length);

    for (let i = 0; i < str.length; i++) {
        const charCode = str.charCodeAt(i);

        result[2 * i] = charCode >> 8;
        result[2 * i + 1] = charCode;
    }

    return result;
}

function writeByte(val, buf) {
    buf.data.push(new Int8Array([val]));
    buf.length++;
}

function writeShort(val, buf) {
    buf.data.push(
        new Int8Array([val >> 8, val])
    );
    buf.length += 2;
}

function writeInt(val, buf) {
    buf.data.push(
        new Int8Array([
            val >> 24,
            val >> 16,
            val >> 8,
            val
        ])
    );

    buf.length += 4;
}

function writeLong(val, buf) {
    let negative = false;

    if (val < 0) {
        val = 0x8000000000000000n + BigInt(val) + 1n;
        negative = true;
    } else {
        val = BigInt(val);
    }

    const bytes = new Int8Array([
        Number((val >> 56n) & 0xFFn),
        Number((val >> 48n) & 0xFFn),
        Number((val >> 40n) & 0xFFn),
        Number((val >> 32n) & 0xFFn),
        Number((val >> 24n) & 0xFFn),
        Number((val >> 16n) & 0xFFn),
        Number((val >> 8n) & 0xFFn),
        Number(val & 0xFFn)
    ]);

    if (negative) bytes[0] |= 128;

    buf.data.push(bytes);
    buf.length += 8;
}

function writeAscii(str, buf) {
    if (str == null) str = "";

    if (str.length > 255) {
        str = str.substring(0, 255);
    }

    writeByte(str.length, buf);

    buf.data.push(asciiTOint8(str));
    buf.length += str.length;
}

function writeLongAscii(str, buf) {
    if (str == null) str = "";

    writeInt(str.length, buf);

    buf.data.push(asciiTOint8(str));
    buf.length += str.length;
}

function writeString(str, buf) {
    if (str == null) str = "";

    writeShort(str.length, buf);

    buf.data.push(strTOint8(str));
    buf.length += 2 * str.length;
}

function encode(buf) {
    const result = new Int8Array(buf.length);
    let offset = 0;

    for (const chunk of buf.data) {
        result.set(chunk, offset);
        offset += chunk.length;
    }

    return result;
}

function bin2String(arr) {
    let result = "";

    for (let i = 0; i < arr.length; i++) {
        result += String.fromCharCode(arr[i]);
    }

    return result;
}

function int8TOascii(arr) {
    return bin2String(arr);
}

function int8TOstr(arr) {
    const chars = new Uint16Array(arr.length / 2);

    for (let i = 0; i < chars.length; i++) {
        let value = arr[2 * i] << 8;
        value |= 255 & arr[2 * i + 1];
        chars[i] = value;
    }

    return bin2String(chars);
}

function int8TObytes(arr) {
    const result = [];

    for (let i = 0; i < arr.length; i++) {
        let value = arr[i];

        if (value > 127) value -= 256;

        result[i] = value;
    }

    return result;
}

function readByte(buf) {
    let value = buf.data[buf.offset++];

    if (value > 127) value -= 256;

    return value;
}

function readInt8Array(length, buf) {
    const result = new Int8Array(length);

    for (let i = 0; i < length; i++) {
        result[i] = buf.data[buf.offset++];
    }

    return result;
}

function readAscii(buf) {
    let length = readByte(buf);

    if (length < 0) length += 256;

    return int8TOascii(
        readInt8Array(length, buf)
    );
}

function readShort(buf) {
    let value = buf.data[buf.offset++];

    value <<= 8;
    value |= 255 & buf.data[buf.offset++];

    if (value > 32767) value -= 65536;

    return value;
}

function readInt(buf) {
    let value = buf.data[buf.offset++];

    value <<= 8;
    value |= 255 & buf.data[buf.offset++];

    value <<= 8;
    value |= 255 & buf.data[buf.offset++];

    value <<= 8;
    value |= 255 & buf.data[buf.offset++];

    return value;
}

function lshift(value, bits) {
    return value * Math.pow(2, bits);
}

function readLong(buf) {
    let value = buf.data[buf.offset++];

    value = lshift(value, 8);
    value = lshift(
        value | (255 & buf.data[buf.offset++]),
        8
    );
    value = lshift(
        value | (255 & buf.data[buf.offset++]),
        8
    );
    value = lshift(
        value | (255 & buf.data[buf.offset++]),
        8
    );
    value = lshift(
        value + (255 & buf.data[buf.offset++]),
        8
    );
    value = lshift(
        value + (255 & buf.data[buf.offset++]),
        8
    );
    value = lshift(
        value + (255 & buf.data[buf.offset++]),
        8
    );

    value += 255 & buf.data[buf.offset++];

    return value;
}

function readString(buf) {
    const length = readShort(buf);

    return int8TOstr(
        readInt8Array(2 * length, buf)
    );
}

function readByteArray(buf) {
    const length = readShort(buf);

    return int8TObytes(
        readInt8Array(length, buf)
    );
}

function readStringArray(buf) {
    const result = [];
    const length = readShort(buf);

    for (let i = 0; i < length; i++) {
        result[i] = readString(buf);
    }

    return result;
}
function createMessage(opcode, writePayload = () => { }) {
    const msg = {
        data: [],
        length: 0
    };

    writeShort(OPCODES[opcode], msg);
    writePayload(msg);

    return encode(msg);
}

/*******************************
          GAME MESSAGES
*******************************/

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
        writeAscii("chess", msg);
        writeByte(1, msg);
        writeLong(0, msg);
        writeAscii(null, msg);
        writeByte(1, msg);
    });
}

function keepAlive() {
    return createMessage("PING");
}

function encodeMove(src, dst, prom) {
    return createMessage("PLAY", msg => {
        writeByte(src, msg);
        writeByte(dst, msg);

        if (prom) writeByte(prom, msg);
    });
}

function getCurrentPath() {
    return createMessage("GET_CURRENT_PATH", msg => {
        writeAscii("chess", msg);
    });
}

function getTableData(roomId, tableId) {
    return createMessage("GET_TABLE_DATA", msg => {
        writeAscii(
            "Lobby.chess." + roomId + "." + tableId,
            msg
        );
    });
}

function enterPlace(placePath) {
    return createMessage("ENTER_PLACE", msg => {
        writeAscii(placePath + "", msg);
        writeString("", msg);
        writeByte(0, msg);
        writeAscii("chess", msg);
    });
}

function enterChildPlace(placeName, tableId, gameMode) {
    return createMessage("ENTER_CHILD_PLACE", msg => {
        writeAscii(placeName + "", msg);
        writeString(tableId, msg);
        writeByte(gameMode, msg);
    });
}

function createTable(betAmountId, tableArgs, tableName) {
    return createMessage("CREATE_RULE", msg => {
        writeByte(betAmountId, msg);
        writeByte(Object.keys(tableArgs).length, msg);

        for (let key in tableArgs) {
            writeAscii(key, msg);
            writeString(tableArgs[key], msg);
        }

        writeAscii(tableName, msg);
    });
}

function kickPlayer(playerId) {
    return createMessage("KICK_PLAYER", msg => {
        writeLong(playerId, msg);
    });
}

function getTournaments() {
  return createMessage("CONTEST.LIST");
}

function enterTournament(tournamentId) {
  return createMessage("CONTEST.ENTER", msg => {
      writeAscii(tournamentId, msg);
  });
}

function fetchCurrentTournament() {
  return createMessage("CONTEST.FETCH_CURRENT", msg => {
      writeByte(1, msg);
  });
}

/*******************************
         MESSAGE PARSING
*******************************/

function getAvatar(response) {
    let url = null;

    let cdnHost = "https://chesscdn.game8.io/";
    let avatarUrl = response.params.avatarUrl;
    let avatarId = response.params.avatarId;

    if (avatarUrl != null && avatarUrl !== "") {
        url = avatarUrl;

        if (
            !url.startsWith("http") &&
            !url.startsWith("//")
        ) {
            url = cdnHost + url;
        }
    } else {
        url =
            cdnHost +
            "com/ftl/game/images/avatar/builtin" +
            avatarId +
            ".png";
    }

    response.params.avatarUrl = url;
}

function parseMessage(data) {
    let response = {
        command: "",
        params: {}
    };

    let buf = {
        data: data,
        offset: 0
    };

    let opcode = readShort(buf);

    switch (opcode) {
        case 300:
            response.command = "PONG";
            break;

        case 406:
            response.command = "PLAYER_ENTERED";

            response.params = {
                enterStatus: readByte(buf),
                playerId: readLong(buf),
                playerName: readString(buf),
                playerChipBalance: readLong(buf),
                playerEloRating: readLong(buf),
                avatarUrl: readAscii(buf),
                avatarId: readInt(buf),
                playerLevel: readInt(buf),
                mode: readByte(buf),
                starBalance: readLong(buf)
            };

            break;

        case 407:
            response.command = "PLAYER_EXITED";
            break;

        case 410:
            response.command = "KICK_PLAYER";

            response.params = {
                status: readByte(buf),
                message: readString(buf)
            };

            break;

        case 414:
            response.command = "GET_TABLE_DATA";

            readByte(buf);

            response.params = {
                ownerId: readLong(buf),
                players: []
            };

            let playerCount = readByte(buf);

            for (let i = 0; i < playerCount; i++) {
                let player = {
                    playerId: readLong(buf),
                    playerName: readString(buf),
                    avatarUrl: readAscii(buf),
                    avatarId: readShort(buf),
                    chipBalance: readLong(buf),
                    starBalance: readLong(buf),
                    playerEloRating: readLong(buf),
                    "?": readByte(buf)
                };

                getAvatar({ params: player });
                response.params.players.push(player);
            }

            break;

        case 415:
            response.command = "TABLE_IN_ROOM_CHANGED";

            response.params = {
                id: readShort(buf),
                name: readString(buf),
                type: readByte(buf),
                betAmountId: readByte(buf),
                slots: readByte(buf),
                playing: readByte(buf),
                private: readByte(buf),
                filter: readByte(buf)
            };

            break;

        case 416:
            response.command = "SLOT_IN_TABLE_CHANGED";

            response.params = {
                playerName: readString(buf),
                tableSlot: readByte(buf),
                playerChipBalance: readLong(buf),
                playerEloRating: readLong(buf),
                playerLevel: readByte(buf),
                avatarId: readShort(buf),
                avatarUrl: readAscii(buf),
                gender: (readByte(buf) == 1)
                    ? "MALE"
                    : "FEMALE",
                tableOwner: (readByte(buf) == 1),
                playerId: readLong(buf),
                starBalance: readLong(buf)
            };

            getAvatar(response);
            break;

        case 417:
            response.command = "START_MATCH";
            break;

        case 418:
            response.command = "GAME_OVER";
            break;

        case 420:
            response.command = "SET_TURN";

            let tableSlot = readByte(buf);
            let countdown = readShort(buf);
            let timeLeft = readShort(buf) * 1e3;

            let countdownMinutes =
                String(
                    Math.floor(countdown / 60)
                ).padStart(2, "0");

            let countdownSeconds =
                String(countdown % 60).padStart(2, "0");

            let totalSeconds =
                Math.floor(timeLeft / 1000);

            let remainingMinutes =
                String(
                    Math.floor(
                        (totalSeconds % 3600) / 60
                    )
                ).padStart(2, "0");

            let remainingSeconds =
                String(totalSeconds % 60).padStart(2, "0");

            response.params = {
                tableSlot: tableSlot,
                countdown: countdown,
                timeLeft: timeLeft,
                formatCountdown:
                    countdownMinutes + ":" + countdownSeconds,
                formatTimeLeft:
                    remainingMinutes + ":" + remainingSeconds
            };

            break;

        case 421:
            response.command = "SET_PLAYER_STATUS";

            response.params = {
                tableSlot: readByte(buf),
                matchPoint: readAscii(buf)
            };

            break;

        case 424:
            response.command = "SHOW_LUCKY_WHEEL";
            break;

        case 430:
            readByte(buf);

            response.command = "GET_CURRENT_PATH";

            response.params = {
                places: []
            };

            let pathCount = readByte(buf);
            let currentPath = {};

            for (let i = 0; i < pathCount; i++) {
                currentPath = {
                    roomType: readAscii(buf).toLowerCase(),
                    roomId: readAscii(buf),
                    roomName: readString(buf)
                };

                response.params.places.push(currentPath);
            }

            response.params.avatarUrl = readAscii(buf);
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
                tableSlot: readByte(buf)
            };

            break;

        case 529:
            response.command = "MOVE";

            response.params = {
                src: COORDS[readByte(buf)],
                dst: COORDS[readByte(buf)]
            };

            break;

        case 616:
            readByte(buf);

            response.command = "LOGIN_FB_SIGNATURE2";

            response.params = {
                refresh: readString(buf),
                loginCookie: readAscii(buf),
                playerId: readLong(buf),
                playerNickName: readAscii(buf),
                playerFullName: readString(buf),
                gameProviderId: readLong(buf),
                providerNickName: readAscii(buf),
                providerFullName: readString(buf),
                activeTournaments: readByte(buf),
                cdnHost: readAscii(buf),
                unreadMail: readShort(buf),
                serverTimeoutOffset: readLong(buf) - Date.now(),
                bannerInterval: readShort(buf),
                rooms: [],
                bets: [],
                taxes: []
            };

            let roomCount = readByte(buf);

            for (let i = 0; i < roomCount; i++) {
                var room = {
                    id: readByte(buf),
                    name: readString(buf),
                    clientCount: readShort(buf),
                    tableCount: readShort(buf),
                    maxTable: Math.min(readShort(buf), 80),
                    currency: readByte(buf)
                };

                response.params.rooms.push(room);
            }

            let betCount = readByte(buf);
            let bets = [];

            for (let i = 0; i < betCount; i++) {
                const bet = {
                    id: i,
                    value: readInt(buf)
                };

                bets.push(bet);
            }

            response.params.bets = bets;

            let taxCount = readByte(buf);

            for (let i = 0; i < taxCount; i++) {
                response.params.taxes.push(
                    readInt(buf) / 1e6
                );
            }

            response.params.zoneEntranceRate =
                readInt(buf) / 1e6;

            response.params.shouldRefineProfile =
                (1 == readByte(buf));

            break;
        case 641:
            readByte(buf);
            response.command = "CONTEST.ENTER";
            response.params = {
                "tournamentId": readLong(buf),
                "tournamentType": readAscii(buf),
                "tournamentName": readAscii(buf)
            }
            break;
        case 644:
            readByte(buf);
            response.command = "CONTEST.FETCH_CURRENT";
            response.params = {};
            
            // Get players count
            let playersCount = readByte(buf);
            response.params.playersCount = playersCount;
            response.params.coins = [];
            response.params.players = [];
            
            // Skip unknown section
            response.params.n1 = readInt(buf);
            response.params.n2 = readByte(buf);
            response.params.n3 = readAscii(buf);
            response.params.n4 = readAscii(buf);
            response.params.n5 = readLong(buf);
            
            // Parse "COIN" section
            let coins = [];
            for (let i = 0; i < playersCount; i++) {
                coins.push({
                    "n1": readAscii(buf),
                    "n2": readLong(buf),
                    "n3": readInt(buf),
                    "n4": readByte(buf),
                    "n5": readByte(buf)
                });
            } response.params.coins.push(coins);
            
            // Skip unknown section
            readLong(buf);
            readInt(buf);
            
            // Skip offset
            readShort(buf);
            readByte(buf);
            
            // Parse player section
            let players = [];
            for (let i = 0; i < playersCount-1; i++) {
                players.push({
                    "avatarUrl": readAscii(buf),
                    "n2": readShort(buf),
                    "playerStanding": readShort(buf),
                    "playerEloRating": readLong(buf),
                    "n4": readShort(buf),
                    "n5": readByte(buf),
                    "chipBalance": readLong(buf),
                    "playerName": readString(buf),
                    "n8": readShort(buf),
                    "n9": readByte(buf)
                });
            } response.params.players.push(players);

            
            // PLAYERS
            //console.log("avatarUrl", readAscii(buf));
            
            // ?
            /*console.log("?", readShort(buf));
            
            // STANDING
            console.log("Standing", readShort(buf));
            
            // ? LONG
            console.log("Rating", readLong(buf));
            
            console.log("?", readShort(buf));
            console.log("?", readByte(buf));
            console.log("Coins", readLong(buf));
            
            
            console.log(readString(buf));
            console.log(readShort(buf));
            console.log(readByte(buf));
            
            //Next player
            console.log(readAscii(buf));*/
            
            console.log(response.params.coins);
            
            console.log(data.toString("hex"));
            

            break;
        case 645:
            readByte(buf);
            response.command = "CONTEST.LIST";
            response.params = {
                "availableTournaments?": readByte(buf),
                "unknownLong": readLong(buf),
                "tournamentId": readAscii(buf)
            };
            break;
    }

    return response;
}

// let p = parseMessage(Buffer.from("028400140000000102054d4544414c0948435f5468616e6b730000000000000ff404434f494e000000000000030d40000000020104434f494e0000000000000222e0000000030104434f494e0000000000000186a0000000040104434f494e000000000000002710000000050104434f494e000000000000002710000000060104434f494e000000000000002710000000070104434f494e000000000000002710000000080104434f494e000000000000002710000000090104434f494e0000000000000027100000000a0104434f494e0000000000000027100000000b0104434f494e0000000000000027100000000c0104434f494e0000000000000027100000000d0104434f494e0000000000000027100000000e0104434f494e0000000000000027100000000f0104434f494e000000000000002710000000100104434f494e000000000000002710000000110104434f494e000000000000002710000000120104434f494e000000000000002710000000130104434f494e000000000000002710000000140104434f494e    000000000000002710140000000001b633cd0003005301a1006e000000                                                                                                              4468747470733a2f2f636865737363646e2e67616d65382e696f2f75706c6f61642f75736572732f3032392f32383731383032392e706e673f743d3137393438343834393900a00001000000000000069a0000010000000002661129000500420065006b0069006d0000004468747470733a2f2f636865737363646e2e67616d65382e696f2f75706c6f61642f75736572732f3439372f34303234333439372e706e673f743d3137393432373830313700eb0002000000000000068b000001000000000081a15600050042006f0062006f00740000004368747470733a2f2f636865737363646e2e67616d65382e696f2f75706c6f61642f75736572732f3434362f383439353434362e706e673f743d31373732363034323633000c0003000000000000067b0000000000000003527e57000800560020004d0020004a00680065006b0000003768747470733a2f2f636865737363646e2e67616d65382e696f2f75706c6f61642f75736572732f3934332f35353733373934332e706e67007c0004000000000000067400000000000000021e023d00030414043e043d0000004468747470733a2f2f636865737363646e2e67616d65382e696f2f75706c6f61642f75736572732f3038352f33353532313038352e706e673f743d313737333539393532310098000500000000000006670000010000000003b46cb0000800540068006500200048006f007000650000003768747470733a2f2f636865737363646e2e67616d65382e696f2f75706c6f61642f75736572732f3935322f36323135353935322e706e6700a3000600000000000006670000000000000003c4a847000e004401b001a1006e006700200042006900670020004400690063006b00000000002d0007000000000000065e0000010000000000352d9f0007005000610074007200690063006b0000003668747470733a2f2f636865737363646e2e67616d65382e696f2f75706c6f61642f75736572732f3038372f333438353038372e706e6700d80008000000000000065d000001000000000096c10300060421043504400451043304300000004368747470733a2f2f636865737363646e2e67616d65382e696f2f75706c6f61642f75736572732f3831312f393837393831312e706e673f743d31373934343636303035015d0009000000000000065b000001000000000084d366000b004a006100760068006c0061006e0074006f006700730000004368747470733a2f2f636865737363646e2e67616d65382e696f2f75706c6f61642f75736572732f3837302f383730343837302e706e673f743d313737323534313535370012000a000000000000065a00000100000000025bac54000300420065006e0000004468747470733a2f2f636865737363646e2e67616d65382e696f2f75706c6f61642f75736572732f3332342f33393536323332342e706e673f743d3137373236303933363100ce000b0000000000000658000000000000000395bdd10008041c04380440043e0441043b043004320000004468747470733a2f2f636865737363646e2e67616d65382e696f2f75706c6f61642f75736572732f3130352f36303134353130352e706e673f743d31373732363037323634002c000c00000000000006560000000000000003bf1e8b000b005000650074007200750073002000740061006e006100000000009c000d00000000000006520000010000000000b8849a000600480065006e0064007200610000004468747470733a2f2f636865737363646e2e67616d65382e696f2f75706c6f61642f75736572732f3537302f31323039323537302e706e673f743d3137373235343231383901ac000e000000000000065000000000000000039714ca000d004c0061006c00630068006800750061006e00610077006d00610000004468747470733a2f2f636865737363646e2e67616d65382e696f2f75706c6f61642f75736572732f3930362f36303233323930362e706e673f743d3137373235383233373000d3000f000000000000064f000000000000000288082b0006005400650062006f0067006f0000003768747470733a2f2f636865737363646e2e67616d65382e696f2f75706c6f61642f75736572732f3431392f34323436393431392e706e67015f0010000000000000064e0000000000000002bc1ad3000400440169006e00670000004468747470733a2f2f636865737363646e2e67616d65382e696f2f75706c6f61642f75736572732f3036372f34353838323036372e706e673f743d3137373235393735313401a90011000000000000064700000000000000024ad8a000060053006f006c00770069006e0000003768747470733a2f2f636865737363646e2e67616d65382e696f2f75706c6f61642f75736572732f3535322f33383435393535322e706e6700440012000000000000064400000100000000036e62530005004a006f0072006700650000004468747470733a2f2f636865737363646e2e67616d65382e696f2f75706c6f61642f75736572732f3737392f35373536353737392e706e673f743d3137373236303730353800ea0013000000000000063d000001000000000041dcc400070041006b002000530061006d00790000003668747470733a2f2f636865737363646e2e67616d65382e696f2f75706c6f61642f75736572732f3335362f343331363335362e706e67014d0014000000000000063b000000019900000000000005dc0000001d005400680061006e006b00730067006900760069006e006700200046006500730074006900760061006c002000320030003200360020005700340135007b0020002200700068006f0074006f0022003a0020002200680074007400700073003a002f002f00630064006e002e00670061006d006500760068002e006d0065002f00750070006c006f00610064002f0066006200690067002f00630068006500730073002f007400680061006e006b00730031002e0070006e00670022002c00200022006700750069006400650022003a0020002200680074007400700073003a002f002f00630064006e002e00670061006d006500760068002e006d0065002f00750070006c006f00610064002f0066006200690067002f00630068006500730073002f00670075006900640065005f002400740079007000650024005f0024006c006f00630061006c00650024002e00680074006d006c003f007600310022002c00200022006d0061007400630068002d006d0061006b0069006e00670022003a0020007b0020002200640022003a002000310030002c0020002200730022003a0020003300300020007d002c00200022006d00610074006300680022003a0020007b0020002200640065006e006f006d0069006e006100740069006f006e0022003a00200033002c00200022006d0061007400630068004400750072006100740069006f006e0022003a0020002200350022002c00200022007400750072006e004400750072006100740069006f006e0022003a00200022003300300022002c00200022006100630063004400750072006100740069006f006e0022003a0020002200300022002c0020002200660069007200730074005400750072006e004400750072006100740069006f006e0022003a002000220039003000220020007d0020007d010000000003c73a3a0007004c006f007200690061006e006e0000000000ef019800000000000005dc00000001", "hex"));
// let n = parseMessage(Buffer.from("028400140000000102054d4544414c0948435f5468616e6b730000000000000ff404434f494e000000000000030d40000000020104434f494e0000000000000222e0000000030104434f494e0000000000000186a0000000040104434f494e000000000000002710000000050104434f494e000000000000002710000000060104434f494e000000000000002710000000070104434f494e000000000000002710000000080104434f494e000000000000002710000000090104434f494e0000000000000027100000000a0104434f494e0000000000000027100000000b0104434f494e0000000000000027100000000c0104434f494e0000000000000027100000000d0104434f494e0000000000000027100000000e0104434f494e0000000000000027100000000f0104434f494e000000000000002710000000100104434f494e000000000000002710000000110104434f494e000000000000002710000000120104434f494e000000000000002710000000130104434f494e000000000000002710000000140104434f494e    000000000000002710140000000003c74472000c004400e2006e0020004300e0007900200043006800610079000000000152000100000000000006e70000010000000001b633cd0003005301a1006e000000    4468747470733a2f2f636865737363646e2e67616d65382e696f2f75706c6f61642f75736572732f3032392f32383731383032392e706e673f743d3137393438343834393900a0000200000000000006d300000100000000020bfe6e0005004100720074007500720000003768747470733a2f2f636865737363646e2e67616d65382e696f2f75706c6f61642f75736572732f3436322f33343334303436322e706e67014e000300000000000006990000010000000003c4a847000e004401b001a1006e006700200042006900670020004400690063006b00000000002d0004000000000000068f00000100000000021e023d00030414043e043d0000004468747470733a2f2f636865737363646e2e67616d65382e696f2f75706c6f61642f75736572732f3038352f33353532313038352e706e673f743d3137373335393935323100980005000000000000067e000000000000000081a15600050042006f0062006f00740000004368747470733a2f2f636865737363646e2e67616d65382e696f2f75706c6f61642f75736572732f3434362f383439353434362e706e673f743d31373732363034323633000c0006000000000000067b0000000000000003527e57000800560020004d0020004a00680065006b0000003768747470733a2f2f636865737363646e2e67616d65382e696f2f75706c6f61642f75736572732f3934332f35353733373934332e706e67007c000700000000000006740000000000000000352d9f0007005000610074007200690063006b0000003668747470733a2f2f636865737363646e2e67616d65382e696f2f75706c6f61642f75736572732f3038372f333438353038372e706e6700d80008000000000000066d0000010000000002eb7f6f0007004d006900680061006a006c006f0000004468747470733a2f2f636865737363646e2e67616d65382e696f2f75706c6f61642f75736572732f3031352f34383938383031352e706e673f743d3137373235343139343800060009000000000000066a00000100000000029178a10007004c0075007900e1006e006400610000004468747470733a2f2f636865737363646e2e67616d65382e696f2f75706c6f61642f75736572732f3033332f34333038383033332e706e673f743d3137373235353036353300d3000a0000000000000669000000000000000395bdd10008041c04380440043e0441043b043004320000004468747470733a2f2f636865737363646e2e67616d65382e696f2f75706c6f61642f75736572732f3130352f36303134353130352e706e673f743d31373732363037323634002c000b00000000000006680000000000000003b46cb0000800540068006500200048006f007000650000003768747470733a2f2f636865737363646e2e67616d65382e696f2f75706c6f61642f75736572732f3935322f36323135353935322e706e6700a3000c00000000000006670000000000000002d4e0010007004c0065006700610073007000690000003768747470733a2f2f636865737363646e2e67616d65382e696f2f75706c6f61642f75736572732f3430392f34373530353430392e706e670166000d00000000000006650000010000000001e2c8b8000800420065006e006a0061006d0069006e0000004468747470733a2f2f636865737363646e2e67616d65382e696f2f75706c6f61642f75736572732f3733362f33313633393733362e706e673f743d3137373236303635313500a3000e000000000000066200000000000000036e62530005004a006f0072006700650000004468747470733a2f2f636865737363646e2e67616d65382e696f2f75706c6f61642f75736572732f3737392f35373536353737392e706e673f743d3137373236303730353800ea000f000000000000066000000000000000025bac54000300420065006e0000004468747470733a2f2f636865737363646e2e67616d65382e696f2f75706c6f61642f75736572732f3332342f33393536323332342e706e673f743d3137373236303933363100ce0010000000000000065800000000000000029ee7240008005300750074007200690073006e006f0000004468747470733a2f2f636865737363646e2e67616d65382e696f2f75706c6f61642f75736572732f3239322f34333936383239322e706e673f743d31373739323434363431009e001100000000000006520000010000000000b8849a000600480065006e0064007200610000004468747470733a2f2f636865737363646e2e67616d65382e696f2f75706c6f61642f75736572732f3537302f31323039323537302e706e673f743d3137373235343231383901ac00120000000000000650000000000000000288082b0006005400650062006f0067006f0000003768747470733a2f2f636865737363646e2e67616d65382e696f2f75706c6f61642f75736572732f3431392f34323436393431392e706e67015f0013000000000000064e0000000000000003c72e6d0003004f005400420000000001710014000000000000064b00000001f200000000000005dc0000001d005400680061006e006b00730067006900760069006e006700200046006500730074006900760061006c002000320030003200360020005700340135007b0020002200700068006f0074006f0022003a0020002200680074007400700073003a002f002f00630064006e002e00670061006d006500760068002e006d0065002f00750070006c006f00610064002f0066006200690067002f00630068006500730073002f007400680061006e006b00730031002e0070006e00670022002c00200022006700750069006400650022003a0020002200680074007400700073003a002f002f00630064006e002e00670061006d006500760068002e006d0065002f00750070006c006f00610064002f0066006200690067002f00630068006500730073002f00670075006900640065005f002400740079007000650024005f0024006c006f00630061006c00650024002e00680074006d006c003f007600310022002c00200022006d0061007400630068002d006d0061006b0069006e00670022003a0020007b0020002200640022003a002000310030002c0020002200730022003a0020003300300020007d002c00200022006d00610074006300680022003a0020007b0020002200640065006e006f006d0069006e006100740069006f006e0022003a00200033002c00200022006d0061007400630068004400750072006100740069006f006e0022003a0020002200350022002c00200022007400750072006e004400750072006100740069006f006e0022003a00200022003300300022002c00200022006100630063004400750072006100740069006f006e0022003a0020002200300022002c0020002200660069007200730074005400750072006e004400750072006100740069006f006e0022003a002000220039003000220020007d0020007d010000000003c73a3a0007004c006f007200690061006e006e0000000000ef01f100000000000005dc00000001", "hex"));

/*******************************
              UI
*******************************/

function createWindow() {
    win = new BrowserWindow({
        fullscreen: false,
        width: 1024,
        minWidth: 1024,
        height: 518,
        webPreferences: {
            preload: path.join(__dirname, "preload.js")
        }
    });

    const template = [
        {
            label: "View",
            submenu: [
                {
                    label: "Reload",
                    role: "reload"
                },
                {
                    label: "Toggle Developer Tools",
                    role: "toggleDevTools"
                },
                {
                    label: "Fullscreen",
                    role: "togglefullscreen"
                },
                {
                    label: "Exit",
                    role: "quit"
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    if (DEBUG) {
        win.loadFile("menu.html");
    } else {
        fbLogin(win);
    }

    win.maximize();

    win.on("close", () => {
        if (socket) socket.close();

        if (engine) {
            try {
                engine.kill();
            } catch (error) {
                console.error(error);
            }
        }
    });
}

app.whenReady().then(createWindow);

app.on("quit", () => {
    if (socket) socket.close();

    if (engine) {
        try {
            engine.kill();
        } catch (error) {
            console.error(error);
        }
    }
});

app.on("window-all-closed", () => {
    if (engine) {
        try {
            engine.kill();
        } catch (error) {
            console.error(error);
        }
    }

    app.quit();
});

/*******************************
          GUI IPC
*******************************/

ipcMain.on("gui", (event, msg) => {

    if (msg.command == "connect") {
        initEngine(event.sender);
        connect(event.sender);

    } else if (msg.command == "disconnect") {
        if (socket) socket.close();

        if (engine) {
            engine.kill();
            engine = null;
        }

        engineReady = false;
        searchInProgress = false;
        pendingPosition = null;

    } else if (msg.command == "move") {
        let src = msg.params.src;
        let dst = msg.params.dst;
        let prom = msg.params.prom;

        let move = encodeMove(src, dst, prom);

        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(move);
        }

    } else if (msg.command == "path") {
        let pathMessage = getCurrentPath();

        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(pathMessage);
        }

    } else if (msg.command == "tournaments") {
        if (!win.webContents.getURL().includes("tournaments.html")) {
            win.loadFile("tournaments.html");
        } else {
          let list = getTournaments();
          socket.send(list);
        }
    } else if (msg.command == "tournament.enter") { console.log(msg);
      let tournamentId = msg.params.tournamentId;
      let tournament = enterTournament(tournamentId);
      socket.send(tournament);
      let fetchCurrent = fetchCurrentTournament();
      socket.send(fetchCurrent);
    } else if (msg.command == "lobby") {
        if (!win.webContents.getURL().includes("lobby.html")) {
            win.loadFile("lobby.html").then(() => {
                let lobby = enterPlace("Lobby.chess");
                socket.send(lobby);
            });
        } else {
            let lobby = enterPlace("Lobby.chess");
            socket.send(lobby);
        }

    } else if (msg.command == "join") {
        win.loadFile("game.html").then(() => {
            setTimeout(function () {
                event.sender.send("websocket", {
                    command: "ID_INFO",
                    params: {
                        playerId: msg.params.playerId,
                        roomId: msg.params.roomId,
                        tableId: msg.params.tableId
                    }
                });

                let table = getTableData(
                    msg.params.roomId,
                    msg.params.tableId
                );

                socket.send(table);

                let join = enterPlace(
                    `Lobby.chess.${msg.params.roomId}.${msg.params.tableId}`
                );

                socket.send(join);
                socket.send(table);
                socket.send(
                    Buffer.from("013a01", "hex")
                );

            }, 100);
        });

    } else if (msg.command == "room") {
        let room = enterChildPlace(msg.params.roomId);

        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(room);
        }

    } else if (msg.command == "menu") {
        win.loadFile("menu.html");
    } else if (msg.command == "game") {
        if (!win.webContents.getURL().includes("game.html")) {
            win.loadFile("game.html").then(() => {
                setTimeout(function () {
                    event.sender.send("websocket", {
                        command: "ID_INFO",
                        params: {
                            playerId: msg.params.playerId,
                            roomId: -1,
                            tableId: -1
                        }
                    });
                }, 100);

                let betAmountId = msg.params.betAmountId;
                let tableArgs = msg.params.tableArgs;
                let tableName = msg.params.tableName;

                let game = createTable(
                    betAmountId,
                    tableArgs,
                    tableName
                );

                socket.send(game);
            });
        }

    } else if (msg.command == "table") {
        let table = getTableData(
            msg.params.roomId,
            msg.params.tableId
        );

        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(table);
        }

    } else if (msg.command == "kick") {
        let playerId = msg.params.playerId;
        let kick = kickPlayer(playerId);

        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(kick);
        }

    } else if (msg.command == "hex") {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(
                Buffer.from(msg.params.data, "hex")
            );
        }
    }
});

/*******************************
         STOCKFISH IPC
*******************************/

// PROFE PINO EDIT #002 — Route renderer UCI commands into the engine;
// position requests automatically start a timed search.
ipcMain.on("uci", (event, msg) => {

    const command = cleanEnginePosition(msg);

    if (!command) return;

    console.log("UCI:", command);

    engineSender = event.sender;

    if (
        !engine ||
        !engine.stdin ||
        !engine.stdin.writable
    ) {
        console.log(
            "Stockfish is not running. Starting engine..."
        );

        initEngine(event.sender);
    }

    if (command.startsWith("position ")) {
        startEngineSearch(command);
        return;
    }

    if (command === "stop") {
        writeEngine("stop");
        return;
    }

    if (command === "uci") {
        if (engineReady) {
            writeEngine("uci");
        }

        return;
    }

    if (!engineReady) {
        console.log(
            "Stockfish is initializing. Command queued or deferred:",
            command
        );

        return;
    }

    writeEngine(command);
});
