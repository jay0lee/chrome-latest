// Wrap in an IIFE to avoid polluting the global namespace
(async function init() {
    if (!navigator.userAgentData) {
        document.getElementById("status").innerText = "Your browser does not support the required User-Agent Client Hints API. Please visit using a Chromium-based browser.";
        return;
    }

    try {
        const ua = await navigator.userAgentData.getHighEntropyValues([
            "architecture", "bitness", "platform", "platformVersion", "fullVersionList"
        ]);
        await processLocalVersion(ua);
    } catch (error) {
        document.getElementById("status").innerText = `Error reading local version: ${error.message}`;
        console.error(error);
    }
})();

async function processLocalVersion(ua) {
    // Look for Google Chrome, or fallback to the first major brand if Chrome isn't found (e.g., Edge/Brave)
    const browserInfo = ua.fullVersionList.find(b => b.brand === "Google Chrome") || ua.fullVersionList[0];
    const uaVersion = browserInfo ? browserInfo.version : "Unknown";
    
    const uaPlatform = ua.platform.toLowerCase().replace(/\s/g, '');
    const uaArch = ua.architecture.toLowerCase();
    const uaBits = ua.bitness;
    
    console.log(`Version: ${uaVersion} | Platform: ${uaPlatform} | Arch: ${uaArch} | Bits: ${uaBits}`);

    let chromePlatform = uaPlatform;
    const validChannels = ["stable", "beta", "dev"];

    switch (uaPlatform) {
        case "linux":
            break;
        case "android":
        case "ios":
            validChannels.push("canary");
            break;
        case "chromeos":
            validChannels.unshift("lts", "ltc");
            validChannels.push("canary");
            break;
        case "windows":
            if (uaArch === "x86" && uaBits === "64") chromePlatform = "win64";
            else if (uaArch === "x86" && uaBits === "32") chromePlatform = "win";
            else if (uaArch.startsWith('arm')) chromePlatform = "win_arm64";
            validChannels.unshift("extended");
            validChannels.push("canary");
            break;
        case "macos":
            if (uaArch === "x86") chromePlatform = "mac";
            else if (uaArch.startsWith('arm')) chromePlatform = "mac_arm64";
            validChannels.unshift("extended");
            validChannels.push("canary");
            break;
    }

    // Determine channel from URL or default to stable
    const pathSegment = window.location.pathname.split('/')[1]?.toLowerCase();
    const channel = validChannels.includes(pathSegment) ? pathSegment : "stable";

    // Update DOM for user version and OS
    document.getElementById("version-container").style.display = "flex";
    document.getElementById('your_chrome_version').innerText = uaVersion;
    document.getElementById('detected_os').innerText = ua.platform;

    // Build Channel Links
    const channelHtml = validChannels.map(ch => {
        return ch === channel 
            ? `<span class="active">${ch}</span>` 
            : `<a href="/${ch}">${ch}</a>`;
    }).join(" | ");
    document.getElementById("channels").innerHTML = channelHtml;

    // Fetch remote version
    const key = "AIzaSyDkSjprpkIA7CmE-yM3RBDbIGA4jnxAurc";
    const vhUrl = `https://versionhistory.googleapis.com/v1/chrome/platforms/${chromePlatform}/channels/${channel}/versions/all/releases?key=${key}&pageSize=1&orderBy=version desc&filter=endtime=none&fields=releases/version`;
    
    await processRemoteVersion(vhUrl, uaVersion);
}

async function processRemoteVersion(url, localVersion) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        
        const json = await response.json();
        const remoteVersion = json.releases?.[0]?.version;

        if (!remoteVersion) {
            throw new Error("No release data found for this channel/platform combination.");
        }

        document.getElementById('remote_chrome_version').innerText = remoteVersion;

        const compResult = versionCompare(localVersion, remoteVersion, { zeroExtend: true });
        const statusEl = document.getElementById("status");

        if (compResult === 1) {
            document.body.className = "status-newer";
            statusEl.innerText = "Your version is newer than the latest version. Are you sure you chose the right channel?";
            statusEl.style.color = "#b06000";
            statusEl.style.backgroundColor = "#fef7e0";
        } else if (compResult === 0) {
            document.body.className = "status-latest";
            statusEl.innerText = "You are running the latest version.";
            statusEl.style.color = "#0d652d";
            statusEl.style.backgroundColor = "#e6f4ea";
        } else {
            document.body.className = "status-old";
            statusEl.innerText = "You are running an old version of Chrome. Time to upgrade.";
            statusEl.style.color = "#c5221f";
            statusEl.style.backgroundColor = "#fce8e6";
        }
    } catch (error) {
        document.getElementById("status").innerText = `Error: ${error.message}`;
        console.error(error);
    }
}

function versionCompare(v1, v2, options) {
    let lexicographical = options?.lexicographical;
    let zeroExtend = options?.zeroExtend;
    let v1parts = v1.split('.');
    let v2parts = v2.split('.');

    function isValidPart(x) {
        return (lexicographical ? /^\d+[A-Za-z]*$/ : /^\d+$/).test(x);
    }

    if (!v1parts.every(isValidPart) || !v2parts.every(isValidPart)) return NaN;

    if (zeroExtend) {
        while (v1parts.length < v2parts.length) v1parts.push("0");
        while (v2parts.length < v1parts.length) v2parts.push("0");
    }

    if (!lexicographical) {
        v1parts = v1parts.map(Number);
        v2parts = v2parts.map(Number);
    }

    for (let i = 0; i < v1parts.length; ++i) {
        if (v2parts.length === i) return 1;
        if (v1parts[i] === v2parts[i]) continue;
        return v1parts[i] > v2parts[i] ? 1 : -1;
    }

    return v1parts.length !== v2parts.length ? -1 : 0;
}
