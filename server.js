l = console.log;

const KB = 1000;
const MB = 1000 * KB;
const GB = 1000 * MB;

const express 	= require('express');
const p 		= require('path');
const app 		= express();
const http      = require('http').Server(app);
const bodyParser= require('body-parser');

const os 		= require("os");
const fs 		= require('fs-extra');
const _  		= require('lodash');
const moment 	= require('moment');
const readLine 	= require('readline-sync').question;
const jsonfile 	= require('jsonfile');
const imageSize = require('image-size');
const crypto 	= require('crypto');
const Promise 	= require("bluebird");

const io        = require('socket.io')(http);

let toolbox     = require('./toolbox');
let misc        = require('./misc');
const Album     = require("./Album");
const model     = require('./Model');

drive = (os.platform() === "win32") ? process.cwd().split(p.sep)[0] : __dirname.split(p.sep).slice(0, -1).join(p.sep)
albumPath = p.join(drive, 'albumClass');

l('\n================================================================\n');
l('drive: ' + drive);
l('album: ' + albumPath);

// Load config
configFile = './config.json';
config = require(configFile);


const guidPath = p.join(drive, "guidTree");
const tooLargePath = p.join(drive, "tooLarge");
const tooSmallPath = p.join(drive, "tooSmall");

l("guidPath: " + guidPath);

let nTooSmall = 0;
let tooSmallSize = 0;
let nTooLarge = 0;
let tooLargeSize = 0;
let totalSize = 0;
// ==== Find all files
l("Finding all files..")
let files = [];
toolbox.traverse({
	// path: p.join(drive, "albumPhoneTest", "media", "emiel", "HDD", "phooonnneee"),
	// path: p.join(drive, "album"),
	path: p.join(drive, "guidTree"),
	onFile : function(file){
		// if(files.length >= 1500)
			// return true;

		let size = file.filestat.size;
		if(75 * KB < size && size < 10 * MB){
			files.push(file);
			totalSize += size;
			if(files.length && files.length % 1000 == 0)
				l(files.length + " files..")
		}else 
		if(10 * MB <= size){
			// Too large
			nTooLarge++;
			tooLargeSize += size;
			// fs.ensureSymlinkSync(file.filepath, p.join(tooLargePath, file.filename + "_" + Date.now()));
		}else 
		if(size <= 75 * KB){
			// Too small
			nTooSmall++;
			tooSmallSize += size;
			// let fileId = toolbox.getIdFromFilepath(file);
			// fs.ensureSymlinkSync(file.filepath, p.join(tooSmallPath, fileId.slice(0, 1), file.filename + "_" + Date.now()));
		}
	}
})
l(`${files.length} filed found (${(totalSize/GB).toFixed(2)}GB). ${nTooSmall} too small (${(tooSmallSize/GB).toFixed(2)}GB), ${nTooLarge} too large (${(tooLargeSize/GB).toFixed(2)}GB)`);

return;
// let start, now;
// let hashes;
// let nCollisions;
// start = Date.now();
// hashes = _.map(files, toolbox.getIdFromFilepathWithStream);
// now = Date.now();
// nCollisions = hashes.length - _.uniq(hashes).length;
// l("New implementation : " + ((now-start)/1000).toFixed(2) + "s, nCollisions : " + nCollisions);

// Promisify copy
cpProm = (from, to) => {
	return new Promise((resolve, reject) => {
		fs.copy(from,to, err => {
			if(err) reject(err)
			else resolve()
		});
	});
}


// Solving promises in batches
const batchSize = 100;
let batchAt = 0;
totalSize = 0;

if(false){
	(function runBatch(){
		l(`Running batch [${batchAt}, ${_.min([files.length, batchAt+batchSize])}].. Transferred : ${(totalSize/GB).toFixed(2)} GB`);
		
		let promisesBatch = [];
		// Get files for batch
		let filesBatch = files.slice(batchAt, batchAt+batchSize);
		// Generate promises
		_.each(filesBatch, file => {
			let fileId = toolbox.getIdFromFilepathWithStream(file);
			let newDir = p.join(guidPath, fileId.slice(0, 2), fileId.slice(2, 4))
			let newFilepath = p.join(newDir, file.filename);
			// If file doesn't yet exist
			if(!fs.existsSync(newFilepath)){
				let prom = cpProm(file.filepath, newFilepath);
				promisesBatch.push(prom);
			}
		})
		l("\t" + promisesBatch.length + " Promises generated");
		// Resolve promises
		Promise.all(_.map(promisesBatch, prom => prom.reflect())).then(() => {
			l("\tPromises resolved");
			totalSize += _.sum(_.map(filesBatch, file => file.filestat.size));
			batchAt += batchSize;
			if(batchAt < files.length){
				setTimeout(runBatch, 1000);
			}
		})
	})();
}

return;


// Init album
let album = new Album({
	dir : albumPath,
    config
});


// model.MediaItem.remove({}, () => l("Items removed")); return;
model.MediaItem.find((err, items) => l("Items : " + items.length));




app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

app.use('/album', express.static(albumPath));
app.use('/', express.static(p.join(__dirname, 'public')));

app.use('/get/:year/:month/:day', function(req, res, next){
    album.getYMD(req.params.year, req.params.month, req.params.day).then(items => {
        res.send(items);
    }).catch(err => {
        l(err);
        res.send(null);
    })
});

app.use('/get/unknown', function(req, res, next){
    album.getByRelativeDir('unknown').then(items => {
        res.send(items)
    }).catch(err => {
        l(err);
        res.send(null);
    })
})





let TREE = {};

io.on('connection', function(client){
	l("New SocketIO connection");
    client.emit('tree', TREE);
});

Promise.all(_.map(promises, p => p.reflect())).then( () => {
    l("All promises completed");

    album.treeDirDatabase().then(tree => {
        TREE = tree;

        http.listen(3000, function(){
            console.log("Server listening");
        });

    });

}).catch(err => {
    l("error! : "  + err);
}); 