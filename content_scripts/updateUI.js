var audioUrl = 'https://vk.com/al_audio.php';
var bulkSize = 5;

function insertAfter(referenceNode, newNode) {
    referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
}

function getIdMap() {
    var map = {};
    var records = document.getElementsByClassName('audio_row');
    for (var i = 0; i < records.length; i++) {
        map[records[i].id.replace('audio_','')] = JSON.parse(records[i].getAttribute('data-audio'));
    }
    return map;
}

function getRecords(idsMap, ids, callback) {
    var records = [];
    var failedIds = [];
    var expectedLength = ids.length;
    var count = Math.ceil(ids.length / bulkSize);

    while (ids.length > 0) {
        var bulk = [];
        while (bulk.length < bulkSize && ids.length > 0) bulk.push(ids.pop());

        requestUrls(bulk, function (newRecords, err) {
            count--;
            if (!err) {
                records = records.concat(newRecords);
            } else {
                if (Array.isArray(err)) {
                    for (var j = 0; j < err.length; j++) {
                        failedIds.push(err[j]);
                        console.warn('Cannot get link to:', idsMap[err[j]]);
                    }
                } else {
                    console.error(err);
                }
            }

            if (records.length == expectedLength || count == 0) {
                console.log('Loaded', records.length + '/' + expectedLength, 'records');
                callback(records, failedIds);
            }
        });
    }
}

function requestUrls(ids, callback) {
    var http = new XMLHttpRequest();
    var params = 'act=reload_audio&al=1&ids=' + ids.join(',');
    http.open('POST', audioUrl, true);
    http.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    http.onload = function () {
        if (this.readyState === 4) {
            if (this.status == 200) {
                var serverRecords = parseResponse(this.responseText);
                if (!!serverRecords) {
                    var records = [];
                    if (serverRecords.length != ids.length) {
                        console.warn('Returned only', serverRecords.length, 'instead of', ids.length);
                    }
                    for (var i = 0; i < serverRecords.length; i++) {
                        var serverRecord = serverRecords[i];
                        records.push({
                            filename: serverRecord[4] + ' - ' + serverRecord[3],
                            url: e(serverRecord[2])
                        });
                    }
                    callback(records);
                } else {
                    callback([], ids);
                }
            }
        }
    };
    http.onerror = function () {
        callback([], this.statusText);
    };
    http.send(params);
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
        var map = getIdMap();
        getRecords(map, Object.keys(map), function (ok, failed) {
            createPlaylist(ok);
        });
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
