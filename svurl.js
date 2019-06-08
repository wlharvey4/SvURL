const fs = require('fs'),
      readline = require('readline'),
      url = require('url'),
      util = require('util');

function SvURL (sets) {
    const defaultSets = {saved: './.saved', origins: './.origins', used: './.used'};
    this.paths = {...defaultSets, ...sets};

    this.sets = Object.entries(this.paths)
        .map(([setName, setPath]) => {
            return { setName, setPath, set: this.loadSet(setPath) }
        });

    this.url;
}

SvURL.prototype.fullPath = function () {
    return this.url ? `${this.url.origin}${this.url.pathname}` : undefined;
}

SvURL.prototype.showSets = function () {
    console.log(`Show sets:
${util.inspect(this.sets)}\n`);
}

SvURL.prototype.showSetElements = function (setName) {
    console.log(`Show set '${setName}':
	${util.inspect(this.sets.find(set => set.setName === setName))}\n`);
}

SvURL.prototype.showURL = function () {
    console.log(this.url);
}

SvURL.prototype.showURLFullPath = function () {
    console.log(this.fullPath());
}

SvURL.prototype.addToSet = function (aSetName, aURL) {
    try {
        this.url = new URL(aURL);
        const theSet = this.findSet(aSetName);
        this.savedSet.then(set => set.add(this.fullPath()));
        this.originsSet.then(set => set.add(this.url.origin));
    } catch (err) {
        console.error(err.message);
        process.exit(-1);
    }
}

SvURL.prototype.findSet = function (aSetName) { // takes a String
    return (this.sets.find(set => set.setName === aSetName)).set; // returns a Promise
}

SvURL.prototype.showSet = function (aSet) { // takes a Promise
    aSet.then(set => console.log(util.inspect(set)));
}

SvURL.prototype.findAndShowSet = function (aSetName) { // takes a String
    this.showSet(this.findSet(aSetName));
}

SvURL.prototype.loadSet = function (aPath) {
    try {
        fs.accessSync(aPath, fs.constants.R_OK);
    } catch (err) {
        if (err.code === 'ENOENT') {
            console.error(err.message);
            fs.appendFileSync(aPath, '');
            console.log(`Created ${aPath}`);
        } else {
            throw err;
        }
    }
    return new Promise( function (resolve, reject) {
        const set = new Set();
        try {
            const rls = readline.createInterface({
                input: fs.createReadStream(aPath),
                removeHistoryDuplicates: true
            });

            rls.on('line', line => set.add(line));
            rls.on('close', () => resolve(set));

        } catch (err) {
            reject(err);
        }
    });
}

SvURL.prototype.saveSets = function() {
    this.saveSet(this.saved, this.savedSet);
    this.saveSet(this.origins, this.originsSet);
    this.saveSet(this.used, this.usedSet);
}

SvURL.prototype.saveSet = function (aPath, aSet) {
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
