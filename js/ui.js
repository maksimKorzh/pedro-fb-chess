const output = document.getElementById('output');
const input = document.getElementById('input');

var board = null, lock = 0, src = "", dst = "";

const coords = [
    "a1", "b1", "c1", "d1", "e1", "f1", "g1", "h1",
    "a2", "b2", "c2", "d2", "e2", "f2", "g2", "h2",
    "a3", "b3", "c3", "d3", "e3", "f3", "g3", "h3",
    "a4", "b4", "c4", "d4", "e4", "f4", "g4", "h4",
    "a5", "b5", "c5", "d5", "e5", "f5", "g5", "h5",
    "a6", "b6", "c6", "d6", "e6", "f6", "g6", "h6",
    "a7", "b7", "c7", "d7", "e7", "f7", "g7", "h7",
    "a8", "b8", "c8", "d8", "e8", "f8", "g8", "h8",
];

function hexToAscii(hex) {
  return hex.match(/.{1,2}/g)
    .map(byte => String.fromCharCode(parseInt(byte, 16)))
    .join('');
}

function activate() {
    let squares = document.getElementsByClassName("square-55d63");
    for (let i = 0; i < 64; i++) {
        let square = squares[i];
        square.onclick = function() { uClick(this.id); };
    }
}

function uClick(sq) {
    sq = sq.split("-")[0];
    if (!lock) { src = sq; lock = 1; } else {
        dst = sq;
        window.fbchess.sendCommand(src + dst);
        lock = 0;
    } let squares = document.getElementsByClassName("square-55d63");
    for (let i = 0; i < 64; i++)  {
        let square = squares[i];
        let current = square.id.split("-")[0];;
        if (current == src) square.classList.add("highlight");
        else square.classList.remove("highlight");
    }
};

// Send user move
function onDrop (src, dst) {
    lock = 0; if (src != dst) {
        var move = game.move({
            from: src,
            to: dst,
            promotion: 'q' // NOTE: always promote to a queen for example simplicity
        })

        // illegal move
        if (move === null) return 'snapback'
        else {
            src = coords.indexOf(src).toString(16).padStart(2, '0');
            dst = coords.indexOf(dst).toString(16).padStart(2, '0');
            let command = "01f6" + src + dst;
            window.fbchess.sendCommand(command);
        }

    }
}

function onSnapEnd() {
    board.position(game.fen());
}

var config = {
    draggable: true,
    position: "start",
    onDrop: onDrop,
    onSnapEnd: onSnapEnd
}; board = Chessboard('chessboard', config);
var game = new Chess();

window.addEventListener("resize", () => { board.resize(); activate(); });

// Print to UI console
function print(msg) {
    output.textContent += msg;
    output.scrollTop = output.scrollHeight;
}

// Extract player info
function getPlayerInfo(data) {
    let name = "";
    let coins = "";
    let rating = "";
    let hex = data.replaceAll(" ", '')
    let startOffset = 22;
    while (startOffset < hex.length) {
        let byte = parseInt(hex.slice(startOffset, startOffset + 2), 16)
        if (byte >= 48 && byte <= 119) name += String.fromCharCode(byte);

        if (hex.slice(startOffset, startOffset + 4) == "0000") {
            coins = parseInt(hex.slice(startOffset + 12, startOffset + 16), 16);
            rating = parseInt(hex.slice(startOffset + 28, startOffset + 32), 16);
            break;
        } startOffset += 2;
    } return {
        "name": name,
        "coins": coins.toString(),
        "rating": rating.toString()
    }
}

// Slot names
function extractStrings(hex) {
    const bytes = hex.match(/[0-9a-f]{2}/gi)?.map(b => parseInt(b, 16)) || [];
    const strings = [];

    for (let i = 0; i + 1 < bytes.length;) {
        if (bytes[i] >= 32 && bytes[i] <= 126 && bytes[i + 1] === 0) {
            let s = '';

            while (
                i + 1 < bytes.length &&
                bytes[i] >= 32 && bytes[i] <= 126 &&
                bytes[i + 1] === 0
            ) {
                s += String.fromCharCode(bytes[i]);
                i += 2;
            }

            // Handle a final character with a nonzero second byte
            if (
                i + 1 < bytes.length &&
                bytes[i] >= 32 && bytes[i] <= 126 &&
                bytes[i + 1] === 1
            ) {
                s += String.fromCharCode(bytes[i]);
                i += 2;
            }

            if (s.length >= 2) {
                strings.push(s);
            }
        } else {
            i++;
        }
    }

    return strings;
}

// Time control
function decodeClock(hex) {
    const bytes = hex.match(/.{2}/g).map(b => parseInt(b, 16));
    const player = bytes[2] === 1 ? 'Black' : 'White';
    const seconds = (bytes[5] << 8) | bytes[6];
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${player}: ${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

window.fbchess.onData((data) => {
    let hex = data.replaceAll(" ", "");
    
    if (data.includes("WebSocket")) print(data)
    console.log(data.replaceAll(" ", ""), hexToAscii(data.replaceAll(" ", "")));
    
    // Update move on board
    if (data.startsWith("02 11")) {
        let src = coords[parseInt(data.split(" ")[2], 16)];
        let dst = coords[parseInt(data.split(" ")[3], 16)];
        game.move({
            from: src,
            to: dst,
            promotion: 'q' // NOTE: always promote to a queen for example simplicity
        }); board.position(game.fen());
        requestAnimationFrame(() => {
            $("#chessboard").find('.square-55d63').removeClass('highlight');
            $("#chessboard").find('.square-' + src).addClass('highlight');
            $("#chessboard").find('.square-' + dst).addClass('highlight');
        });
    }
    
    // Set player status
    else if (data.startsWith("01 a5")) {
        print("Opponent is ready\n");
    }
        
    // Game started
    else if (data.startsWith("01 a1")) {
        let side = parseInt(hex.slice(-2)[0]);
        board.flip((side == 0 ? "white" : "black"));
        board.position("start");
        game = new Chess();
        requestAnimationFrame(() => {
            $("#chessboard").find('.square-55d63').removeClass('highlight');
        }); print(`Game started\n`);
    }
    
    // Game over
    else if (data.startsWith("01 a2")) {
        requestAnimationFrame(() => {
            $("#chessboard").find('.square-55d63').removeClass('highlight');
        });
        print("Game finished\n");
    }

    // Player entered
    else if (data.startsWith("01 96")) {
        let player = getPlayerInfo(data);
        print(`Player entered ${player.name}(${player.rating}) with ${player.coins} coins\n`)
    }
    
    // Player exited
    else if (data.startsWith("01 97")) {
        print("Player exited\n")
    }
    
    // Slot changed
    else if (data.startsWith("01 a0")) {
        //                           side ?
        // 01a00004004a00750061006e   01    00000000001db8b3000000000000047906007a4468747470733a2f2f636865737363646e2e67616d65382e696f2f75706c6f61642f75736572732f3338302f31383336353338302e706e673f743d3137373235373937353901000000000001183bc4000000000000000002434f
        let name = extractStrings(hex)[0];
        print(`Slot in table: "${name.replace("undefined", "none")}"\n`)
    }
    
    // Clock
    else if (data.startsWith("01 a4")) {
        print(decodeClock(hex) + "\n");
    }
});

input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        const cmd = input.value;
        if (cmd == "click") {
            var config = {
                draggable: false,
                position: "start",
            }; board = Chessboard('chessboard', config);
            input.value = ""; activate(); window.fbchess.sendCommand("refresh"); return;
        } else if (cmd == "drag") {
            var config = {
                draggable: true,
                position: "start",
                onDrop: onDrop
            }; board = Chessboard('chessboard', config);
            input.value = ""; window.fbchess.sendCommand("refresh"); return;
        } else if (cmd == "flip") {
            board.flip();
            input.value = "";
            return;
        }
        
        src = coords.indexOf(cmd[0] + cmd[1]).toString(16).padStart(2, '0');
        dst = coords.indexOf(cmd[2] + cmd[3]).toString(16).padStart(2, '0');
        
        // Send user move
        if (src != "-1" && dst != "-1") {
            let move = "01f6" + src + dst;
            console.log("play move", move);
            window.fbchess.sendCommand(move);
        } else window.fbchess.sendCommand(cmd);
        
        input.value = "";
        let terminal = document.getElementById("output");
        terminal.scrollTop = terminal.scrollHeight;
    }
});