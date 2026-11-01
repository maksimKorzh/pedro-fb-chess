const output = document.getElementById('output');
const input = document.getElementById('input');

let player = {};
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

function createCommand(command, params = {}) { return { command, params }; }

function hexToAscii(hex) {
  return hex.match(/.{1,2}/g)
    .map(byte => String.fromCharCode(parseInt(byte, 16)))
    .join('');
}

function sendMove(src, dst, prom) {
    let msg = createCommand("move", {src, dst, prom});
    window.fbchess.sendGUICommand(msg);
}

// Send user move
function onDrop (src, dst) {
    if (src != dst) {
        let prom = 0;
        var move = game.move({
            from: src,
            to: dst,
            promotion: 'q' // NOTE: always promote to a queen for example simplicity
        }); try { if (move.flags.includes("p")) prom = 1; }
        catch (e) {}; if (move === null) return 'snapback'
        else {
            src = coords.indexOf(src);
            dst = coords.indexOf(dst);            
            sendMove(src, dst, prom);
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


function highlightLastMove(src, dst) {
    requestAnimationFrame(() => {
        $("#chessboard").find('.square-55d63').removeClass('highlight');
        $("#chessboard").find('.square-' + src).addClass('highlight');
        $("#chessboard").find('.square-' + dst).addClass('highlight');
    });
}

function unhighlight() {
    requestAnimationFrame(() => {
        $("#chessboard").find('.square-55d63').removeClass('highlight');
    });
}

window.fbchess.onWebSocketMsg((data) => {
    // Logs
    console.log(data);
    
    if (data.command.includes("WebSocket")) print(data.command + "\n");
    
    // Update board
    if (data.command == "MOVE") {
        let src = data.params.src;
        let dst = data.params.dst;
        game.move({
            from: src,
            to: dst,
            promotion: 'q' // NOTE: always promote to a queen for example simplicity
        }); board.position(game.fen());
        highlightLastMove(src, dst);
    }
    
    // Player status
    if (data.command == "LOGIN_FB_SIGNATURE2") {
        player = {
            "id": data.params.playerId,
            "name": data.params.playerFullName,
            "slot": -1
        }; print(`${player.name} logged in\n`)
    }
    
    // Player status
    /*if (data.command == "SET_PLAYER_STATUS") { // this looks to be reflecting player ready, not opponent like I thought
        let tableSlot = data.params.tableSlot;
        let matchPoint = data.params.matchPoint;
        let color = "";
        if (tableSlot == 0) color == "White";
        if (tableSlot == 1) color == "Black";
        //if (color != "") print(`${color} is ${matchPoint}, type "start" [optionally]\n`)
    }*/
    
    // Game started
    if (data.command == "START_MATCH") {
        board.position("start");
        game = new Chess();
        if (player.slot == 0) board.flip("white");
        if (player.slot == 1) board.flip("black");
        unhighlight;
        print(`Game started\n`);
    }
    
    // Game finished
    if (data.command == "GAME_OVER") {
        unhighlight();
        print("Game finished\n");
    }
    
    // Player entered
    if (data.command == "PLAYER_ENTERED") {
        let name = data.params.playerName;
        let rating = data.params.playerEloRating;
        let coins = data.params.playerChipBalance;
        print(`${name}(${rating}) entered with ${coins} coins\n`)
    }
    
    // Player entered
    if (data.command == "PLAYER_EXITED") {
        print("Player exited\n");
    }
    
    // Table slot changed
    if (data.command == "SLOT_IN_TABLE_CHANGED") {
        let playerId = data.params.playerId;
        let playerName = data.params.playerName;
        let playerEloRating = data.params.playerEloRating;
        let tableSlot = data.params.tableSlot;
        let color = "";
        if (tableSlot == 0) color = "White";
        if (tableSlot == 1) color = "Black";
        let you = (player.id == playerId);
        if (you) player.slot = tableSlot;
        if (playerName == "") print(`${color} slot is empty\n`);
        else print(`${(you ? "(you)" : "") + playerName}(${playerEloRating}) is ${color}\n`);
    }
    
    // Clock
    if (data.command == "SET_TURN") {
        let tableSlot = data.params.tableSlot;
        let color = "";
        if (tableSlot == 0) color = "White";
        if (tableSlot == 1) color = "Black";
        let time = data.params.formatTimeLeft;
        if (tableSlot != -2) print(`${color} ${time}\n`);
    }
});

// Engine move
window.fbchess.onEngineMsg((data) => {
    let prom = 0;
    let msg = JSON.parse(data);
    let src = msg.src;
    let dst = msg.dst;
    console.log(msg);
    var move = game.move({
        from: src,
        to: dst,
        promotion: 'q'
    }); try { if (move.flags.includes("p")) prom = 1; }
    catch (e) {}
    src = coords.indexOf(src);
    dst = coords.indexOf(dst);
    sendMove(src, dst, prom);
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
        
        if (cmd == "connect") {
            let msg = createCommand("connect");
            window.fbchess.sendGUICommand(msg);
        } if (cmd == "disconnect") {
            let msg = createCommand("disconnect");
            window.fbchess.sendGUICommand(msg);
        } else if (cmd == "path") {
            let msg = createCommand("path");
            window.fbchess.sendGUICommand(msg);
        } else if (cmd == "game") {
            let createGame = [
                // Enter place
                "01910b4c6f6262792e6368657373000000056368657373",
                
                // Enter child place
                "01920133000000",

                // match 15 main time, 60s per move
                "019502030d6d617463684475726174696f6e0002003100350c7475726e4475726174696f6e0002003900300b6163634475726174696f6e0001003000"
            ]; for (let msg of createGame) window.fbchess.sendGUICommand(createCommand("hex", {data: msg}));
        } else if (cmd == "start") {
            window.fbchess.sendGUICommand(createCommand("hex", {data: "012b"}));
        } else if (cmd == "resign") {
            window.fbchess.sendGUICommand(createCommand("hex", {data: "0216"}));
        } else { // Send user move
            let src = coords.indexOf(cmd[0] + cmd[1]);
            let dst = coords.indexOf(cmd[2] + cmd[3]);
            let prom = (cmd[4] == undefined) ? 0 : 1;
            if (src != "-1" && dst != "-1") sendMove(src, dst, prom);
            else window.fbchess.sendGUICommand(cmd);
        }
        
        // Clear command, scroll terminal
        input.value = "";
        let terminal = document.getElementById("output");
        terminal.scrollTop = terminal.scrollHeight;
    }
});

// Stockfish button
document.getElementById("stockfish").addEventListener("click", function() {
    window.fbchess.sendUCICommand(`position fen '${game.fen()}'`);
    window.fbchess.sendUCICommand("go time 1");
});