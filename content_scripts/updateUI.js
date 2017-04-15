var audioUrl = 'https://vk.com/al_audio.php';
var bulkSize = 5;

function insertAfter(referenceNode, newNode) {
    referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
}

function getAudioIds() {
    var ids = [];
    var records = document.getElementsByClassName('audio_row');
    for (var i = 0; i < records.length; i++) {
        ids.push(records[i].id.replace('audio_',''));
    }
    return ids;
}

function getRecords(ids) {
    var records = [];
    while (ids.length > 0) {
        var bulk = [];
        while (bulk.length < bulkSize && ids.length > 0) bulk.push(ids.pop());

        // TODO: Async
        var http = new XMLHttpRequest();
        var params = 'act=reload_audio&al=1&ids=' + bulk.join(',');
        http.open('POST', audioUrl, false);
        http.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
        http.send(params);
        if (http.status == 200) {
            var serverRecords = parseResponse(http.responseText);
            for (var i = 0; i < serverRecords.length; i++) {
                var serverRecord = serverRecords[i];
                records.push({
                    filename: serverRecord[4] + ' - ' + serverRecord[3],
                    url: e(serverRecord[2])
                });
            }
        }
    }
    return records;
}

function parseResponse(response) {
    var startIndex = response.indexOf('<!json>') + 7;
    if (startIndex == 6) {
        return undefined;
    }
    var endIndex = response.indexOf(']<!>',startIndex) + 1;
    if (endIndex == 0) {
        return JSON.parse(response.substr(startIndex));
    } else {
        return JSON.parse(response.substr(startIndex, endIndex - startIndex));
    }
}

function addDownloadPlaylistButton() {
    var a = document.createElement('a');
    var downloadText = document.createTextNode('Download playlist');
    a.setAttribute('id', 'download-music');
    a.setAttribute('class', 'flat_button');
    a.setAttribute('style', 'width: 100%');
    a.appendChild(downloadText);

    var parent = document.getElementById('ui_audio_load_more');
    insertAfter(parent, a);

    a.onclick = function () {
        createPlaylist();
    };
}

function createPlaylist() {
    var records = getRecords(getAudioIds());
    var playlist = "#EXTM3U";
    for (var i = 0; i < records.length; i++) {
        playlist += "\n\n#EXTINF:-1," + records[i].filename;
        playlist += "\n" + records[i].url;
    }
    var blob = new Blob([playlist], {type : 'text/plain; charset=utf-8'});
    var url = URL.createObjectURL(blob);

    var a = document.getElementById('download-music');
    a.setAttribute('href', url);
    a.setAttribute('download', 'playlist.m3u');
}

function errorHandler(error) {
    console.log('Error:', error);
}

addDownloadPlaylistButton();
