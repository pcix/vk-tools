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
