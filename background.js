var requests = [];

function saveRequest(request) {
    var act = request.requestBody.formData["act"];
    if (act && act[0] == 'reload_audio') return;
    requests[request.tabId] = request;
}

chrome.webRequest.onBeforeRequest.addListener(
    saveRequest,
    {urls: ["https://vk.com/al_audio.php"]},
    ['requestBody']
);

chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        var tabId = sender.tab.id;
        console.log('Tab #' + tabId + ' requested current album');
        sendResponse({status: "ok", last: requests[tabId]});
    });