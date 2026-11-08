/******************************\
 ==============================
 
     WebSocket interaction

 ==============================
\******************************/

const MAX_CHALLEGES = 10;

const BET = {
    "0": 50,
    "1": 100,
    "2": 250,
    "3": 500,
    "4": 1000,
    "5": 2500,
    "6": 5000,
    "7": 10000,
    "8": 25000,
    "9": 50000,
    "10": 100000,
    "11": 250000,
    "12": 500000,
    "13": 1000000,
    "14": 0
};

var challenges = 0;
let msg;
function createCommand(command, params = {}) { return { command, params }; }

// Reconnect to server
msg = createCommand("disconnect"); window.fbchess.sendGUICommand(msg);
msg = createCommand("connect"); window.fbchess.sendGUICommand(msg);

// Logged user
var player = {}

// Add room
function addRoom(id, name, tables, players, selected) {
    document.getElementById("room-list").innerHTML += `
        <div id="${id}" class="room ${selected}">
            <div class="room-top">
                <span class="room-name">${name}</span>
                <span class="room-status"></span>
            </div>
            <div class="room-stats">
                <span>♟ ${tables} tables</span>
                <span>● ${players} players</span>
            </div>
        </div>
    `; document.getElementById(0).click();
}

// Add challenge
function addChallenge(id, name, bet, slots, playing, invite) {
    if (challenges >= MAX_CHALLEGES) {
        document.getElementById("challenge-list").innerHTML = "";
        challenges = 0;
        return;
    } document.getElementById("challenge-list").innerHTML += `
        <div class="challenge">
            <div class="challenge-info">
                <span class="challenge-name">${name}</span>
                <div class="challenge-details">
                    <span class="id tag">${id}</span>
                    <span class="players tag">${slots} players</span>
                    <span class="playing tag">${playing ? "in progress" : "available"}</span>
                    <span class="invite tag">${invite ? "private" : "public"}</span>
                    <span class="bet">Bet: ${BET[bet]}</span>
                </div>
            </div>
            <div class="challenge-actions">
                <button class="primary accept-challenge">Accept</button>
            </div>
        </div>
    `; challenges++;
    document.getElementById("challenge-count").innerHTML = challenges + " available";
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
        
        // Init rooms in UI
        data.params.rooms.forEach((room) => {
            addRoom(room.id, room.name, room.tableCount, room.clientCount, "")
        });
    }
    
    // Update tables
    if (data.command == "TABLE_IN_ROOM_CHANGED") {
        let id = data.params.id;
        let name = data.params.name;
        let bet = data.params.betAmountId;
        let slots = data.params.slots;
        let playing = data.params.playing;
        let invite = data.params.private;
        addChallenge(id, name, bet, slots, playing, invite)
    }
});

/******************************\
 ==============================
 
           UI control

 ==============================
\******************************/

let selectedRoom = "Classic";
const roomList = document.getElementById("room-list");
const createForm = document.getElementById("create-form");
const toggleCreate = document.getElementById("toggle-create");
const challengeList = document.getElementById("challenge-list");

// ROOM SELECTION
roomList.addEventListener("click", event => {
    const room = event.target.closest(".room");
    if (!room) return;
    document.querySelectorAll(".room").forEach(item => {
        item.classList.remove("selected");
        item.querySelector(".room-status").textContent = "";
    }); room.classList.add("selected");
    room.querySelector(".room-status").textContent = "Selected";
    selectedRoom = room.dataset.room;
    document.getElementById("selected-room").textContent = selectedRoom;
    console.log("room", room.id);
    
    // Enter room
    msg = createCommand("lobby"); window.fbchess.sendGUICommand(msg);
    msg = createCommand("room", {"roomId": room.id}); window.fbchess.sendGUICommand(msg);
    document.getElementById("challenge-list").innerHTML = "";
});

// CREATE FORM
toggleCreate.addEventListener("click", () => {
    createForm.classList.toggle("open");
    toggleCreate.textContent = createForm.classList.contains("open")
        ? "− Close form"
        : "+ Create new table";
});

document.getElementById("cancel-create").addEventListener("click", () => {
    createForm.classList.remove("open");
    toggleCreate.textContent = "+ Create new table";
});

// CREATE TABLE
document.getElementById("create-submit").addEventListener("click", () => {
    const params = {
        minutes: Number(document.getElementById("minutes").value),
        seconds: Number(document.getElementById("seconds").value),
        progressive: Number(document.getElementById("progressive").value),
        bet: Number(document.getElementById("bet").value)
    };

    if (
        !Number.isFinite(params.minutes) ||
        !Number.isFinite(params.seconds) ||
        !Number.isFinite(params.progressive) ||
        !Number.isFinite(params.bet) ||
        params.minutes < 1 ||
        params.seconds < 0 ||
        params.progressive < 0 ||
        params.bet < 0
    ) {
        alert("Please enter valid table parameters.");
        return;
    }

    console.log("CREATE TABLE:", params);

    let msg = createCommand("game", {
        "betAmountId": params.bet.toString(),
        "tableArgs": {
            "matchDuration": params.minutes.toString(),
            "turnDuration": params.seconds.toString(),
            "accDuration": params.progressive.toString()
        },
        "tableName": ""
    }); window.fbchess.sendGUICommand(msg);

    createForm.classList.remove("open");
    toggleCreate.textContent = "+ Create new table";
});

// ACCEPT CHALLENGE
challengeList.addEventListener("click", event => {
    const button = event.target.closest(".accept-challenge");
    if (!button) return;
    const challenge = button.closest(".challenge");
    const params = {

        id: challenge.querySelector(".id").textContent,
        players: challenge.querySelector(".players").textContent,
        playing: challenge.querySelector(".playing").textContent,
        invite: challenge.querySelector(".invite").textContent,
        bet: challenge.querySelector(".bet").textContent
    };

    console.log("ACCEPT CHALLENGE:", params);

    // TODO: Send acceptance request to Electron / game server.

    alert("Accept challenge:\n" + JSON.stringify(params, null, 2));
});