navigator.userAgentData.getHighEntropyValues(["architecture",
                                              "bitness",
	                                      "platform",
	                                      "platformVersion",
	                                      "fullVersionList",]).then(process_local_version);

function process_local_version(ua) {
    document.getElementById('your_chrome_version').innerText = ua.fullVersionList[1].version;
    ua_platform = ua.platform.toLowerCase().replace(/\s/g, '');
    ua_arch = ua.architecture.toLowerCase();
    ua_bits = ua.bitness
    switch (ua_platform) {
        case "linux":
            chrome_platform = "linux";
	    break;
        case "android":
	    chrome_platform = "android";
	    break;
	case "ios":
	    chrome_platform = "ios";
	    break;
	case "chromeos":
	    chrome_platform = "chromeos";
	    break;
	case "windows":
	    if (ua_arch == "x86" && ua_bits == 64) {
	        chrome_platform = "win64";
	    } else if (ua_arch == "x86" && ua_bits == 32) {
	        chrome_platform = "win";
	    } else if (ua_arch.startsWith('arm')) {
		chrome_platform = "win_arm64";
	    }
	    break;
	case "macos":
	    if (ua_arch == "x86") {
	        chrome_platform = "mac";
	    } else if (ua_arch.startsWith('arm')) {
		chrome_platform = "mac_arm64";
            }
    }
    document.getElementById('your_chrome_platform').innerText = chrome_platform; 
    key = "AIzaSyDkSjprpkIA7CmE-yM3RBDbIGA4jnxAurc";
    channel = "stable";
    vh_url = `https://versionhistory.googleapis.com/v1/chrome/platforms/${chrome_platform}/channels/${channel}/versions/all/releases?key=${key}&pageSize=1&orderBy=version desc&filter=endtime=none&fields=releases/version`
    process_remote_version(vh_url);
}

async function process_remote_version(url) {
   try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Response status: ${response.status}`);
    }

    const json = await response.json();
    document.getElementById('remote_chrome_version').innerText = json.releases[0].version
   } catch (error) {
    console.error(error.message);
  }
} 

