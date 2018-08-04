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
const averageHash = require('./averageHash.js');

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

        l(`Ensuring directory : ${this.dir}`);
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

		let totalcopied = 0;
		let totalprocessed = 0;
		let totaldups = 0;
		let totalweird = 0;

		return new Promise((outerResolve, outerReject) => {
			
			let l = getL("mergeDirectory");

			l(`Retrieving all files in ${dir}..`);
			// Get all the files in the directory
			let files = toolbox.getFilesInDir({
			      dir
				, maxSize : 75 * KB - 1
				// , maxSize : 100 * MB
				// , maxFiles : 3000
			});

			const batchSize = 10;
			let batchAt = 0;
			let totalSize = 0;
			let totalPromises = 0;

			l(`Starting batching..`);
			(function runBatch(){
				l(`Running batch [${batchAt}, ${_.min([files.length, batchAt+batchSize])}].. Transferred : ${(totalSize/GB).toFixed(2)} GB`);
				

				let promisesBatch = [];
				let filesBatch = files.slice(batchAt, batchAt+batchSize);
				
				let dupsFolder = "/media/emiel/External2TB/duplicates/";

				// Generate promises
				promisesBatch = _.map(filesBatch, file => {
					return new Promise((resolve, reject) => {

						totalprocessed++;

						// if(file.filename.toLowerCase().includes('jpg') || file.filename.toLowerCase().includes('jpeg') || file.filename.toLowerCase().includes('png') || file.filename.toLowerCase().includes('gif')){
						// 	return resolve();
						// }

						// Get fileId
						const fileId = toolbox.getUUID(file);
						// Get fingerprint
						averageHash.getFingerprint(file).then(fingerprint => {

							// Create the new filename $UUID$FINGERPRINT$FILENAME
							let newFilename = `${fileId}$${fingerprint}$${file.filename}`;
							
							// If name too long, remove beginning part of file.filename
							if(255 < newFilename.length){
								let len = newFilename.length-254;
								l(`! Name truncated !`);
								newFilename = `${fileId}$${fingerprint}$${file.filename.slice(len)}`;
							}
							
							l(newFilename);
							
							let newDir = p.join(myDir, fileId.slice(0, 2), fileId.slice(2, 4))
							let newFilepath = p.join(newDir, newFilename);

							// If file doesn't yet exist
							if(!fs.existsSync(newFilepath)){
								// Copy file to location
								cpProm(file.filepath, newFilepath).then(() => {
									l(`-Copied ${file.filename} to ${newFilename}`);
									totalcopied++;
									return resolve();
								}).catch(err => {
									return reject(`Error while copying ${file.filename} to ${newFilepath}`);
								});
							}
							// File already exists
							else{
								let hash1 = toolbox.getUUID_full(file);
								let hash2 = toolbox.getUUID_full({filepath : newFilepath});

								// Its the same file. (Check dates?)
								if(hash1 == hash2){
									l(`-Duplicate : ${file.filepath} => ${newFilepath}`);
									totaldups++;
									return resolve();
								}else{
									l(	`!!! DIFFERENT IMAGES WITH THE SAME HASH : \n` + 
										`    ${hash1} - ${file.filepath}` + 
										`    ${hash2} - ${newFilepath}`);

									let file1To = p.join(dupsFolder, fileId + "_" + hash1 + "_" + file.filename);
									let file2To = p.join(dupsFolder, fileId + "_" + hash2 + "_" + newFilename);

									fs.copyFileSync(file.filepath, file1To);
									fs.copyFileSync(newFilepath, file2To);

									totalweird++;
									return resolve();
								}
							}
						});
					});
				})

				totalPromises += promisesBatch.length; 
				l(promisesBatch.length + " Promises generated");
				console.log();
				
				// Resolve promises
				Promise.all(/*_.map(promisesBatch, prom => prom.reflect())*/promisesBatch).then(() => {
					l("Promises resolved");
					totalSize += _.sum(_.map(filesBatch, file => file.filestat.size));
					batchAt += batchSize;
					if(batchAt < files.length){
						l({totalprocessed, totalcopied, totaldups, totalweird});
						console.log();
						setTimeout(runBatch, 500);
					}else{
						l("All promises resolved for a total of " + totalPromises +  " promises!");
						l({totalprocessed, totalcopied, totaldups, totalweird});
						outerResolve();
					}
				}).catch(err => {
					l(`\n! ! ! ! Error ! ! ! ! \n${err}\n ! ! ! ! ! ! ! ! ! ! !`);
					throw err
				})

			})(); // runBatch()
		}) // Return new Promise()
	} // mergeDirectory()
}

module.exports = UUIDTree