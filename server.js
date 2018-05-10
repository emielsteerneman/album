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
l("guidPath: " + guidPath);

// ==== Find all files
let files = [];
toolbox.traverse({
	path: p.join(drive, "albumPhoneTest", "media", "emiel", "HDD", "phooonnneee"),
	onFile : function(file){
		if(files.length >= 50)
			return true;

		let size = file.filestat.size;
		if(500 * KB < size && size < 10 * MB)
			files.push(file);
	}
})
l("#files : " + files.length);

// Promisify copy
cpProm = (from, to) => {
	return new Promise((resolve, reject) => {
		fs.copy(from,to, err => {
			if(err) reject(err)
			else resolve()
		});
	});
}

// ==== Create promises
let promises = [];
_.each(files, file => {
	let fileId = toolbox.getIdFromFilepath(file);
	let newDir = p.join(guidPath, fileId.slice(0, 2), fileId.slice(2, 4))
	let newFilepath = p.join(newDir, file.filename);
	
	let prom = cpProm(file.filepath, newFilepath);
	promises.push(prom);
});


const batchSize = 10;
let batchAt = 0;

(function runBatch(){
	l(`Running batch [${batchAt}, ${_.min([promises.length, batchAt+batchSize])}]`);
	
	let promiseBatch = promises.slice(batchAt, batchAt+batchSize);


	batchAt += batchSize;
	if(batchAt < promises.length){
		setTimeout(runBatch, 200);
	}

})();

return;


// Init album
let album = new Album({
	dir : albumPath,
    config
});


// model.MediaItem.remove({}, () => l("Items removed")); return;
model.MediaItem.find((err, items) => l("Items : " + items.length));

// let promises = [];

if(false) {
    let nFiles = 0;
    toolbox.traverse({
        path: p.join(drive, "albumPhoneTest", "media", "emiel", "HDD", "phooonnneee"),
        onFile: args => {
            if (++nFiles > 1000) return true;
            promises.push(album.addFile(args.filepath));
        },
    });
}else{
    l("Not doing that stuff!")
}

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