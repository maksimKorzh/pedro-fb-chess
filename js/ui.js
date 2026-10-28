const output = document.getElementById('output');
const input = document.getElementById('input');

let userName = ""; userSide = 0;
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

// Send user move
function onDrop (src, dst) {
    if (src != dst) {
        let prom = 0;
        
        var move = game.move({
            from: src,
            to: dst,
            promotion: 'q' // NOTE: always promote to a queen for example simplicity
        });
        
        // Promotion
        try { if (move.flags.includes("p")) prom = 1; }
        catch (e) {}

        // Illegal move
        if (move === null) return 'snapback'
        else {
            src = coords.indexOf(src).toString(16).padStart(2, '0');
            dst = coords.indexOf(dst).toString(16).padStart(2, '0');
            let command = "01f6" + src + dst;
            
            // promotion
            if (prom) command += "01";
            
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

window.addEventListener("resize", () => { board.resize(); });

// Print to UI console
function print(msg) {
    output.textContent += msg;
    output.scrollTop = output.scrollHeight;
}

// Extract player info
function getPlayerInfo(hex) {
    let name = "";
    let coins = "";
    let rating = "";
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
function getSlot(hex) {
    const bytes = hex.match(/[0-9a-f]{2}/gi)?.map(b => parseInt(b, 16)) || [];
    let side = 0;
    for (let i = 0; i + 1 < bytes.length;) {
        if (bytes[i] >= 32 && bytes[i] <= 126 && bytes[i + 1] === 0) {
            let name = '';
            while ( i + 1 < bytes.length && bytes[i] >= 32 && bytes[i] <= 126 && bytes[i + 1] === 0 ) {
                name += String.fromCharCode(bytes[i]);
                i += 2;
            } if (i + 1 < bytes.length && bytes[i] >= 32 && bytes[i] <= 126 && bytes[i + 1] === 1) {
                name += String.fromCharCode(bytes[i]);
                side = 1;
                i += 2;
            } if (name.length >= 2) return { "name": name, "side": side };
        } else i++;
    } return { name: 'empty', side: -1 };
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
    if (data.includes("WebSocket")) print(data);
    console.log(data.replaceAll(" ", ""), hexToAscii(data.replaceAll(" ", "")));
    
    // Update move on board
    if (data.startsWith("0211")) {
        let src = coords[parseInt((data[4] + data[5]), 16)];
        let dst = coords[parseInt((data[6] + data[7]), 16)];
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
    else if (data.startsWith("01a5")) {
        print("Opponent is ready, accepting match...\n");
        window.fbchess.sendCommand("012b");
    }
        
    // Game started
    else if (data.startsWith("01a1")) {
        window.fbchess.sendCommand("data", "uci:ucinewgame");
        board.position("start");
        game = new Chess();
        board.flip((userSide == 1 ? "black" : "white"));
        requestAnimationFrame(() => {
            $("#chessboard").find('.square-55d63').removeClass('highlight');
        }); print(`Game started\n`);
    }
    
    // Game over
    else if (data.startsWith("01a2")) {
        requestAnimationFrame(() => {
            $("#chessboard").find('.square-55d63').removeClass('highlight');
        }); print("Game finished\n");
    }

    // Player entered
    else if (data.startsWith("0196")) {
        let player = getPlayerInfo(data);
        if (userName == "") userName = player.name;
        print(`Player entered ${player.name}(${player.rating}) with ${player.coins} coins\n`)
    }
    
    // Player exited
    else if (data.startsWith("0197")) {
        print("Player exited\n")
    }
    
    // Slot changed
    else if (data.startsWith("01a0")) {
        let slot = getSlot(data);
        let name = slot.name;
        let side = slot.side;
        let color = (side ? "Black" : "White");
        let you = (name == userName);
        if (you) userSide = side;
        print(`${color} is ${name + (you ? "(you)" : "")}\n`);
    }
    
    // Clock
    else if (data.startsWith("01a4")) {
        let time = decodeClock(data);
        if (!time.includes("0:00") && !time.includes("15:00")) print(time + "\n");
    }
    
    // Engine move
    else if (data.includes("uci:")) {
        data = data.split("uci:")[1];
        let prom = 0;
        let src = data[0] + data[1];
        let dst = data[2] + data[3];
        console.log("best move:", src+dst)
        
        var move = game.move({
            from: src,
            to: dst,
            promotion: 'q'
        });
        
        // Promotion
        try { if (move.flags.includes("p")) prom = 1; }
        catch (e) {}

        src = coords.indexOf(src).toString(16).padStart(2, '0');
        dst = coords.indexOf(dst).toString(16).padStart(2, '0');
        let command = "01f6" + src + dst;
        
        // promotion
        if (prom) command += "01";    
        
        // Send engine move
        window.fbchess.sendCommand(command);
    }
});

input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        const cmd = input.value;
        
        // Temp
        if (cmd == "flip") {
            board.position(game.fen());
            board.flip();
            input.value = "";
            return;
        }
        
        /******************************\
         ==============================
         
                 SERVER COMMANDS
                 
         ==============================
        \******************************/
        
        if (cmd == "game") {
            let createGame = [
                "01910b4c6f6262792e6368657373000000056368657373",
                "01920133000000",
                "02eb0b4c6f6262792e6368657373",
                "015b00",
                "01ae056368657373",
                "019b01",
                
                // match 15 main time, 60s per move
                "019502030d6d617463684475726174696f6e0002003100350c7475726e4475726174696f6e0002003900300b6163634475726174696f6e0001003000"
            ]; for (let msg of createGame) window.fbchess.sendCommand(msg);
        } else if (cmd == "start") {
            window.fbchess.sendCommand("012b");
        } else if (cmd == "resign") {
            window.fbchess.sendCommand("0216");
        } else if (cmd == "move") {
            // Sync engine
            window.fbchess.sendCommand(`uci:position fen '${game.fen()}'`);
            
            // Make best move
            window.fbchess.sendCommand("uci:go time 1");
        } else {
            // Send user move
            src = coords.indexOf(cmd[0] + cmd[1]).toString(16).padStart(2, '0');
            dst = coords.indexOf(cmd[2] + cmd[3]).toString(16).padStart(2, '0');
            if (src != "-1" && dst != "-1") {
                let move = "01f6" + src + dst;
                console.log("play move", move);
                window.fbchess.sendCommand(move);
            } else window.fbchess.sendCommand(cmd);
        }
        
        // Clear command, scroll terminal
        input.value = "";
        let terminal = document.getElementById("output");
        terminal.scrollTop = terminal.scrollHeight;
    }
});