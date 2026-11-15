/******************************\
 ==============================
 
     WebSocket interaction

 ==============================
\******************************/

function createCommand(command, params = {}) { return { command, params }; }

// Reconnect to server
msg = createCommand("disconnect"); window.fbchess.sendGUICommand(msg);
msg = createCommand("connect"); window.fbchess.sendGUICommand(msg);

// Logged user
var player = {}

// List tournamets command
function listContests() {
    msg = createCommand("tournaments"); window.fbchess.sendGUICommand(msg);
}

window.fbchess.onWebSocketMsg((data) => {
    // Logs
    console.log(data);
    
    // Connection
    if (data.command == "Connected to WebSocket") {
        document.getElementById("connection-status").innerText = "CONNECTED"
    } else if (data.command == "WebSocket connection closed") {
        document.getElementById("connection-status").innerText = "DISCONNECTED"
    }
    
    // Player status
    if (data.command == "LOGIN_FB_SIGNATURE2") {
        player = {
            "id": data.params.playerId,
            "name": data.params.playerFullName,
            "slot": -1
        };
        
        if (data.params.activeTournaments >= 1) {
            listContests();
        }
    }
});

// Go back to menu button
document.getElementById("menu").addEventListener("click", () => {
    msg = createCommand("menu", {}); window.fbchess.sendGUICommand(msg);
});