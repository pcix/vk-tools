var baseUrl = 'https://vk.com';
var audioUrl = baseUrl + '/al_audio.php';
var bulkSize = 5;
var pause = 60000;
var replacements = {
    "&amp;": "&",
    "&quot;": '"',
    "&lt;": "<",
    "&gt;": ">"
};

function insertBefore(referenceNode, newNode) {
    referenceNode.parentNode.insertBefore(newNode, referenceNode);
}

function insertAfter(referenceNode, newNode) {
    referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
}

function fixFilename(str) {
    str = str.replace(/[\\\/\|\*\:\"\<\>\?]/gmi, " ").trim();
    str = str.replace(/(&amp;|&quot;|&lt;|&gt;)/g, function (m) {
        return replacements[m];
    });
    str = str.replace(/&#([0-9]{1,3});/gi, function (match, numStr) {
        var num = parseInt(numStr, 10);
        return String.fromCharCode(num);
    });
    return str;
}

function parseResponse(response) {
    var startIndex = response.indexOf('<!json>') + 7;
    if (startIndex == 6) {
        return undefined;
    }
    var endIndex = response.indexOf('<!>', startIndex);
    if (endIndex == 0) {
        return JSON.parse(response.substr(startIndex));
    } else {
        return JSON.parse(response.substr(startIndex, endIndex - startIndex));
    }
}

function splitIds(ids, size) {
    var chunks = [];
    for (var i = 0; i < ids.length; i += size) {
        chunks.push(ids.slice(i, i + size));
    }
    return chunks;
}

function loadChunk(ids, callback, retry) {
    var http = new XMLHttpRequest();
    var params = 'act=reload_audio&al=1&ids=' + ids.join(',');
    http.open('POST', audioUrl, true);
    http.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    http.onload = function () {
        if (this.readyState === 4 && this.status == 200) {
            var records = [];
            var serverRecords = parseResponse(this.responseText);
            if (!!serverRecords) {
                for (var i = 0; i < serverRecords.length; i++) {
                    var serverRecord = serverRecords[i];
                    records.push({
                        filename: serverRecord[4] + ' - ' + serverRecord[3],
                        url: e(serverRecord[2])
                    });
                }
                callback(records);
            } else {
                if (!retry) retry = 1;
                console.log('[' + retry + '] Failed to download chunk:', ids);
                setTimeout(loadChunk.bind(null, ids, callback, retry + 1), pause);
            }
        }
    };
    http.onerror = function (err) {
        callback(null, err);
    };
    http.send(params);
}

function loadChunks(chunks, totalSize, callback) {
    var chunk = chunks.shift();
    console.log('Load', totalSize - chunks.length, 'chunk from', totalSize);
    loadChunk(chunk, function(chunkResult) {
        callback(chunkResult);
        if (chunks.length > 0) {
            loadChunks(chunks, totalSize, callback);
        }
    });
}

function loadRecords(ids, callback) {
    var chunks = splitIds(ids, bulkSize);
    loadChunks(chunks, chunks.length, callback);
}

function repeatAlbumRequest(requestBody, callback) {
    var http = new XMLHttpRequest();
    var params = '';
    var keys = Object.keys(requestBody.formData);
    for (var i = 0; i < keys.length; i++) {
        if (i > 0) params += '&';
        params += keys[i] + '=' + requestBody.formData[keys[i]];
    }
    http.open('POST', audioUrl, true);
    http.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    http.onload = function () {
        if (this.readyState === 4 && this.status == 200) {
            callback(parseResponse(this.responseText));
        }
    };
    http.onerror = function (err) {
        callback(null, err);
    };
    http.send(params);
}

function downloadAlbum(album, progressCallback, callback) {
    var start = Date.now();
    var ids = [];
    for (var i = 0; i < album.list.length; i++) {
        ids.push(album.list[i][1] + '_' + album.list[i][0])
    }

    var total = ids.length;
    var totalLoaded = 0;
    var music = [];

    loadRecords(ids, function(loaded) {
        music = music.concat(loaded);
        totalLoaded += loaded.length;
        progressCallback(totalLoaded, total);
        if (totalLoaded == total) {
            console.log('Downloaded', music.length, 'records in', Date.now() - start, 'ms');
            callback(album.title, music);
        }
    });
}

function createPlaylist(title, records) {
    var playlist = "#EXTM3U";
    for (var i = 0; i < records.length; i++) {
        playlist += "\n\n#EXTINF:-1," + fixFilename(records[i].filename);
        playlist += "\n" + records[i].url;
    }
    var blob = new Blob([playlist], {type : 'text/plain'});
    var url = URL.createObjectURL(blob);
    var filename = fixFilename(title + '.m3u');

    var a = document.createElement('a');
    document.body.appendChild(a);
    a.setAttribute('href', url);
    a.setAttribute('style', 'display: none');
    a.setAttribute('download', filename);

    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function addMusicButtons(album) {
    if (!document.getElementsByClassName('audio_rows')) {
        console.log('No audio rows');
        return;
    }

    var a = document.createElement('a');
    var downloadText = document.createTextNode('Download playlist');
    a.setAttribute('id', 'download_music');
    a.setAttribute('class', 'flat_button');
    a.setAttribute('style', 'width: 100%');
    a.appendChild(downloadText);

    setTimeout(function() {
        var firstRow = document.getElementsByClassName('audio_row')[0];
        insertBefore(firstRow, a)
    }, 1000);

    a.onclick = function() {
        if (a.className.indexOf('secondary') != -1) {
            return;
        }

        a.className = 'flat_button secondary';
        downloadAlbum(album, function (loaded, total) {
            console.log('Downloading playlist... (' + loaded + '/' + total + ')');
        }, function (title, music) {
            createPlaylist(title, music);
            a.className = 'flat_button';
        });
    };
}

function urlHandler() {
    this.oldUrl = document.URL;

    var that = this;
    var detect = function(){
        if (that.oldUrl != document.URL) {
            that.oldUrl = document.URL;
            chrome.runtime.sendMessage({status: "updated"}, handleEvent);
        }
    };

    setInterval(function () {
        detect()
    }, 100);
}

function handleEvent(response) {
    console.log(response.last ? 'Repeat the last request' : 'No requests were found');
    if (response.last) {
        console.log('Repeat', response.last);
        repeatAlbumRequest(response.last.requestBody, function (album, err) {
            if (err) {
                console.error('Failed to repeat request')
            } else {
                console.log('Loaded', fixFilename(album.title), 'with', album.list.length, 'records');
                addMusicButtons(album);
            }
        });
    }
}

var urlDetection = new urlHandler();
chrome.runtime.sendMessage({status: "ready"}, handleEvent);
