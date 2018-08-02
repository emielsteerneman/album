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
const ExifImage = require('exif').ExifImage;

const io        = require('socket.io')(http);

let toolbox     = require('./toolbox');
let misc        = require('./misc');
const Album     = require("./Album");
const UUIDTree  = require("./UUIDTree");
const model     = require('./Model');

const averageHash=require('./averageHash.js');

drive = (os.platform() === "win32") ? process.cwd().split(p.sep)[0] : __dirname.split(p.sep).slice(0, -1).join(p.sep);
albumPath = p.join(drive, 'albumGuid');

// Promisify copy
cpProm = (from, to) => {
    return new Promise((resolve, reject) => {
        fs.copy(from,to, err => {
            if(err) reject(err)
            else resolve()
        });
    });
};
mvProm = (from, to) => {
    return new Promise((resolve, reject) => {
        fs.rename(from,to, err => {
            if(err) reject(err)
            else resolve()
        });
    });
};

l('\n================================================================\n');
l('drive: ' + drive);
l('album: ' + albumPath);

// Load config
configFile = './config.json';
config = require(configFile);


const guidPath = p.join(drive, "guidTree");
const tooLargePath = p.join(drive, "tooLarge");
const tooSmallPath = p.join(drive, "tooSmall");

const robocupPath = p.join(drive, "robocup");

l("guidPath: " + guidPath);

let nTooSmall = 0;
let tooSmallSize = 0;
let nTooLarge = 0;
let tooLargeSize = 0;
let totalSize = 0;

// ==== Find all files
let files = [];
let filesCamera = [];
if(false){
	l("Finding all files..")
    filesCamera = toolbox.getFilesInDir({
		// dir : p.join(drive, "albumPhoneTest", "media", "emiel", "HDD", "phooonnneee"),
		// dir : guidPath,
		dir : p.join(drive, "robocup_camera"),
		minSize : 75 * KB,
		maxSize : 2000 * MB,
		// maxFiles : 500
	});
    filesCamera = _.map(filesCamera, x => ["emiel_camera", x]);
}

let filesPhone = [];
if(false){
    l("Finding all files..")
    filesPhone = toolbox.getFilesInDir({
        dir : p.join(drive, "robocup_phone"),
        minSize : 75 * KB,
        maxSize : 2000 * MB,
        // maxFiles : 500
    });
    filesPhone = _.map(filesPhone, x => ["emiel_phone", x]);
}


let filesAnouk = [];
if(false){
    l("Finding all files..")
    filesAnouk = toolbox.getFilesInDir({
        dir : p.join(drive, "photos_anouk"),
        minSize : 75 * KB,
        maxSize : 2000 * MB,
        // maxFiles : 500
    });
    filesAnouk = _.map(filesAnouk, x => ["anouk_camera", x]);
}

// files = files.concat(filesCamera);
// files = files.concat(filesPhone);
// files = files.concat(filesAnouk);
// l(files.length);




// Create promises in batches

// === Copy all files from cameras into robocup folder === //
let fromTo = [];
if(false){

    const batchSize = 100;
    let batchAt = 0;
    totalSize = 0;

    let totalCopies = 0;

    (function runBatch(){
        l(`Running batch [${batchAt}, ${_.min([files.length, batchAt+batchSize])}].. Transferred : ${(totalSize/GB).toFixed(2)} GB`);

        let promisesBatch = [];
        // Get files for batch
        let filesBatch = files.slice(batchAt, batchAt+batchSize);

        // Generate promises
        _.each(filesBatch, ([imgSource, {path, filepath, filename}], i) => {
            let prom = new Promise((resolve, reject) => {
                
                if(imgSource == "anouk_camera"){
                    new ExifImage({image: filepath}, function (err, exifData) {
                        if (err){ 
                            l("\n\nERROR!!!")
                            l(filepath);
                            return resolve(err);
                        }

                        let momentDate = moment(exifData.exif.CreateDate, "YYYY:MM:DD HH:mm:ss");
                        let day = parseInt(momentDate.date());
                        let month = parseInt(momentDate.month());
                        let hour = parseInt(momentDate.hour());

                        momentDate.subtract(5, 'hours');
                        // l();l(filename, month, day, hour);

                        let newTimestamp = momentDate.format("YYYY-MM-DD_HH-mm-ss");
                        // l(exifData.exif.CreateDate, newTimestamp);
                        let newFilename = "robocup_" + newTimestamp + "_" + imgSource + p.extname(filename);
                        let newFp = p.join(robocupPath, newFilename);

                        l("Copying " + imgSource + "_" + filename + " => " + newTimestamp);
                        if (fs.existsSync(newFp)) {
                            let i = 1;
                            while (fs.existsSync(newFp)) {
                                newFp = p.join(robocupPath, "robocup_" + newTimestamp + "_" + i + "_" + imgSource + p.extname(filename))
                                i++;
                            }
                            l("new filepath : " + newFp);
                            // return reject("---- Not copying " + filepath + ", target already exists: " + newFp);
                        }
                        // l(newFp);

                        // return resolve();

                        // fs.copySync(filepath, newFp);
                        cpProm(filepath, newFp).then(() => {
                            return resolve();
                        }).catch(err => {
                            l("Error copying " + filepath + " => " + newTimestamp);
                            return reject();
                        });

                    });
                }

                return;

                if(imgSource == "emiel_phone") {
                    let fileDate = filename.split(".")[0].split("_").splice(1, 2).join("_");
                    let momentDate = moment(fileDate, "YYYYMMDD_HHmmss");

                    // l();l(filename, fileDate);
                    let [month, day] = [momentDate.month(), momentDate.date()];
                    if(month == 5 && day <= 13){
                        let exclusions = ["IMG_20180613_202025.jpg", "IMG_20180613_202029.jpg", "IMG_20180613_202045.jpg",
                            "IMG_20180613_202046.jpg", "IMG_20180613_204903.jpg", "IMG_20180613_204911.jpg",
                            "IMG_20180613_211936.jpg", "IMG_20180613_211941.jpg", "VID_20180613_170836.mp4"];
                        if(!exclusions.includes(filename)) {
                            // l("Fix it");
                            momentDate.subtract(6, 'hours');
                        }
                        l(momentDate.format("YYYY-MM-DD_HH-mm-ss"));
                    }

                    let newTimestamp = momentDate.format("YYYY-MM-DD_HH-mm-ss");
                    let newFilename = "robocup_" + newTimestamp + "_" + imgSource + p.extname(filename);
                    let newFp = p.join(robocupPath, newFilename);

                    // l("Copying " + imgSource + "_" + filename + " => " + newFilename);
                    // return resolve();

                    if (fs.existsSync(newFp)) {

                        // let stat1 = fs.statSync(filepath);
                        // let stat2 = fs.statSync(newFp);
                        // if(stat1.size != stat2.size){
                        //     l("Error on", stat1.size, filepath, newFp, stat2.size)
                        //     return reject();
                        // }
                        // return resolve();

                        let i = 1;
                        while (fs.existsSync(newFp)) {
                            newFp = p.join(robocupPath, "robocup_" + newTimestamp + "_" + i + "_" + imgSource + p.extname(filename))
                            i++;
                        }
                        // l("new filepath : " + newFp);
                        // return reject("---- Not copying " + filepath + ", target already exists: " + newFp);
                    }

                    // fs.copySync(filepath, newFp);
                    cpProm(filepath, newFp).then(() => {
                        l("Copied " + (++totalCopies) + " : " + filename + " => " + newFp);
                        return resolve();
                    }).catch(err => {
                        l("Error copying " + filepath + " => " + newTimestamp);
                        return reject();
                    });

                    // return resolve();
                }

                if(imgSource == "emiel_camera") {
                    new ExifImage({image: filepath}, function (err, exifData) {
                        if (err) return reject(err);

                        let momentDate = moment(exifData.exif.CreateDate, "YYYY:MM:DD HH:mm:ss");
                        let day = parseInt(momentDate.date());
                        let month = parseInt(momentDate.month());
                        let hour = parseInt(momentDate.hour());

                        l();
                        // l(filename, month, day, hour);
                        if (day <= 19 && month == 5) {
                            // l("Correct!!", exifData.exif.CreateDate)
                            momentDate.subtract(6, 'hours');
                        }

                        let newTimestamp = momentDate.format("YYYY-MM-DD_HH-mm-ss");
                        l(exifData.exif.CreateDate, newTimestamp);
                        let newFilename = "robocup_" + newTimestamp + "_" + imgSource + p.extname(filename);
                        let newFp = p.join(robocupPath, newFilename);

                        l("Copying " + imgSource + "_" + filename + " => " + newTimestamp);
                        if (fs.existsSync(newFp)) {
                            let i = 1;
                            while (fs.existsSync(newFp)) {
                                newFp = p.join(robocupPath, "robocup_" + newTimestamp + "_" + i + "_" + imgSource + p.extname(filename))
                                i++;
                            }
                            l("new filepath : " + newFp);
                            // return reject("---- Not copying " + filepath + ", target already exists: " + newFp);
                        }

                        // fs.copySync(filepath, newFp);
                        cpProm(filepath, newFp).then(() => {
                            return resolve();
                        }).catch(err => {
                            l("Error copying " + filepath + " => " + newTimestamp);
                            return reject();
                        });

                    });
                }
            });
            promisesBatch.push(prom);
        });

        l("\t" + promisesBatch.length + " Promises generated");
        // Resolve promises
        Promise.all(/*_.map(promisesBatch, prom => prom.reflect())*/promisesBatch).then(() => {
            l("\tPromises resolved");
            // totalSize += _.sum(_.map(filesBatch, file => file.filestat.size));
            batchAt += batchSize;
            if(batchAt < files.length){
                l("Setting timeout for batch starting at " + batchAt);
                setTimeout(runBatch, 100);
            }
        }).catch(err => {
            l("Error!", err);
        })
    })();
}



// Copy all files to guidTree
if(false){

    const batchSize = 100;
    let batchAt = 0;
    totalSize = 0;

    (function runBatch(){
        l(`Running batch [${batchAt}, ${_.min([files.length, batchAt+batchSize])}].. Transferred : ${(totalSize/GB).toFixed(2)} GB`);

        let promisesBatch = [];
        // Get files for batch
        let filesBatch = files.slice(batchAt, batchAt+batchSize);
        // Generate promises
        _.each(filesBatch, file => {
            // Get ID of file
            let fileId = toolbox.getUUID(file);
            // Create new filepath for file
            let newDir = p.join(guidPath, fileId.slice(0, 2), fileId.slice(2, 4))
            let newFilepath = p.join(newDir, file.filename);
            // If file doesn't yet exist
            if(!fs.existsSync(newFilepath)){
                let prom = mvProm(file.filepath, newFilepath);
                promisesBatch.push(prom);
            }
        })
        l("\t" + promisesBatch.length + " Promises generated");
        // Resolve promises
        Promise.all(/*_.map(promisesBatch, prom => prom.reflect())*/promises).then(() => {
            l("\tPromises resolved");
            totalSize += _.sum(_.map(filesBatch, file => file.filestat.size));
            batchAt += batchSize;
            if(batchAt < files.length){
                setTimeout(runBatch, 1000);
            }
        })
    })();
}

// Test averageHash
if(false){
    l("Finding all files..")
    let files = toolbox.getFilesInDir({
        dir : p.join(drive, "robocup"),
        // maxFiles : 100,
        // maxSize : 10 * MB
    });
    // Filter files on jpg/jpeg
    
    l(files.length + " files found"); 
    files = _.filter(files, ({filename}) => {
        return filename.toLowerCase().includes('jpg') || filename.toLowerCase().includes('jpeg')
    })
    l(files.length + " files found"); 

    let dir = p.join(drive, "server", "testAvg");

    const batchSize = 10;
    let batchAt = 0;
    totalSize = 0;


    (function runBatch(){
        l(`Running batch [${batchAt}, ${_.min([files.length, batchAt+batchSize])}].. Transferred : ${(totalSize/GB).toFixed(2)} GB`);
        
        let promisesBatch = [];
        // Get files for batch
        let filesBatch = files.slice(batchAt, batchAt+batchSize);
        
        // === Generate promises
        _.each(filesBatch, ({filename, filepath}) => {

            let prom = averageHash.filepathToPixels({filepath});
            prom.then(hash => {
                let filepathNew = p.join(dir, hash + "$" + filename);
                
                fs.ensureSymlink(filepath, filepathNew, err => {
                    if (err) {
                        l("Error while copying file to " + filepathNew);
                        l(err);
                    }
                    l(`${filename} processed : ${hash}`);
                })
                
            }).catch(err => {
                l(`error : ${err}`);
            });
            promisesBatch.push(prom);
        })
        l("\t" + promisesBatch.length + " Promises generated");

        // === Resolve promises 
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

// Test distance between hashes
if(true){
    l("Finding all files..")
    let files = toolbox.getFilesInDir({
        dir : p.join(drive, "server", "testAvg"),
    });
    l(files.length + " files found"); 

    let filenames = _.map(files, ({filename}) => filename.split('$'));
    
    let distanceses = []
    _.each(filenames, ([fHash, fFilename]) => {
        
        // Calculate distances to file
        let distances = _.map(filenames, ([hash, filename]) => {
            let distance = averageHash.distanceBetweenHashes(fHash, hash);
            return [distance, filename];
        })
        distances = _.sortBy(distances, '0');
        // Remove the same image
        while(distances[0][0] == 0)            
            distances.shift();

        // Store distance, from, to
        distanceses.push([fFilename, distances]);
    })

    // Create clusters
    let threshold = 150;

    // === First of, create small clusters
    let clusters = []
    _.each(distanceses, ([filename, distances], i) => {

        let _d = _.filter(distances, ([d, fn]) => d < threshold);
        if(_d.length){
            _d.push([0, filename]);
            clusters.push(_.map(_d, '1'));
        }
    })
    // l(clusters)

    let again = false;
    do {
        again = false;
        for(let i = 0; i < clusters.length; i++){
            for(let j = i+1; j < clusters.length; j++){
                // l(`Comparing ${i} with ${j}`);
                let intersection = _.intersection(clusters[i], clusters[j]);

                if(!intersection.length)
                    continue;

                // l(`  Intersection found between ${i} and ${j}: ${intersection}`);
                again = true;

                // Add entire J cluster to I
                clusters[i] = _.uniq(_.concat(clusters[i], clusters[j]));
                // Remove cluster J
                clusters.splice(j, 1);
                // Reduce j by 1
                j--;

            }
        }
    }while(again);

    clusters = _.sortBy(clusters, c => c.length);

    _.each(clusters, cluster => {
        l("\nCluster length : " + cluster.length);
        l("xdg-open " + cluster.join(" && xdg-open "));
    })
}

// lengths of filenames
if(false){
    l("Finding all files..")
    let files = toolbox.getFilesInDir({
        dir : p.join(drive, "guidTree")
    });
    l(files.length + " files found"); 

    let lengths = _.map(files, ({filename}) => filename.length);
    lengths = _.sortBy(lengths);
    
    l("Mean length: " + _.mean(lengths));
    l("Median: " + lengths[Math.floor(lengths.length / 2)]);

    for(let i = 95; i < 100; i += 0.5){
        let a = Math.floor( lengths.length * (i / 100) );
        l(` ${i.toFixed(2)}% : ${lengths[a]}`);
    }
    l(`100% : ${lengths[lengths.length - 1]}`);

    l(`last 50 : ${lengths.slice(-50)}`);

}


// Test performance difference between getUUID implementations
if(false){

    let strToBits = str => _.map(str, c => ("00000000" + c.charCodeAt(0).toString(2)).slice(-8)).join("");

    l("Finding all files..")
    let files = toolbox.getFilesInDir({
        dir : p.join(drive, "robocup"),
        maxFiles : 10,
        maxSize : 5 * MB
    });
    l(files.length + " files found");

	let start, now;
	let hashes;
	let nCollisions;
	let iterator ;

	let mapping = {
		"getUUID" : toolbox.getUUID,
		// "getUUID_full" : toolbox.getUUID_full
	}

    for(let totalIterations = 0; totalIterations < 1; totalIterations++){
    	_.each(mapping, (func, name) => {
    		l("Running " + name + " implementation");
    		start = Date.now()
    		iterator = 0;
    		fpAndHashes = _.map(files, file => {
    			if(++iterator % 1000 == 0) l(" " + iterator + ".. " + ((Date.now()-start)/1000).toFixed(2) + "s");
    			return {filepath : file.filepath, hash : func(file)};
    		});
    		now = Date.now();

    		let hashes = _.map(fpAndHashes, 'hash');
            l(hashes[0].length + " | " + hashes[0] + " | " + strToBits(hashes[0]).length + " | " + strToBits(hashes[0]));
    		l(hashes)

            nCollisions = hashes.length - _.uniq(hashes).length;
    		l(name + " implementation : " + ((now-start)/1000).toFixed(2) + "s, nCollisions : " + nCollisions);
    		l();

    		fs.writeFileSync("data_impl_" + name + ".json", JSON.stringify(fpAndHashes, null, 4));

    	});
    }
}

return;

let tree = new UUIDTree({
	dir : guidPath,
	config
});

tree.mergeDirectory({
	// dir : p.join(drive, "albumPhoneTest", "media", "emiel", "HDD", "phooonnneee")
	// dir : guidPath
	dir : p.join(drive, "album")
}).then(() => {
	l("Complete!");
})


return;




// Copy all files to guidTree
if(false){
	
	const batchSize = 100;
	let batchAt = 0;
	totalSize = 0;


	(function runBatch(){
		l(`Running batch [${batchAt}, ${_.min([files.length, batchAt+batchSize])}].. Transferred : ${(totalSize/GB).toFixed(2)} GB`);
		
		let promisesBatch = [];
		// Get files for batch
		let filesBatch = files.slice(batchAt, batchAt+batchSize);
		// Generate promises
		_.each(filesBatch, file => {
			let fileId = toolbox.getUUID(file);
			let newDir = p.join(guidPath, fileId.slice(0, 2), fileId.slice(2, 4))
			let newFilepath = p.join(newDir, file.filename);
			// If file doesn't yet exist
			if(!fs.existsSync(newFilepath)){
				let prom = mvProm(file.filepath, newFilepath);
				promisesBatch.push(prom);
			}
		})
		l("\t" + promisesBatch.length + " Promises generated");
		// Resolve promises
		Promise.all(/*_.map(promisesBatch, prom => prom.reflect())*/promises).then(() => {
			l("\tPromises resolved");
			totalSize += _.sum(_.map(filesBatch, file => file.filestat.size));
			batchAt += batchSize;
			if(batchAt < files.length){
				setTimeout(runBatch, 1000);
			}
		})
	})();
}


// Init album
let album = new Album({
	dir : albumPath,
    config
});







if(false){
	
	const batchSize = 100;
	let batchAt = 0;
	totalSize = 0;

	(function runBatch(){
		l(`Running batch [${batchAt}, ${_.min([files.length, batchAt+batchSize])}].. Transferred : ${(totalSize/GB).toFixed(2)} GB`);
		
		let promisesBatch = [];
		// Get files for batch
		let filesBatch = files.slice(batchAt, batchAt+batchSize);
		// Generate promises
		_.each(filesBatch, file => {
			let prom = album.addFile(file.filepath);
			promisesBatch.push(prom);
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