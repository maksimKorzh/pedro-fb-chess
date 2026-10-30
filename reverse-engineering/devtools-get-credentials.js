/*

 1. Navigate to https://www.facebook.com/gaming/play/194060244713436/
 2. select game-bundle(index.html) in devtools -> console
 3. paste and execute below code to get fresh credentials
 
*/

(async () => {
    if (!window.FBInstant) {
        throw new Error("FBInstant is unavailable");
    }

    const signedInfo =
        await FBInstant.player.getSignedPlayerInfoAsync("hello");

    const credentials = {
        id: signedInfo.getPlayerID(),
        signature: signedInfo.getSignature(),
        locale: FBInstant.getLocale(),
        timestamp: Date.now()
    };

    console.log("Fresh FBInstant credentials:", credentials);

    // Send credentials to your local Electron application.
    await fetch("http://127.0.0.1:3210/credentials", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(credentials)
    });

    console.log("Credentials delivered to Electron");
})();