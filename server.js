l = console.log;

const express 	= require('express');
const p 		= require('path');
const app 		= express();
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

let io = require('socket.io')();

let toolbox = require('./toolbox');
let misc = require('./misc');
const Album = require("./Album");
const model = require('./Model');

drive = (os.platform() === "win32") ? process.cwd().split(p.sep)[0] : __dirname.split(p.sep).slice(0, -1).join(p.sep)
albumPath = p.join(drive, 'albumClass');

l('\n================================================================\n');
l('drive: ' + drive);
l('album: ' + albumPath);

// Load config
configFile = './config.json';
config = require(configFile);


let album = new Album({
	dir : albumPath
});

// model.MediaItem.remove({}, () => {});
// return;

let nFiles = 0;
toolbox.traverse({
    path : p.join(drive, "albumPhoneTest", "media"),
    onFile : args => {

        if(nFiles > 10)
        	return true;

        nFiles++;

        // l(args.filepath);

        album.addFile(args.filepath);

        return;
    },
});


return;

// Load index
indexFile = p.join(albumPath, 'index.json');
try{
	index = require(indexFile);
	l("Index file loaded");
}catch(e){
	l("Error! No index file");
	// process.exit(1);
	index = {};
	// index = toolbox.indexFiles(albumPath)
}
if(typeof index === "undefined")
	throw new Error("No index file!");

model.init();

model.MediaItem.remove({}, () => {});
model.MediaItem.find((err, items) => {
	l("Items : " + items.length);
	_.each(items, item => l(item.id));
});

// return;

nFiles = 0;
toolbox.traverse({
	path : p.join(drive, "albumPhoneTest", "media"),
	onFile : args => {

		// if(nFiles > 10)
		// 	return true;
		nFiles++;

        let info = toolbox.mergeFileIntoAlbum(args);

        if(typeof info === "undefined") {
            l("Info undefined!");
            l(JSON.stringify(args, null, 4));
        	process.exit(-1);
        }


		let exists = false;
        model.MediaItem.findOne({ id : info.id }, function(err, obj){

        	nFiles++;

        	l("\n");
            console.log(nFiles, args.relativePath);
            console.log(info.id, info.relativeDir + "/" + info.filename);

            if(err) {
                l(err);
            	return;
            }

			if(obj){
				l("Object already exists");
				l("\t" + obj.relativeDir + "/" + obj.filename)
				return;
			}

			l("obj doesn't exist");

            let item = new model.MediaItem({
                id : info.id,
                filename : info.filename,
                relativeDir : info.relativeDir,
                source : info.source,
                deleted : false,
                favourited : false
            });
            item.save();

        });



	},
});

l("Done");
return;






app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use('/album', express.static(albumPath))
app.use('/', express.static(p.join(__dirname, 'web')))







io.on('connection', function(client){
	l("New SocketIO connection")
});

app.listen(3000, function(){
	console.log("Server listening")
	io.listen(3000);
})