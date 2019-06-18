/* SvURL
   Save URLs from the command-line
   Load URLs from the command-line
   Avoid duplicates
   Created 2019-06-08
   Updated 2019-06-18 13:05 v0.0.13
*/

const fs       = require('fs'),
      url      = require('url'),
      util     = require('util'),
      readline = require('readline'),
      child_proc=require('child_process');

/*
   a set is: {setName:String, setPath:Path-to-File, set:Set-Promise}
   sets is: an Array of sets
*/
function SvURL (sets) { // Function constructor; takes an optional Object of named files
    const defaultSets = {saved: './.saved', origins: './.origins', used: './.used'};
    this.paths = {...defaultSets, ...sets};

    this.sets = Object.entries(this.paths)
        .map(([setName, setPath]) => {
            return { setName, setPath, set: this.loadSet(setPath) } // get some Promises
        });  // returns [{setName, setPath, set}...]

    this.url;
}

SvURL.prototype.loadSet = function (aPath) { // takes a String; returns a Promised Set
    try { // create a file path if it does not already exist
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
    return new Promise( function (resolve, reject) { // places URLs into a Set asynchronously
        const set = new Set(); // initializes an empty Set
        try {
            const rls = readline.createInterface({ // loads each URL
                input: fs.createReadStream(aPath), // found in a file path
                removeHistoryDuplicates: true
            });

            rls.on('line',  line => set.add(line));
            rls.on('close', ()   => resolve(set)); // here is the Promised Set

        } catch (err) {
            reject(err);
        }
    });
}

SvURL.prototype.addToSet = function (aSetName, checkSetName, aURL, origin) {
     // takes a String, an optional String, an optional URL, an optional String
    try {
        this.url = aURL;

        const theSetInfo = this.findSetInfo(aSetName); // gets a Set Promise from its name
        const theSet = theSetInfo.set;
        // gets a Set Promise to also check (used) unless saving an 'origins'
        const checkSetInfo = checkSetName ? this.findSetInfo(checkSetName) : null;
        const checkSet = checkSetInfo ? checkSetInfo.set : null;

        if (origin === 'origin') { // only save the origin portion of the URL
            theSet.then(set => {
                if (!set.has(this.url.origin)) {
                    set.add(this.url.origin);
                    fs.appendFile(theSetInfo.setPath, this.url.origin + '\n', (err) => {
                        if (err) console.error(err.message);
                    });
                    console.log(`added ${this.url.origin}`);
                }
            })

        } else if (typeof origin === 'undefined') { // save the full URL
            theSet.then(set1 => {
                checkSet.then(set2 => {
                    const fullPath = this.fullPath();
                    if (set2.has(fullPath)) {
                        console.log(`duplicate ${checkSetInfo.setName} at ${[...set2].findIndex(e => e === fullPath) + 1}`);
                    } else if (set1.has(fullPath)) {
                        console.log(`duplicate ${theSetInfo.setName} at ${[...set1].findIndex(e => e === fullPath) + 1}`);
                    } else {
                        set1.add(fullPath);
                        fs.appendFile(theSetInfo.setPath, fullPath + '\n',  (err) => {
                            if (err) console.error(err.message);
                        });
                        console.log(`added ${fullPath}`);
                    }
                })
            })

        } else {
            throw new Error(`Incorrect origin: '${origin}'; should be 'undefined' or 'origin'.`);
        }
    } catch (err) {
        console.error(err.message);
        process.exit(-1);
    }
}

SvURL.prototype.openURL = function (aURL) {
    console.log(`in openURL with ${aURL}`);
    child_proc.exec(`open -a Safari ${aURL}`, (err, stdout, stdin) => {
        if (err) throw err;
    });
}

SvURL.prototype.popURL = function (aSetName, toSetName) {
    this.findSet(aSetName).then(set => {
        const size = set.size;
        this.getIndex(aSetName, toSetName, size - 1, true);
    });
}

SvURL.prototype.undoPop = function (aSetName, toSetName) {

    const setInfo = this.findSetInfo(aSetName);
    const toSetInfo = this.findSetInfo(toSetName);
    const setPath = setInfo.setPath;
    const toSetPath = toSetInfo.setPath;

    try {
        fs.renameSync(`${setPath}.bak`, setPath);
        fs.renameSync(`${toSetPath}.bak`, toSetPath);
    } catch (err) {
        if (err.code !== 'ENOENT') throw err;
        console.log('Cannot undo: no bak file');
    }
}

SvURL.prototype.getIndex = function (aSetName, toSetName, index, deletep=false) {
    // takes a String, a String, an Int, an optional Bool

    const setInfo = this.findSetInfo(aSetName);
    const toSetInfo = this.findSetInfo(toSetName);

    setInfo.set.then(set => {
        try {
            if (index < 1 || index >= set.size)
                throw new Error(`Index out of range (max index is ${set.size - 1})`);

            const indexedURL = [...set][index];

            if (deletep) {
                set.delete(indexedURL);
                toSetInfo.set.then(toSet => {
                    toSet.add(indexedURL);
                    this.saveSets();
                });
            }

            this.openURL(indexedURL);

        } catch (err) {
            console.error(err.message);

        }});
}

SvURL.prototype.getRandomIndex = function (aSetName, toSetName, deletep=false) {
    // takes a String, a String
    const aSet = this.findSet(aSetName);

    aSet.then(set => {
        const randIndex = Math.floor(Math.random() * set.size);
        this.getIndex(aSetName, toSetName, randIndex, deletep);
    });
}

SvURL.prototype.saveSets = function() { // saves the sets back into their files
    this.sets.forEach( ({ setName, setPath, set}) => {
        this.saveSet(setPath, set);
    });
}

SvURL.prototype.saveSet = function (aPath, aSet) { // takes a String and a Set Promise

    const tmp = `${aPath}.tmp`, // saves into a temp file first
          bak = `${aPath}.bak`; // makes a backup

    if (fs.existsSync(tmp)) {
        console.log(`unlinking ${tmp}`);
        fs.unlinkSync(tmp); // deletes the old backup
    }

    aSet.then(set => {
        set.forEach( (url1, url2, _) => { // gets each url in the set
            fs.appendFileSync(tmp, url1 + "\n"); // saves each URL of the set
        });

        fs.copyFileSync(aPath, bak); // makes a backup

        if (fs.existsSync(tmp)) { // if the set is empty, tmp will not exist
            fs.renameSync(tmp, aPath); // overwrites the original
        }
    });
}

/* UTILITY FUNCTIONS BELOW */

SvURL.prototype.fullPath = function () { // strips query string from URL
    return this.url ? `${this.url.origin}${this.url.pathname}` : undefined;
}

SvURL.prototype.showSets = function () { // shows what sets have been loaded
    console.log(`Show sets:
${util.inspect(this.sets)}\n`);
}

SvURL.prototype.showURL = function () { // shows original URL with query string
    console.log(this.url);
}

SvURL.prototype.showURLFullPath = function () { // shows URL without query string
    console.log(this.fullPath());
}

SvURL.prototype.findSetInfo = function (aSetName) {
    return (this.sets.find(set => set.setName === aSetName));
}

SvURL.prototype.findSet = function (aSetName) { // given a String name, find its set
    return this.findSetInfo(aSetName).set; // returns a Promise
}

SvURL.prototype.showSet = function (aSet) { // takes a Promise
    console.log('showing set');
    aSet.then(set => console.log(util.inspect(set))); // inspects its elements (URLs)
}

SvURL.prototype.findAndShowSet = function (aSetName) { // takes a String
    console.log(`Show set: '${aSetName}'`); // combines findSet and showSet
    this.showSet(this.findSet(aSetName));
}

SvURL.prototype.merge = function (left1, right1, left2, right2) {
    // takes four strings
    // merges two files
    const leftInfo1 = this.findSetInfo(left1);
    const rightInfo1 = this.findSetInfo(right1);
    const leftInfo2 = this.findSetInfo(left2);
    const rightInfo2 = this.findSetInfo(right2);

    leftInfo1.set.then(leftSet1 => {
        rightInfo1.set.then(rightSet1 => {
            const set1 = new Set([...leftSet1, ...rightSet1]); // UNION of sets1

            leftInfo2.set.then(leftSet2 => {
                rightInfo2.set.then(rightSet2 => {
                    const set2 = new Set([...leftSet2, ...rightSet2]); // UNION of sets2

                    const mergedSet = new Set([...set1].filter(e => ! set2.has(e))); // DIFFERENCE of sets1 and sets2

                    this.saveSet(leftInfo1.setPath, Promise.resolve(mergedSet)); // save mergedSet
                    this.saveSet(leftInfo2.setPath, Promise.resolve(set2)); // save set2
                });
            });
        });
    });
}

module.exports = SvURL;
