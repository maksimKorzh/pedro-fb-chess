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

function setPlayer(color, playerName, playerElo, avatarUrl) {
    let avatar = document.getElementById(color + "-avatar");
    avatar.style.backgroundImage = avatarUrl ? `url("${avatarUrl}")` : "none";
    let name = document.getElementById(color + "-name");
    name.innerText = `${playerName}${(playerElo ? ("(" + playerElo + ")") : "")}`;
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
    
    // Game started
    if (data.command == "START_MATCH") {
        board.position("start");
        game = new Chess();
        //if (player.slot == 0) board.orientation("white");
        //if (player.slot == 1) board.orientation("black");
        unhighlight();
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
        let playerElo = data.params.playerEloRating;
        let tableSlot = data.params.tableSlot;
        let avatarUrl = data.params.avatarUrl;
        let color = "";
        if (tableSlot == 0) color = "white";
        if (tableSlot == 1) color = "black";
        let you = (player.id == playerId);
        if (you) {
            player.slot = tableSlot;
            board.orientation(color);
        }
        if (playerName == "") print(`${color} slot is empty\n`);
        else print(`${(you ? "(you)" : "") + playerName}(${playerElo}) is ${color}\n`);
        setPlayer(color, playerName, playerElo, avatarUrl);
    }
    
    // Clock
    if (data.command == "SET_TURN") {
        let tableSlot = data.params.tableSlot;
        let color = "";
        if (tableSlot == 0) color = "white";
        if (tableSlot == 1) color = "black";
        let time = data.params.formatTimeLeft;
        let countDown = data.params.formatCountDown;
        if (tableSlot != -2) {
            document.getElementById(color + "-countdown").innerText = countDown;
            document.getElementById(color + "-clock").innerText = time;
        }
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
        if (cmd == "flip") { // temp
            board.position(game.fen());
            board.flip();
            input.value = "";
            return;
        } else if (cmd == "connect") {
            let msg = createCommand("connect");
            window.fbchess.sendGUICommand(msg);
        } if (cmd == "disconnect") {
            let msg = createCommand("disconnect");
            window.fbchess.sendGUICommand(msg);
        } else if (cmd == "path") {
            let msg = createCommand("path");
            window.fbchess.sendGUICommand(msg);
        } else if (cmd == "lobby") {
            let msg = createCommand("lobby");
            window.fbchess.sendGUICommand(msg);
            setPlayer("white", "White Player", "", "");
            setPlayer("black", "Black Player", "", "");
            board.position("start");
            game = new Chess();
        } else if (cmd == "room") {
            let msg = createCommand("room", {"roomId": "3"});
            window.fbchess.sendGUICommand(msg);
        } else if (cmd == "game") {
            let msg = createCommand("game", {
                "betAmountId": "2",
                "tableArgs": {
                    "matchDuration": "15",
                    "turnDuration": "90",
                    "accDuration": "0"
                },
                "tableName": ""
            }); window.fbchess.sendGUICommand(msg);
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