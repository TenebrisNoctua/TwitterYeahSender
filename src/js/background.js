const IS_MANIFEST_V3 = chrome.runtime.getManifest().manifest_version === 3

const getRequiredPermissions = () => {
	const manifest = chrome.runtime.getManifest()

	return {
		origins: [
			...(IS_MANIFEST_V3 ? manifest.host_permissions : manifest.permissions.filter(x => x.includes("://"))),
			...manifest.content_scripts[0].matches
		]
	}
}

const browserAction = IS_MANIFEST_V3 ? chrome.action : chrome.browserAction

browserAction.onClicked.addListener(tab => {
	chrome.permissions.request(getRequiredPermissions(), () => { })
	if (chrome.runtime.lastError) { }

	chrome.tabs.create({ url: `index.html` })
})

// Service worker wont run on browser startup unless these have listeners

chrome.runtime.onStartup.addListener(() => { })
chrome.runtime.onInstalled.addListener(() => { })

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
	if (request == "getConfig") sendResponse(config);
	if (request == "getImageURL") {
		sendResponse(chrome.runtime.getURL('../img/yeah.jpg'))
	}
});


