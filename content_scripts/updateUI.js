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

function getRecords(ids, callback) {
    var records = [];
    var expectedLength = ids.length;
    var count = Math.ceil(ids.length / bulkSize);

    while (ids.length > 0) {
        var bulk = [];
        while (bulk.length < bulkSize && ids.length > 0) bulk.push(ids.pop());

        var http = new XMLHttpRequest();
        var params = 'act=reload_audio&al=1&ids=' + bulk.join(',');
        http.open('POST', audioUrl, true);
        http.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
        http.onload = function () {
            if (this.readyState === 4) {
                count--;
                if (this.status == 200) {
                    var serverRecords = parseResponse(this.responseText);
                    // TODO: Handle retry if !serverRecords
                    for (var i = 0; i < serverRecords.length; i++) {
                        var serverRecord = serverRecords[i];
                        records.push({
                            filename: serverRecord[4] + ' - ' + serverRecord[3],
                            url: e(serverRecord[2])
                        });
                    }

                    if (records.length == expectedLength || count == 0) {
                        console.log('Loaded', records.length, 'records');
                        callback(records);
                    }
                }
            }
        };
        http.onerror = function () {
            count--;
            console.error(this.statusText);
        };
        http.send(params);

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
    a.setAttribute('id', 'download_music');
    a.setAttribute('class', 'flat_button');
    a.setAttribute('style', 'width: 100%');
    a.appendChild(downloadText);

    var parent = document.getElementById('ui_audio_load_more');
    insertAfter(parent, a);

    a.onclick = function () {
        getRecords(getAudioIds(), createPlaylist);
    };
}

function createPlaylist(records) {
    var playlist = "#EXTM3U";
    for (var i = 0; i < records.length; i++) {
        playlist += "\n\n#EXTINF:-1," + records[i].filename;
        playlist += "\n" + records[i].url;
    }
    var blob = new Blob([playlist], {type : 'text/plain'});
    var url = URL.createObjectURL(blob);
    var filename = 'playlist.m3u';

    var a = document.createElement('a');
    document.body.appendChild(a);
    a.setAttribute('href', url);
    a.setAttribute('style', 'display: none');
    a.setAttribute('download', filename);

    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function errorHandler(error) {
    console.log('Error:', error);
}

addDownloadPlaylistButton();
