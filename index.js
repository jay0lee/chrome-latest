var ua_version;
var ua_arch;
var ua_bits;
var chrome_platform;

navigator.userAgentData.getHighEntropyValues(["architecture",
                                              "bitness",
	                                      "platform",
	                                      "platformVersion",
	                                      "fullVersionList",]).then(process_local_version);

function process_local_version(ua) {
    for (let i = 0; i < ua.fullVersionList.length; i++) {
        if ( ua.fullVersionList[i].brand == "Google Chrome" ) {
	    ua_version = ua.fullVersionList[i].version;
	}
    }
    document.getElementById('your_chrome_version').innerText += ua_version;
    ua_platform = ua.platform.toLowerCase().replace(/\s/g, '');
    ua_arch = ua.architecture.toLowerCase();
    ua_bits = ua.bitness
    console.log(`Chrome Version: ${ua_version} Platform: ${ua_platform} Arch: ${ua_arch} Bits: ${ua_bits}`);
    // channels that are valid for all platforms
    var valid_channels = ["stable", "beta", "dev"];
    switch (ua_platform) {
        case "linux":
            chrome_platform = "linux";
	    break;
        case "android":
	    chrome_platform = "android";
	    valid_channels.push("canary");
	    break;
	case "ios":
	    chrome_platform = "ios";
	    valid_channels.push("canary");
	    break;
	case "chromeos":
	    chrome_platform = "chromeos";
	    valid_channels.unshift("ltc");
	    valid_channels.unshift("lts");
	    valid_channels.push("canary");
	    break;
	case "windows":
	    if (ua_arch == "x86" && ua_bits == 64) {
	        chrome_platform = "win64";
	    } else if (ua_arch == "x86" && ua_bits == 32) {
	        chrome_platform = "win";
	    } else if (ua_arch.startsWith('arm')) {
		chrome_platform = "win_arm64";
	    }
            valid_channels.unshift("extended");
	    valid_channels.push("canary");
	    break;
	case "macos":
	    if (ua_arch == "x86") {
	        chrome_platform = "mac";
	    } else if (ua_arch.startsWith('arm')) {
		chrome_platform = "mac_arm64";
            }
	    valid_channels.unshift("extended");
	    valid_channels.push("canary");
	    break;
    }
    console.log(`Derived Chrome Platform: ${chrome_platform}`)
    var key = "AIzaSyDkSjprpkIA7CmE-yM3RBDbIGA4jnxAurc";
    var channel = window.location.pathname.split('/')[1].toLowerCase();
    if ( ! valid_channels.includes(channel) ) {
        console.log(`Channel ${channel} not valid for platform ${chrome_platform}. Defaulting to stable.`);
        channel = "stable";
    } else {
	console.log(`derived channel to be ${channel} from URL path.`);
    }
    var vh_url = `https://versionhistory.googleapis.com/v1/chrome/platforms/${chrome_platform}/channels/${channel}/versions/all/releases?key=${key}&pageSize=1&orderBy=version desc&filter=endtime=none&fields=releases/version`
    process_remote_version(vh_url);
    var footer = '';
    for (let i = 0; i < valid_channels.length; i++) {
        if ( channel == valid_channels[i] ) {
	    footer += ` ${channel} `;
	} else {
	    footer += ` <a href="/${valid_channels[i]}">${valid_channels[i]}</a> `;
	}
    }
    document.getElementById('footer').innerText = footer;
}

async function process_remote_version(url) {
    console.log(`Fetching URL ${url}...`)
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }

        const json = await response.json();
	console.log("Response:");
	console.log(json);
        var remote_version = json.releases[0].version;
        document.getElementById('remote_chrome_version').innerText += remote_version;
    } catch (error) {
        console.error(error.message);
    }
    options = {"zeroExtend": true}
    var comp_result = versionCompare(ua_version, remote_version, options);
    switch (comp_result) {
  	case 1:
 	    document.body.style.backgroundColor  = "yellow";
	    break;
	case 0:
	    document.body.style.backgroundColor = "green";
	    break;
	case -1:
	    document.body.style.backgroundColor = "orange";
	    break;
    }
}

function versionCompare(v1, v2, options) {
    var lexicographical = options && options.lexicographical,
        zeroExtend = options && options.zeroExtend,
        v1parts = v1.split('.'),
        v2parts = v2.split('.');

    function isValidPart(x) {
        return (lexicographical ? /^\d+[A-Za-z]*$/ : /^\d+$/).test(x);
    }

    if (!v1parts.every(isValidPart) || !v2parts.every(isValidPart)) {
        return NaN;
    }

    if (zeroExtend) {
        while (v1parts.length < v2parts.length) v1parts.push("0");
        while (v2parts.length < v1parts.length) v2parts.push("0");
    }

    if (!lexicographical) {
        v1parts = v1parts.map(Number);
        v2parts = v2parts.map(Number);
    }

    for (var i = 0; i < v1parts.length; ++i) {
        if (v2parts.length == i) {
            return 1;
        }

        if (v1parts[i] == v2parts[i]) {
            continue;
        }
        else if (v1parts[i] > v2parts[i]) {
            return 1;
        }
        else {
            return -1;
        }
    }

    if (v1parts.length != v2parts.length) {
        return -1;
    }

    return 0;
}
