/* SvURL
   Save URLs from the command-line
   Load URLs from the command-line
   Avoid duplicates
   Created 2019-06-08
   Updated 2019-06-08 22:13 v0.0.2
*/

const fs       = require('fs'),
      url      = require('url'),
      util     = require('util'),
      readline = require('readline');

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

SvURL.prototype.addToSet = function (aSetName, aURL, origin) { // takes a String, a URL, an optional String
    try {
        this.url = new URL(aURL);
        const theSet = this.findSet(aSetName); // get a Set Promise from its name
        if (origin === 'origin') { // only save the origin portion of the URL
            theSet.then(set => set.add(aURL.origin));
        } else if (typeof origin === 'undefined') { // save the full URL
            theSet.then(set => set.add(this.fullPath()));
        } else {
            throw new Error(`Incorrect origin: '${origin}'; should be 'undefined' or 'origin'.`);
        }
    } catch (err) {
        console.error(err.message);
        process.exit(-1);
    }
}

SvURL.prototype.saveSets = function() { // saves the sets back into their files
    this.sets.forEach( ({ setName, setPath, set}) => {
        this.saveSet(setPath, set);
    });
}

SvURL.prototype.saveSet = function (aPath, aSet) { // takes a String and a Set Promise
    const tmp = `${aPath}.tmp`, // save into a temp file first
          bak = `${aPath}.bak`; // make a backup

    if (fs.existsSync(tmp)) fs.unlinkSync(tmp); // deletes the old backup

    aSet.then(set => {
        set.forEach( (url, _, _) => { // gets each url in the set
            fs.appendFileSync(tmp, url + "\n"); // saves each URL of the set
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

SvURL.prototype.showSetElements = function (aSetname) { // takes a String name
    console.log(`Show set '${aSetname}':
	${util.inspect(this.sets.find(set => set.setName === aSetname))}\n`);
}

SvURL.prototype.showURL = function () { // shows original URL with query string
    console.log(this.url);
}

SvURL.prototype.showURLFullPath = function () { // shows URL without query string
    console.log(this.fullPath());
}

SvURL.prototype.findSet = function (aSetName) { // given a String name, find its set
    return (this.sets.find(set => set.setName === aSetName)).set; // returns a Promise
}

SvURL.prototype.showSet = function (aSet) { // takes a Promise
    aSet.then(set => console.log(util.inspect(set))); // inspects its elements (URLs)
}

SvURL.prototype.findAndShowSet = function (aSetName) { // takes a String
    console.log(`Show set: '${aSetName}'`); // combines findSet and showSet
    this.showSet(this.findSet(aSetName));
}

module.exports = SvURL;
