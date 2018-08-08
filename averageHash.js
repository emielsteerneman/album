l = console.log;

const KB = 1000;
const MB = 1000 * KB;
const GB = 1000 * MB;

const p 		= require('path');

const os 		= require("os");
const fs 		= require('fs-extra');
const _  		= require('lodash');

const imageSize = require('image-size');
const crypto 	= require('crypto');
const Promise 	= require("bluebird");
const ExifImage = require('exif').ExifImage;

const getPixels = require("get-pixels");
const PNGImage  = require('pngjs-image');

let toolbox     = require('./toolbox');
let misc        = require('./misc');

module.exports = {
	getFingerprint,
	hashToImage,
	distanceBetweenHashes,
	createNetwork
}

// pad number
const pN = (i, size) => ('         ' + i).slice(-size);

/* 
UUID $ FINGERPRINT=WIDTH_HEIGHT_HASH $ ORIGINAL FILENAME

*/
class Filename {
	constructor(UUID, fingerprint, filename){
		this.UUID = UUID;
		this.fingerprint = fingerprint;
		this.filename = filename;

		l(`[Filename] UUID=${UUID}, fingerprint=${fingerprint}, filename=${filename}`);
	}

	getHash(){
		let [width, height, hash] = this.fingerprint.split('_');
		return hash.replace(/=/g, '/');
	}

	static fromString(filename){
		let [UUID, fingerprint, filename] = filename.split('$');
		l(`[Filename][fromString] UUID=${UUID}, fingerprint=${fingerprint}, filename=${filename}`);
		return new Filename(UUID, fingerprint, filename);
	}
}

/* Warning : Only works nice with bitsPerColor=4 atm */ 
function getFingerprint({filepath, log = false}){
	let l = (...args) => console.log("[getFingerprint]", ...args);

	const chunksInRow  = 8; // Number of chunks in row
	const chunksInCol  = 8; // Number of chunks in column
	const bitsPerColor = 4; // Number of bits used per colour 

	return new Promise((resolve, reject) => {

		// Does not support : mp4, m4a, mp3, webm, ai, rar

		// if(filepath.includes('mp4') || filepath.includes('m4a') || filepath.includes('mp3') || filepath.includes('webm')){
		// 	return resolve('');
		// }

		// Get the pixels of the image
		getPixels(filepath, function(err, pixels){
			
			// If an error occured, reject
			if(err){
				return resolve('');
				
				// l(`Error on file ${filepath} : ${err}`);
				// return reject(err);
			}

			let [width, height, channels] = pixels.shape;	// Width and height of image in pixels, number of channels in image

			const chunkWidth  = width / chunksInRow;		// Width  of chunk in pixels
			const chunkHeight = height / chunksInCol;		// Height of chunk in pixels
			const chunkSize   = chunkWidth * chunkHeight;	// Total amount of pixels in chunk

			// Array to hold the colours of the chunks
			let rgbArray = []; // [r, g, b, r, g, b, ...]

			// Number of bytes needed to hold the bits of the hash = number of chunks * 3 colours * (number of bits per colour / 8 bits)
			const hashBufferSize = Math.ceil(chunksInRow * chunksInCol * 3 * (bitsPerColor / 8));
			// Buffer to hold the bytes of the hash
			const hashBuffer = Buffer.alloc(hashBufferSize);
			
			if(log) console.log("\n");
			if(log) l(
			"\n\t" + filepath, 
			"\n\twidth : " + width, 
			"\n\theight: " + height,
			"\n\twidth  of chunk : " + chunkWidth,
			"\n\theight of chunk : " + chunkHeight,
			"\n\tsize   of chunk : " + chunkSize,
			"\n\tsize of hash buffer : " + hashBufferSize);

			// Chunk x and y, pixel x and y
			let cx, cy, dx, dy;
			// For all chunks
			for(cy = 0; cy < chunksInCol; cy++){
				for(cx = 0; cx < chunksInRow; cx++){
					
					// Position of the chunk in the image
					let offsetX = cx * chunkWidth;
					let offsetY = cy * chunkHeight;

					// Accumulators
					let [red, green, blue] = [0, 0, 0];

					// For all pixels in chunk
					for(dy = 0; dy < chunkHeight; dy++){
						for(dx = 0; dx < chunkWidth; dx++){
							// Get colours and add the them to accumulators
							let i = /*down*/ (offsetY + dy) * width * channels /*right*/ + (offsetX + dx) * channels;
							let [dr, dg, db] = pixels.data.slice(i, i + 3);
							red += dr;
							green += dg;
							blue += db;
						}
					}
					
					let toShift = 8 - bitsPerColor;													// Number of bits to shift
					let rgb = [red, green, blue];													// Get accumulators
					let avg = [aRed, aGreen, aBlue] = _.map(rgb, v => Math.floor(v / chunkSize));	// Calculate average colours
					let qnt = [qRed, qGreen, qBlue] = _.map(avg, v => (v >> toShift) << toShift);	// Calculate quantized colours
					rgbArray = _.concat(rgbArray, qnt);												// Store quantized colours in array

					if(log){
						let toBit = n => ("00000000" + (n >> toShift).toString(2)).slice(-bitsPerColor);
						let hashChunk = _.map([qRed, qGreen, qBlue], toBit).join(' ');
						l(`Processed chunk [${cx}, ${cy}], @[${pN(offsetX,4)}, ${pN(offsetY,4)}] : [${pN(aRed,3)}, ${pN(aGreen,3)}, ${pN(aBlue,3)}] : [${pN(qRed,3)}, ${pN(qGreen,3)}, ${pN(qBlue,3)}] : ${hashChunk}`);
					}			
				}	
			}

			// Create hash from rgbArray
			for(let i = 0; i < hashBufferSize; i++){
				let value = rgbArray[i*2] | (rgbArray[i*2+1] >> 4);
				hashBuffer[i] = value;
			}

			// Add width and height to hash, replace / with = 
			let hash = chunksInRow + '_' + chunksInCol + '_' + hashBuffer.toString('base64').replace(/\//g, '=');
			if(log) l(`hash : ${hash}`);

			// Return the hash
			return resolve(hash);
			
		})
	})
}

function hashToImage(b64String, filepath){
	let l = (...args) => console.log("[hashToImage]", ...args);

	l(`Converting hash ${b64String}`);

	// Extract width, height, and hash from b64String
	let [width, height, hash] = b64String.split('_');
	width = Number.parseInt(width);
	height= Number.parseInt(height);
	hash  = hash.replace(/=/g, '/');

	// Convert the hash from base64 to bytes
	const hashBuffer = Buffer.from(hash, 'base64');

	// === Convert the bytes back to RGB values === //
	// Holds rgb values
	let rgbArray = [];
	// For each byte
	for(i = 0; i < hashBuffer.length; i++){
		// 4 leftmost bits of byte
		let valLeft  = hashBuffer[i] & 240;
		// 4 rightmost bits of byte
		let valRight = (hashBuffer[i] << 4) & 240;
		// Store values
		rgbArray.push(valLeft);
		rgbArray.push(valRight);
	}

	// === Initialize image
	let chunkWidth = 100, chunkHeight = 100;
	var image = PNGImage.createImage(width * chunkWidth, height * chunkHeight);

	// === Draw each chunk in the image
	let cx, cy, dx, dy;
	// For each chunk
	for(cy = 0; cy < 8; cy++){
		for(cx = 0; cx < 8; cx++){
			
			// Get position of chunk in image
			let offsetX = cx * 100;
			let offsetY = cy * 100;
			// Get position of colours in array
			let at = (cy * 8 + cx) * 3;
			// get colours
			let [red, green, blue] = rgbArray.slice(at, at+3);

			// Draw the chunk
			for(dy = 0; dy < 100; dy++){
				for(dx = 0; dx < 100; dx++){
					image.setAt(offsetX + dx, offsetY + dy, { red, green, blue, alpha: 255 });
				}
			}
		}	
	}

	// === Store the image
	image.writeImage(filepath, function (err) {
		if (err) throw err;
		l("Image written");
	});
}

function hashToRgb(hash){
	hash = hash.replace(/=/g, '/');

	// Strip off fingerprint size \d+_\d+_ if needed
	if(hash.includes('_')){
		hash = _.last(hash.split('_'));
	}

	// === Convert the bytes back to RGB values === //
	// Convert hash from base64 to bytes
	const hashBuffer = Buffer.from(hash, 'base64');
	// Holds rgb values
	let rgbArray = [];
	// For each byte
	for(i = 0; i < hashBuffer.length; i++){
		// 4 leftmost bits of byte
		let valLeft  = hashBuffer[i] & 240;
		// 4 rightmost bits of byte
		let valRight = (hashBuffer[i] << 4) & 240;
		// Store values
		rgbArray.push(valLeft);
		rgbArray.push(valRight);
	}

	return rgbArray;
}

function distanceBetweenHashes(hash1, hash2){
	let rgb1 = hashToRgb(hash1);
	let rgb2 = hashToRgb(hash2);

	return distanceBetweenRGBs(rgb1, rgb2);
}

function distanceBetweenRGBs(rgb1, rgb2){
	let distance = 0;

	// Assumes both arrays have the same length
	let len = rgb1.length
	// For each RGB values in the array
	for(i = 0; i < len; i++){
		// Calculate the distance to the RGB value in the other array
		distance += Math.abs( (rgb1[i]>>4) -  (rgb2[i]>>4));
	}

	return distance;
}

class Node {
	constructor(file, id){
		let l = (...args) => console.log(`[Node ${id}]`, ...args);
		this.id = id;

		l("New node : ", file.fingerprint, file.filename_original);
		this.file = file;
		this.rgb = hashToRgb(this.file.fingerprint);

		this.connections = [];
		this.visited = false;
	}

	// TODO : check for duplicates
	addConnection(node){
		this.connections.push(node);
	}
}

function createNetwork(dir){
	const thresh = 100;

	let l = (...args) => console.log('[createNetwork]', ...args);
	dir = p.resolve(dir);
	l(`directory: ${dir}`);

	// Get all the files in the directory
	// Filter out all files without fingerprints
	// Create a node for each file
	// Iterate over each node and check if other node is within distance
	// Create clusters
	// Store clusters in different folders


	// Get all the files in the directory
	l("Finding all files..")
    let files = toolbox.getFilesInDir({ dir });
    l(files.length + " files found"); 
    
    // Filter out all files without fingerprints
    files = _.filter(files, ({filename}) => filename.split("$").length == 3);
    l(files.length + " files found with hashes");
    
    // TEMP less files
    // files = files.slice(0, 10000);

    // Create a node for each file
    let nodes = _.map(files, (file, i) => {
    	l("\n\n" + i + " : " + file.filepath);
    	return new Node(toolbox.getFileInfo(file.filepath), i);
    });

    // Iterate over each node and check if other node is within distance
    for(let node1 = 0; node1 < nodes.length; node1++){
    	l(`At node ${node1}`);

    	for(let node2 = node1 + 1; node2 < nodes.length; node2++){
    		let n1 = nodes[node1];
    		let n2 = nodes[node2];

    		let distance = distanceBetweenRGBs(n1.rgb, n2.rgb);
    		if(distance < thresh){
    			l(`    Added connection from ${n1.file.filename_original} to ${n2.file.filename_original}`)
    			n1.addConnection(n2);
    			n2.addConnection(n1);
    		}
    	}
    }

    // Create clusters
    l("\n\nCreating clusters...");	
    // Reset each node to not visited
    let clusters = [];
    
    _.each(nodes, node => {
    	if(node.visited || !node.connections.length)
    		return

    	l("At node " + node.id + " : Connections : " + node.connections.length);

    	// let currentCluster = [];

    	scourNode = node => {
    		l(`  [scourNode ${node.id}] Scouring node ${node.id}`)
    		node.visited = true;
    		let c = [];
    		_.each(node.connections, conn => {
    			if(conn.visited)
    				return;
    			
    			conn.visited = true;
    			
    			l(`    [scourNode ${node.id}] Added node ${conn.id}`);
    			c.push(conn);
    			
    			c = _.concat(c, scourNode(conn));
    		})

    		return c;
    	}

    	let newCluster = _.concat([node], scourNode(node));
    	if(newCluster.length > 3){
    		clusters.push(newCluster);
    	}

    })

    l('Number of clusters : ' + clusters.length);
    _.each(clusters, cluster => {
    	l(`    ${cluster.length}`);
    })


    let outputdir = p.resolve("/home/emiel/Desktop/hugeassclusters");
    _.each(clusters, (cluster, i) => {
    	let dirname = "cluster_" + cluster.length + "_" + i;
    	let dirpath = p.join(outputdir, dirname);
    	if(!fs.ensureDirSync(dirpath)){
    		return l(`Error while creating ${dirpath}`);
    	}

    	_.each(cluster, node => {
    		let filepathNew = p.join(dirpath, node.file.filename);
    		fs.ensureSymlinkSync(node.file.filepath, filepathNew);
    	})
    });

    l('Clusters written');
}