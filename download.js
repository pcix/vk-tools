var baseUrl = 'https://vk.com';
var audioUrl = baseUrl + '/al_audio.php';
var bulkSize = 5;
var pause = 60000;

function insertBefore(referenceNode, newNode) {
    referenceNode.parentNode.insertBefore(newNode, referenceNode);
}

function insertAfter(referenceNode, newNode) {
    referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
}

function fixFilename(str) {
    var r = /&#([\d]{1,5});/gi;
    str = str.replace(r, function (match, grp) {
        return String.fromCharCode(parseInt(grp, 10)); } );
    str = unescapeHTML(str);
    str = str.replace(/[\\\/\|\*\:\"\<\>\?]/gmi, " ").trim();
    return str;
}

function unescapeHTML(str) {
    return str.replace(/(&amp;|&quot;|&lt;|&gt;)/g, function (m) { return unescapeHTML.replacements[m]; });
}

unescapeHTML.replacements = {
    "&amp;": "&",
    "&quot;": '"',
    "&lt;": "<",
    "&gt;": ">"
};

function getIdMap() {
    var map = {};
    var records = document.getElementsByClassName('audio_row');
    for (var i = 0; i < records.length; i++) {
        map[records[i].id.replace('audio_','')] = JSON.parse(records[i].getAttribute('data-audio'));
    }
    return map;
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
    while (ids.length > 0) {
        var chunk = [];
        while (chunk.length < size && ids.length > 0) chunk.push(ids.pop());
        chunks.push(chunk);
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
    var chunk = chunks.pop();
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

function getOwner() {
    var ownAlbum = /.*\/audios(\d+)$/g;
    var friendAlbum = /.*\/audios\d+\?friend=(\d+)$/g;
    var matchers = [ownAlbum, friendAlbum];
    for (var i = 0; i < matchers.length; i++) {
        var match = matchers[i].exec(document.URL);
        if (match) {
            return match[1];
        }
    }
    return null;
}

function loadAlbum(callback) {
    var ownerId = getOwner();
    if (!ownerId) {
        callback(null, 'Unknown page');
        return;
    }

    var http = new XMLHttpRequest();
    // TODO: album_id ??
    var params = 'act=load_silent&al=1&band=false&album_id=-2&owner_id=' + ownerId;
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

function downloadAlbum(progressCallback, callback) {
    var start = Date.now();
    loadAlbum(function (album, err) {
        if (err) {
            console.error(err);
        } else {
            console.log('Loaded', album.title, 'with', album.list.length, 'records');

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
                    callback(music);
                }
            });
        }
    });
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

function addMusicButtons() {
    var a = document.createElement('a');
    var downloadText = document.createTextNode('Download playlist');
    a.setAttribute('id', 'download_music');
    a.setAttribute('class', 'flat_button');
    a.setAttribute('style', 'width: 100%');
    a.appendChild(downloadText);

    var firstRow = document.getElementsByClassName('audio_row')[0];
    insertBefore(firstRow, a);

    a.onclick = function() {
        if (a.className.indexOf('secondary') != -1) {
            return;
        }

        a.className = 'flat_button secondary';
        downloadAlbum(function (loaded, total) {
            console.log('Downloading playlist... (' + loaded + '/' + total + ')');
        }, function (music) {
            createPlaylist(music);
            a.className = 'flat_button';
        });
    };
}

function isMusicPage() {
    return !!getOwner();
}

if (isMusicPage()) {
    addMusicButtons();
}
