const { app, BrowserWindow, ipcMain, Menu } = require("electron");
const { spawn } = require('child_process');
const WebSocket = require("ws");
var socket = null;
var engine = null;

function createWindow() {
    const win = new BrowserWindow({
        fullscreen: false,
        width: 1024,
        minWidth:1024,
        height: 518,
        webPreferences: { preload: __dirname + "/preload.js" }
    }); const template = [
        {
            label: "View",
            submenu: [
                { label: "Reload", role: "reload" },
                { label: "Toggle Developer Tools", role: "toggleDevTools" },
                { label: "Fullscreen", role: "togglefullscreen" },
                { label: "Exit", role: "quit" },
            ]
        }
    ]; const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
    win.loadFile("ui.html");
    win.maximize();
    win.on("close", () => { if (socket) socket.close(); });
}

app.whenReady().then(createWindow);
app.on("quit", () => { if (socket) socket.close(); });

ipcMain.on("command", (event, command) => {
    if (command == "connect") {
        
        /*******************************\
         ===============================
                    
                      Engine
                    
         ===============================
        \*******************************/
        
        engine = spawn( "./stockfish", { detached: true, stdio: ["pipe", "pipe", "pipe"] });
        engine.stdout.on("data", (data) => {
            let response = data.toString();
            if (response.includes("bestmove")) {
                let move = response.split("bestmove ")[1].split(" ")[0];
                event.sender.send("data", "uci:" + move + "\n");
            }
            console.log("ENGINGE:", response);
        }); engine.on("exit", (code, signal) => { console.error("engine: exited"); });
        engine.on("error", (err) => { console.error("engine:", err); });
        engine.stderr.on("data", (data) => { console.log("engine:", data.toString()); });
        
        
        /*******************************\
         ===============================
                    
                    Web Socket
                    
         ===============================
        \*******************************/
        
        socket = new WebSocket("wss://chess.game8.io/ws/gameServer", { headers: { "Origin": "null" } });
        socket.on("open", function () {
            const credentials = [
                // Login
                "0268113239343638393232363232373030313238000000bc486173685256385f4f6d576a4631594746796c6a58495277784f73416658385a5774464a7272767a4d6d772e65794a6862476476636d6c30614730694f694a49545546444c564e49515449314e694973496d6c7a6333566c5a463968644349364d5463354d7a45784d6a45354f437769634778686557567958326c6b496a6f694d6a6b304e6a67354d6a49324d6a49334d4441784d6a67694c434a795a5846315a584e305833426865577876595751694f694a6f5a57787362794a3900000005656e5f47420a464249475f434845535305352e302e31196c617374506f7075703d3d313739333130393036363637350a0563686573730100000000000000000001",
                
                // Enter place
                "0191054c6f626279000000056368657373",
                
                // Video reward
                "015b4000",
                
                // Daily reward
                "015a00",
                
                // Get current path
                "01ae056368657373",
                
                // Chat
                "02eb0b4c6f6262792e6368657373"
            ]; for (let msg of credentials) socket.send(Buffer.from(msg, "hex"));
            event.sender.send("data", "Connected to WebSocket\n");
            setInterval(function() { socket.send(Buffer.from("012d", "hex")); }, 10000);
        });
        socket.on("message", function (data) { event.sender.send("data", Buffer.from(data).toString("hex") + "\n"); });
        socket.on("error", function (error) { event.sender.send("data", "WebSocket error\n"); });
        socket.on("close", function () { event.sender.send("data", "WebSocket connection closed.\n"); }); return socket;
    } else if (command == "disconnect") {
        if (socket) socket.close();
        if (engine) engine.kill();
    } else if (command.includes("uci:")) {
        command = command.split("uci:")[1];
        engine.stdin.write(command + "\n");
    } else socket.send(Buffer.from(command, "hex"));
});



