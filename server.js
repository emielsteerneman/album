l = console.log;

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

// Init album
let album = new Album({
	dir : albumPath,
    config
});


// model.MediaItem.remove({}, () => l("Items removed")); return;
model.MediaItem.find((err, items) => l("Items : " + items.length));

let promises = [];

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

// return;

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