const path = require('path');
const fs = require('fs');

export default {
    loadPackageJson: function () {
        return loadJSON('.', 'package.json');
    }
}

function loadJSON(dir: string, file: string): object | null {
    let contents;
    try {
        contents = fs.readFileSync(path.join(dir, file), 'utf8');
    } catch(e) {
        return null;
    }

    if (!contents || !contents.length) {
        return null;
    }
    const json = JSON.parse(contents);
    if (!json) {
        return null;
    }
    return json;
}
