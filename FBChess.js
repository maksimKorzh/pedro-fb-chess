const { app, BrowserWindow, ipcMain, Menu } = require('electron');

const WebSocket = require('ws');

var socket = null;

function createWindow() {
    const win = new BrowserWindow({
        fullscreen: false,
        width: 1024,
        minWidth:1024,
        height: 518,
        webPreferences: { preload: __dirname + '/preload.js' }
    }); const template = [
        {
            label: 'View',
            submenu: [
                { label: 'Reload', role: 'reload' },
                { label: 'Toggle Developer Tools', role: 'toggleDevTools' },
                { label: 'Fullscreen', role: 'togglefullscreen' },
                { label: 'Exit', role: 'quit' },
            ]
        }
    ]; const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
    win.loadFile('ui.html');
    win.on('close', () => { if (socket) socket.close(); });
}

app.whenReady().then(createWindow);
app.on('quit', () => { if (socket) socket.close(); });

ipcMain.on('command', (event, command) => {
    console.log(`FROM UI: ${command}`);
    if (command == "connect") {
        socket = new WebSocket('wss://chess.game8.io/ws/gameServer', { headers: { 'Origin': 'null' } });
        socket.on('open', function () {
            // Login
            const credentials = [
                "0268113239343638393232363232373030313238000000bc54682d5a676c514d614c7961543730544e6b715a5875546f67614f4b666d737a31463069703333584b30452e65794a6862476476636d6c30614730694f694a49545546444c564e49515449314e694973496d6c7a6333566c5a463968644349364d5463354d6a6b7a4f5441304e437769634778686557567958326c6b496a6f694d6a6b304e6a67354d6a49324d6a49334d4441784d6a67694c434a795a5846315a584e305833426865577876595751694f694a6f5a57787362794a3900000005656e5f47420a464249475f434845535305352e302e31196c617374506f7075703d3d313739323933383331373838350a0563686573730100000000000000000001",
                "0191054c6f626279000000056368657373",
                "015b4000",
                "015a00",
                "01ae056368657373",
                "02eb0b4c6f6262792e6368657373"
            ]; for (let msg of credentials) socket.send(Buffer.from(msg, 'hex'));
            event.sender.send("data", "Connected to web socket\n");
            setInterval(function() { socket.send(Buffer.from("012d", "hex")); }, 10000);
        });
        socket.on('message', function (data) { event.sender.send("data", Buffer.from(data).toString('hex').match(/.{2}/g).join(' ') + "\n"); });
        socket.on('error', function (error) { event.sender.send("data", "WebSocket error\n"); });
        socket.on('close', function () { event.sender.send("data", "WebSocket connection closed.\n"); }); return socket;
    } else if (command == "disconnect") {
        if (socket) socket.close();
    } if (command == "lobby") {
        socket.send(Buffer.from("019800ff056368657373", 'hex'));
    } else if (command == "test") { console.log("TEST COMMAND")
        let test = [
            "01910b4c6f6262792e6368657373000000056368657373",
            "01920133000000",
            "02eb0b4c6f6262792e6368657373",

            "015b00",
            "01ae056368657373",
            "019b01",
            
            // match
            "019502030d6d617463684475726174696f6e0002003100350c7475726e4475726174696f6e0002003900300b6163634475726174696f6e0001003000",
            
        ]; for (msg of test) socket.send(Buffer.from(msg, 'hex'));
    } else if (command == "start") {
        socket.send(Buffer.from("012b", 'hex'));
    } else {
        // This is used for moves, on bad command socket will disconnect
        console.log(`RAW BYTES ->${Buffer.from(command, 'hex')}<-`)
        socket.send(Buffer.from(command, 'hex'));
    }

});







