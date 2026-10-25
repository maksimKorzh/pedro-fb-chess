let userName = "";

const output = document.getElementById('output');
const input = document.getElementById('input');

var board = null, lock = 0, src = "", dst = "";

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

var config = {
    draggable: true,
    position: "start",
    onDrop: function (src, dst) {
        if (src != dst) window.fbchess.sendCommand(src + dst);
    }
}; board = Chessboard('chessboard', config);

window.addEventListener("resize", () => { board.resize(); activate(); });

function style12ToFEN(input) {  // use command: set style 12
    const fields = input.trim().split(/\s+/);
    if (fields[0] !== "<12>" || fields.length < 22) throw new Error("Invalid or incomplete FICS style-12 message");
    const board = fields.slice(1, 9);
    const fenBoard = board.map(rank => {
        let result = "";
        let empty = 0;
        for (const piece of rank) {
            if (piece === "-") empty++;
            else {
                if (empty > 0) {
                    result += empty;
                    empty = 0;
                } result += piece;
            }
        } if (empty > 0) result += empty;
    return result;
    }).join("/");
    const sideToMove = fields[9].toLowerCase() === "b" ? "b" : "w";
    const castlingRights = fields[10];
    const enPassantFile = Number(fields[11]);
    const halfmoveClock = Number(fields[14]);
    const fullmoveNumber = Number(fields[15]);
    let castling = "";
    if (castlingRights & 1) castling += "K";
    if (castlingRights & 2) castling += "Q";
    if (castlingRights & 4) castling += "k";
    if (castlingRights & 8) castling += "q";
    if (!castling) castling = "-";
    let enPassant = "-";
    if (enPassantFile >= 0 && enPassantFile <= 7) {
        const rank = sideToMove === "w" ? "6" : "3";
        enPassant = "abcdefgh"[enPassantFile] + rank;
    } return `${fenBoard} ${sideToMove} ${castling} ${enPassant} ${halfmoveClock} ${fullmoveNumber}`;
}

window.fbchess.onData((data) => {
    output.textContent += data;
    output.scrollTop = output.scrollHeight;

    if (data.includes("Starting FICS session as ")) {
        userName = data
            .split("Starting FICS session as ")[1]
            .trim()
            .split(/\s/)[0]
            .split("(U)")[0];
        window.fbchess.sendCommand("set style 12");
        return;
    }

    if (data.includes("<12>")) {
        const input = data.split("\u0007\n");
        const position = input.find( i => i.trimStart().startsWith("<12>"));
        if (!position) return;
        const fen = style12ToFEN(position.trim());
        board.position(fen, false);
        requestAnimationFrame(() => {
            let hl = data.split(")")[1].trim().split(" ")[0].replace("+", "").slice(-2);
            if (data.includes("O-O-O")) {
                if (fen.includes(" w ")) hl = "c8";
                else if (fen.includes(" b ")) hl = "c1";
            } else if (data.includes("O-O")) {
                if (fen.includes(" w ")) hl = "g8";
                else if (fen.includes(" b ")) hl = "g1";
            }
            $("#chessboard").find('.square-55d63').removeClass('highlight');
            $("#chessboard").find('.square-' + hl).addClass('highlight');
        });
        
        

    }
    
    if (data.includes(userName)) {
        if (data.includes("Illegal move") || !data.includes("<12>")) return;
        if (data.indexOf(userName) < 100) board.orientation("white");
        else board.orientation("black");
    }
    
    activate();
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
                onDrop: function (src, dst) {
                    lock = 0; if (src != dst)
                    window.fbchess.sendCommand(src + dst);
                }
            }; board = Chessboard('chessboard', config);
            input.value = ""; window.fbchess.sendCommand("refresh"); return;
        }
        window.fbchess.sendCommand(cmd);
        input.value = "";
        let terminal = document.getElementById("output");
        terminal.scrollTop = terminal.scrollHeight;
    }
});