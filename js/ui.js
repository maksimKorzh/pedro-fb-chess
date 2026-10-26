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
        src = coords.indexOf(src).toString(16).padStart(2, '0');
        dst = coords.indexOf(dst).toString(16).padStart(2, '0');
        let command = "01f6" + src + dst;
        window.fbchess.sendCommand(command);
    }
}

var config = {
    draggable: true,
    position: "start",
    onDrop: onDrop
}; board = Chessboard('chessboard', config);

window.addEventListener("resize", () => { board.resize(); activate(); });

window.fbchess.onData((data) => {
    output.textContent += data;
    output.scrollTop = output.scrollHeight;
    
    console.log(data.replaceAll(" ", ""), hexToAscii(data.replaceAll(" ", "")));

    // Reset board
    if (data.startsWith("01 af")) board.position("start");
    
    // Update move on board
    else if (data.startsWith("02 11")) {
        let src = coords[parseInt(data.split(" ")[2], 16)];
        let dst = coords[parseInt(data.split(" ")[3], 16)];
        board.move(`${src}-${dst}`);
        console.log(`Move: ${src}-${dst}`);
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
        }
        
        /*src = coords.indexOf(cmd[0] + cmd[1]).toString(16).padStart(2, '0');
        dst = coords.indexOf(cmd[2] + cmd[3]).toString(16).padStart(2, '0');
        
        // Send user move
        if (src != "-1" && dst != "-1") {
            let move = "01f6" + src + dst;
            console.log("play move", move);
            window.fbchess.sendCommand(move);
        } else window.fbchess.sendCommand(cmd);*/
        
        console.log(cmd)
        window.fbchess.sendCommand(cmd);
        
        input.value = "";
        let terminal = document.getElementById("output");
        terminal.scrollTop = terminal.scrollHeight;
    }
});