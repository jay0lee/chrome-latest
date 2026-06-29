(async function init() {
    if (!navigator.userAgentData) {
        document.getElementById("status").innerText = "Your browser does not support the required API. Please visit using a modern Chromium-based browser.";
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

    document.getElementById("version-container").style.display = "flex";
    document.getElementById("your_chrome_version").innerText = uaVersion;
    document.getElementById("detected_os").innerText = ua.platform;

    const key = "AIzaSyDkSjprpkIA7CmE-yM3RBDbIGA4jnxAurc";
    let pathSegment = window.location.pathname.split('/')[1]?.toLowerCase();
    
    // Default to stable if the URL path doesn't match a valid channel
    let channel = validChannels.includes(pathSegment) ? pathSegment : "stable";

    // Build Channel Links (using CSS flexbox for layout instead of text strings)
    const channelHtml = validChannels.map(ch => {
        return ch === channel 
            ? `<span class="active">${ch}</span>` 
            : `<a href="/${ch}">${ch}</a>`;
    }).join("");
    document.getElementById("channels").innerHTML = channelHtml;

    const vhUrl = `https://versionhistory.googleapis.com/v1/chrome/platforms/${chromePlatform}/channels/${channel}/versions/all/releases?key=${key}&order_by=platform%20desc,channel%20asc,starttime%20desc&filter=endtime=none`;
    
    await processRemoteVersion(vhUrl, uaVersion, channel);
}

async function processRemoteVersion(url, localVersion, channel) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        
        const json = await response.json();
        const releases = json.releases || [];

        if (releases.length === 0) {
            throw new Error("No release data found for this channel/platform combination.");
        }

        releases.sort((a, b) => versionCompare(b.version, a.version, { zeroExtend: true }));

        const latestRelease = releases.find(r => r.fraction === undefined || r.fraction >= 0.01);
        const remoteVersion = latestRelease ? latestRelease.version : releases[0].version;

        const highlighted = highlightDifferences(localVersion, remoteVersion);
        document.getElementById('your_chrome_version').innerHTML = highlighted.local;
        document.getElementById('remote_chrome_version').innerHTML = highlighted.remote;

        const compResult = versionCompare(localVersion, remoteVersion, { zeroExtend: true });
        const statusEl = document.getElementById("status");

        if (compResult === 1) {
            const isPreview = releases.some(r => r.version === localVersion && r.fraction !== undefined && r.fraction < 0.01);
            if (isPreview) {
                document.body.className = "status-latest";
                statusEl.innerText = "You are running the latest stable preview.";
            } else {
                document.body.className = "status-newer";
                statusEl.innerText = "Your version is newer than the latest version. Are you sure you chose the right channel?";
            }
        } else if (compResult === 0) {
            document.body.className = "status-latest";
            const absoluteLatest = releases[0].version;
            const previewResult = versionCompare(absoluteLatest, remoteVersion, { zeroExtend: true });
            if (previewResult === 1) {
                statusEl.innerText = `You are running the latest version. Early ${channel || "stable"} ${absoluteLatest} has begun but may not be available for you yet.`;
            } else {
                statusEl.innerText = "You are running the latest version.";
            }
        } else {
            document.body.className = "status-old";
            statusEl.innerText = "You are running an old version of Chrome. Time to upgrade.";
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

function highlightDifferences(local, remote) {
    if (local === remote) return { local, remote };
    
    let localParts = local.split('.');
    let remoteParts = remote.split('.');
    let localHtml = [];
    let remoteHtml = [];
    let diffFound = false;

    for (let i = 0; i < Math.max(localParts.length, remoteParts.length); i++) {
        const lp = localParts[i] || "0";
        const rp = remoteParts[i] || "0";
        
        if (lp !== rp) diffFound = true;
        
        if (diffFound) {
            localHtml.push(`<span class="diff-highlight">${lp}</span>`);
            remoteHtml.push(`<span class="diff-highlight">${rp}</span>`);
        } else {
            localHtml.push(lp);
            remoteHtml.push(rp);
        }
    }
    
    return {
        local: localHtml.join('.'),
        remote: remoteHtml.join('.')
    };
}
