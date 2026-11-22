
document.getElementById("personal").addEventListener("click", () => {
    window.fbchess.sendGUICommand({
        command: "select_facebook_account",
        params: { account: "personal" }
    });
});

document.getElementById("test").addEventListener("click", () => {
    window.fbchess.sendGUICommand({
        command: "select_facebook_account",
        params: { account: "test" }
    });
});
