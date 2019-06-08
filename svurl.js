const fs = require('fs'),
      readline = require('readline'),
      url = require('url'),
      util = require('util');

function SvURL (sets) {
    const defaultSets = {saved: './.saved', origins: './.origins', used: './.used'};
    this.paths = {...defaultSets, ...sets};

    this.sets = Object.entries(this.paths)
        .map(([setName, setPath]) => {
            return { setName, setPath, set: this.getSet(setPath) }
        });

    // this.savedSet = this.getSet(saved);
    // this.originsSet = this.getSet(origins);
    // this.usedSet = this.getSet(used);

    this.url;
    // this.saved = saved;
    // this.origins = origins;
    // this.used = used;
}


SvURL.prototype.showSets = function () {
    console.log(util.inspect(this.sets));
}

SvURL.prototype.showSet = function (aSet) {
    console.log(util.inspect(this.sets[aSet]));
}

SvURL.prototype.fullPath = function () {
    return this.url ? `${this.url.origin}${this.url.pathname}` : undefined;
}

SvURL.prototype.showFullPath = function () {
    console.log(this.fullPath());
}

SvURL.prototype.showURL = function () {
    console.log(this.url);
}

// SvURL.prototype.fullPath = function() {
//     return this.url ? `${this.url.origin}${this.url.pathname}` : undefined;
// }

// SvURL.prototype.showURL = function () {
//     console.log(this.url);
// }

// SvURL.prototype.showURLFullPath = function () {
//     console.log(this.fullPath());
// }

SvURL.prototype.addToSet = function (aURL) {
    try {
        this.url = new URL(aURL);
        this.savedSet.then(set => set.add(this.fullPath()));
        this.originsSet.then(set => set.add(this.url.origin));
    } catch (err) {
        console.error(err.message);
        process.exit(-1);
    }
}

SvURL.prototype.getSet = function (path) {
    try {
        fs.accessSync(path, fs.constants.R_OK);
    } catch (err) {
        if (err.code === 'ENOENT') {
            console.error(err.message);
            fs.appendFileSync(path, '');
            console.log(`Created ${path}`);
        } else {
            throw err;
        }
    }
    return new Promise( function (resolve, reject) {
        const set = new Set();
        try {
            const rls = readline.createInterface({
                input: fs.createReadStream(path),
                removeHistoryDuplicates: true
            });

            rls.on('line', line => set.add(line));
            rls.on('close', () => resolve(set));

        } catch (err) {
            reject(err);
        }
    });
}

// SvURL.prototype.showSet = function (aSet) {
//     aSet.then( set => console.log(util.inspect(set)) );
// }

SvURL.prototype.saveSets = function() {
    this.saveSet(this.saved, this.savedSet);
    this.saveSet(this.origins, this.originsSet);
    this.saveSet(this.used, this.usedSet);
}

SvURL.prototype.saveSet = function (aFile, aSet) {
    const tmp = `${aFile}.tmp`,
          bak = `${aFile}.bak`;
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    aSet.then(set => {
        set.forEach( (v1, v2, s) => {
            fs.appendFileSync(tmp, v1+"\n");
        });
        fs.copyFileSync(aFile, bak);
        if (fs.existsSync(tmp)) {
            fs.renameSync(tmp, aFile);
        }
    });
}

module.exports = SvURL;
