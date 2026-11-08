const output = document.getElementById('output');
const input = document.getElementById('input');

let player = {};
var board = null, side = 0, lock = 0, src = "", dst = "";

var intervalId;
var whiteTime = 0, blackTime = 0, whiteCountdown = 0, blackCountdown = 0;
var opponentId = 0;

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

function startInterval() {
  if (!intervalId) { // Prevent multiple intervals from being set
    intervalId = setInterval(() => {
      if (side == 1) {
        blackTime -= 1;
        blackCountdown -= 1;
      } else {
          whiteTime -= 1;
          whiteCountdown -= 1;
      } updateTimer();
    }, 1000);
  }
}

function stopInterval() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
      blackTime = 0;
      whiteTime = 0;
      whiteCountdown = 0;
      blackCountdown = 0;
      updateTimer();
      document.getElementById('black-clock').innerHTML = '00:00';
      document.getElementById('white-clock').innerHTML = '00:00';
    }
}

function updateTimer() {
    if (whiteCountdown > 0 && whiteTime <= 0) {
        document.getElementById("stats").innerText = "Game starts in " + whiteCountdown + " sec, you may click \"start\"";
        if (whiteCountdown == 1 && opponentId) {
            let msg = createCommand("kick", {"playerId": opponentId});
            window.fbchess.sendGUICommand(msg);
        }
    } if (blackTime < 0 || whiteTime < 0 || whiteCountdown < 0 || blackCountdown < 0) return;
    document.getElementById('black-clock').innerHTML = secToMin(blackTime);
    document.getElementById('white-clock').innerHTML = secToMin(whiteTime);
    document.getElementById('black-countdown').innerHTML = secToMin(blackCountdown);
    document.getElementById('white-countdown').innerHTML = secToMin(whiteCountdown);
}

function secToMin(sec) {
  const minutes = Math.floor(sec / 60);
  const seconds = sec % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

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

function setPlayer(color, playerId, playerName, playerElo, avatarUrl) {
    let avatar = document.getElementById(color + "-avatar");
    avatar.style.backgroundImage = avatarUrl ? `url("${avatarUrl}")` : "none";
    let name = document.getElementById(color + "-name");
    name.innerText = `${playerName}${(playerElo ? ("(" + playerElo + ")") : "")}`;
    if (playerId != player.id) opponentId = playerId;
}

window.fbchess.onWebSocketMsg((data) => {
    // Logs
    console.log(data);
    
    if (data.command.includes("WebSocket")) {
        document.getElementById("stats").innerText = data.command;
        print(data.command + "\n");
    }
    
    // Create new game
    /*if (data.command == "CREATE_RULE") {
        let msg = createCommand("game", {
            "betAmountId": data.params.betAmountId.toString(),
            "tableArgs": data.params.tableArgs,
            "tableName": data.params.tableName
        }); window.fbchess.sendGUICommand(msg);
    }*/
    
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
        };
        
        document.getElementById("stats").innerText = `${player.name} logged in`;
        print(`${player.name} logged in\n`)
    }
    
    // Game started
    if (data.command == "START_MATCH") {
        board.position("start");
        game = new Chess();
        unhighlight();
        document.getElementById("stats").innerText = "Game in progress";
        print(`Game started\n`);
    }
    
    // Game finished
    if (data.command == "GAME_OVER") {
        unhighlight();
        stopInterval();
        document.getElementById("stats").innerText = "Game finished";
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
        document.getElementById("stats").innerText = "Player exited";
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
        setPlayer(color, playerId, playerName, playerElo, avatarUrl);
        document.getElementById(color + "-avatar").playerId = playerId;
    }
    
    // Ready state
    if (data.command == "SET_PLAYER_STATUS") {
        let TableSlot = data.params.tableSlot;
        let color = "";
        if (tableSlot == 0) color = "white";
        if (tableSlot == 1) color = "black";
        print(`${data.params.tableSlot} ${data.params.matchPoint}\n`);
    }

    // Clock
    if (data.command == "SET_TURN") {
        let tableSlot = data.params.tableSlot;
        let color = "";
        if (tableSlot == 0) color = "white", side = 0;
        if (tableSlot == 1) color = "black", side = 1;
        let time = data.params.formatTimeLeft;
        let countdown = data.params.formatCountdown;
        if (tableSlot != -2) {
            document.getElementById(color + "-countdown").innerText = countdown;
            document.getElementById(color + "-clock").innerText = time;
            if (color == "white") {
                whiteTime = Math.floor(data.params.timeLeft / 1000);
                whiteCountdown = data.params.countdown;
            }
            if (color == "black") {
                blackTime = Math.floor(data.params.timeLeft / 1000);
                blackCountdown = data.params.countdown;
            }
        } else {
            side = 0;
            whiteTime = -100;
            whiteCountdown = data.params.countdown;
            startInterval();
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
            setPlayer("white", 0, "White Player", "", "");
            setPlayer("black", 0, "Black Player", "", "");
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
            window.fbchess.sendGUICommand(createCommand("hex", {data: "012b"})); // set ready
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

// Create new table button
/*document.getElementById("game").addEventListener("click", function() {
    let msg = createCommand("lobby");
    window.fbchess.sendGUICommand(msg);
    setPlayer("white", 0, "White Player", "", "");
    setPlayer("black", 0, "Black Player", "", "");
    board.position("start");
    game = new Chess();
    msg = createCommand("room", {"roomId": "3"});
    window.fbchess.sendGUICommand(msg);
    msg = createCommand("game", {
        "betAmountId": "2",
        "tableArgs": {
            "matchDuration": "15",
            "turnDuration": "90",
            "accDuration": "0"
        },
        "tableName": ""
    }); window.fbchess.sendGUICommand(msg);
});*/

// Enter lobby button
document.getElementById("lobby").addEventListener("click", function() {
    let msg = createCommand("lobby");
    window.fbchess.sendGUICommand(msg);
    /*setPlayer("white", 0, "White Player", "", "");
    setPlayer("black", 0, "Black Player", "", "");
    board.position("start");
    document.getElementById("stats").innerText = "...";*/
});

// Connect to server button
/*document.getElementById("connect").addEventListener("click", function() {
    let msg = createCommand("connect");
    window.fbchess.sendGUICommand(msg);
});

// Disonnect from server button
document.getElementById("disconnect").addEventListener("click", function() {
    let msg = createCommand("disconnect");
    window.fbchess.sendGUICommand(msg);
    stopInterval();
    document.getElementById("stats").innerText = "...";
});*/

// Start button
document.getElementById("start").addEventListener("click", function() {
    //let msg = createCommand("start");
    //window.fbchess.sendGUICommand(msg);
    window.fbchess.sendGUICommand(createCommand("hex", {data: "012b"})); // set ready
    //stopInterval();
    //document.getElementById("start").innerText = "Start";
});

// Resign button
document.getElementById("resign").addEventListener("click", function() {
    //let msg = createCommand("resign");
    //window.fbchess.sendGUICommand(msg);
    window.fbchess.sendGUICommand(createCommand("hex", {data: "0216"}));
});

// Stockfish button
document.getElementById("stockfish").addEventListener("click", function() {
    window.fbchess.sendUCICommand(`position fen '${game.fen()}'`);
    window.fbchess.sendUCICommand("go time 1");
});

// Kick opponent
document.getElementById("white-avatar").addEventListener("click", (i) => {
    let playerId = i.target.playerId;
    if (playerId != player.id) {
        console.log("kick", player.id, playerId);        
        let msg = createCommand("kick", {"playerId": playerId});
        window.fbchess.sendGUICommand(msg);
    }
});

document.getElementById("black-avatar").addEventListener("click", (i) => {
    let playerId = i.target.playerId;
    if (playerId != player.id) {
        console.log("kick", player.id, playerId);        
        let msg = createCommand("kick", {"playerId": playerId});
        window.fbchess.sendGUICommand(msg);
    }
});