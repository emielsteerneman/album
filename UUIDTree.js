const KB = 1000;
const MB = 1000 * KB;
const GB = 1000 * MB;

const fs = require('fs-extra');
const hashFile = require('hash-file');
const crypto = require('crypto');
const mongoose = require('mongoose');
const model = require('./Model');
const p = require('path');
const toolbox = require('./toolbox');
const Promise = require("bluebird");
const _ = require('lodash');

let getL = name => (...args) => console.log(`[UUIDTree]` + (name ? `[${name}]` : ''), ...args);
let l = getL();

class UUIDTree {
	constructor({
		dir,
		config
	}){
		l("New UUIDTree");
		this.dir = dir;
        this.config = config;

        l("Ensuring directory..");
        if(!fs.existsSync(this.dir)){
            fs.mkdirSync(this.dir);
            if(!fs.existsSync(this.dir))
                l("Error! Could not create " + this.dir);
        }

        l("UUIDTree initialized");
	}

	mergeDirectory({
		dir
	}){
		
		let myDir = this.dir;

		// Promisify copy
		let cpProm = (from, to) => {
			return new Promise((resolve, reject) => {
				fs.copy(from,to, err => {
					if(err) reject(err)
					else resolve()
				});
			});
		}
		let mvProm = (from, to) => {
			return new Promise((resolve, reject) => {
				fs.ensureDirSync(p.dirname(to)); // ugly fix
				fs.rename(from,to, err => {
					if(err) reject(err)
					else resolve()
				});
			});
		}

		return new Promise((outerResolve, outerReject) => {
			
			let l = getL("mergeDirectory");

			l(`Retrieving all files in ${dir}..`);
			// Get all the files in the directory
			let files = toolbox.getFilesInDir({
			      dir
				, minSize : 75 * KB
				, maxSize : 100 * MB
				// , maxFiles : 3000
			});

			const batchSize = 100;
			let batchAt = 0;
			let totalSize = 0;
			let totalPromises = 0;

			l(`Starting batching..`);
			(function runBatch(){
				l(`Running batch [${batchAt}, ${_.min([files.length, batchAt+batchSize])}].. Transferred : ${(totalSize/GB).toFixed(2)} GB`);
				
				let promisesBatch = [];
				let filesBatch = files.slice(batchAt, batchAt+batchSize);
				
				// Generate promises
				_.each(filesBatch, file => {
					let fileId = toolbox.getUUID(file);
					let newDir = p.join(myDir, fileId.slice(0, 2), fileId.slice(2, 4))
					let newFilepath = p.join(newDir, file.filename);
					// If file doesn't yet exist
					if(!fs.existsSync(newFilepath)){
						let prom = cpProm(file.filepath, newFilepath);
						promisesBatch.push(prom);
					}
				})
				totalPromises += promisesBatch.length; 
				l("\t" + promisesBatch.length + " Promises generated");
				
				// Resolve promises
				Promise.all(/*_.map(promisesBatch, prom => prom.reflect())*/promisesBatch).then(() => {
					l("\tPromises resolved");
					totalSize += _.sum(_.map(filesBatch, file => file.filestat.size));
					batchAt += batchSize;
					if(batchAt < files.length){
						setTimeout(runBatch, 500);
					}else{
						l("All promises resolved for a total of " + totalPromises +  " promises!");
						outerResolve();
					}
				})

			})(); // runBatch()
		}) // Return new Promise()
	} // mergeDirectory()
}

module.exports = UUIDTree