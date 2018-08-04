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
	distanceBetweenHashes
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
	let arr1 = hashToRgb(hash1);
	let arr2 = hashToRgb(hash2);

	let distance = 0;

	// Assumes both arrays have the same length
	let len = arr1.length
	
	for(i = 0; i < len; i++){
		distance += Math.abs( (arr1[i]>>4) -  (arr2[i]>>4));
	}

	return distance;
}