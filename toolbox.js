let l = console.log

const fs = require('fs-extra');
const p = require('path');
const _  = require('lodash');
const moment = require('moment');
const question = require('readline-sync').question;
const hashFile = require('hash-file');
const jsonfile = require('jsonfile');

let winston = require('winston');
winston.add(winston.transports.File, { filename: 'log.txt', timestamp : false, json : false });
winston.level = 'debug';

const KB = 1000;
const MB = 1000 * KB;
const GB = 1000 * MB;

module.exports = {
	  traverse
	, listFiles
	, getFilesInDir
	, getDateFromFilepath
	, detectAndDeleteDoubleFiles
	, scanExtensions
	, mergeFileIntoAlbum
	, mergeFolder
	, getUUID_full
	, getUUID
	, copyFilesWithRightExtensions
	, getFileInfo
};

let momentToDir = m => m.format('YYYY/MM/DD');

function traverse({
	  path
	, depth = 0
	, onEnterDir = () => {}
	, onFile = () => {}
	, maxDepth = -1
	, shouldCheckExtension = true
	, relativePath = ""
	, config
}){
	if(!path)
		throw Error("No path given to traverse!");
	
	if(depth === maxDepth)
		return;

	// Get all files in directory
	let filesInDir = fs.readdirSync(path);
	
	// For each file in directory
	for(let iFile = 0; iFile < filesInDir.length; iFile++){

		// Get filename
		let filename = filesInDir[iFile];
		// Get filepath
		let filepath = p.join(path, filename);
		// Get file stats
		let filestat = fs.statSync(filepath);

		// === If directory
		if(filestat.isDirectory()){
			
			let shouldBreak = onEnterDir({
				  path : filepath
				, relativeDir : p.join(relativePath, filename)
				, depth
				, dir : filename
			})

			if(shouldBreak)
				break;

			traverse({
				  path : filepath
				, relativePath : p.join(relativePath, filename)
				, depth : depth + 1
                , onEnterDir
                , onFile
				, maxDepth
				, shouldCheckExtension

                , dir : filename
                , filepath
			});
			continue;
		}

		// === If file
		// check if file is allowed
		if(shouldCheckExtension && !checkExtension({filename}))
			continue;

		let shouldBreak = onFile({
			  path
			, relativeDir : relativePath
			, depth
			, filename
			, filepath
			, filestat
		});

		if(shouldBreak)
			break;

	}
};

function getFilesInDir({
	  dir
	, minSize = 0
	, maxSize = Number.MAX_SAFE_INTEGER
	, maxFiles= Number.MAX_SAFE_INTEGER
}){

	let files = [];

	let nTooSmall = 0;
	let tooSmallSize = 0;
	let nTooLarge = 0;
	let tooLargeSize = 0;
	let totalSize = 0;

	traverse({
		path: dir,
		onFile : function(file){
			
			if(maxFiles <= files.length)
				return true;

			let size = file.filestat.size;
			if(minSize <= size && size <= maxSize){
				files.push(file);
				totalSize += size;
				if(files.length && files.length % 2000 == 0)
					l(`[getFilesInDir] ${files.length} files..`);
			}else 
			if(maxSize < size){
				// Too large
				nTooLarge++;
				tooLargeSize += size;
			}else 
			if(size < minSize){
				// Too small
				nTooSmall++;
				tooSmallSize += size;
			}
		}
	})
	l(`[getFilesInDir] ${files.length} filed found (${(totalSize/GB).toFixed(2)}GB). ${nTooSmall} too small (${(tooSmallSize/GB).toFixed(2)}GB), ${nTooLarge} too large (${(tooLargeSize/GB).toFixed(2)}GB)\n`);

	return files;
}

function listFiles({
	  basepath
	, maxDepth = -1
	, printFiles = true
}){
	// let l = (str) => winston.info('[listFiles] ' + str)

	let nDirs = 0	
	let nFiles = 0

	let onEnterDir = ({path, depth, dir}) => {
		let indent = '| '.repeat(depth)
		l(indent + dir)
		
		nDirs++
	}

	let onFile = ({path, depth, filename, filestat}) => {
		if(printFiles){
			let indent = '| '.repeat(depth-1)
			l(indent +'|-' + filename + ' ' + Math.round((filestat.size/1000)))
			// l(filestat)
		}

		nFiles++
	}

	traverse({
		  path : basepath
		, onEnterDir
		, onFile
		, maxDepth
	})

	l()
	l('nDirs : ' + nDirs)
	l('nFiles: ' + nFiles)
};


function detectAndDeleteDoubleFiles({
	  basepath
}){
	let l = (str) => winston.info('[DoubleFiles] ' + str)

	let duplicatePath = '/media/emiel/External2TB/duplicates'

	let nDirs = 0	
	let nFiles = 0

	let fileSizes = {}

	let onEnterDir = ({path, depth, dir}) => {
		let indent = '| '.repeat(depth)
		nDirs++
	}

	let onFile = ({path, depth, filename, filepath, filestat}) => {
		let indent = '| '.repeat(depth-1)
		
		let filesize = filestat.size
		
		if(!fileSizes[filesize])
			fileSizes[filesize] = []

		fileSizes[filesize].push(filepath)

		nFiles++
	}

	l('Retrieving file sizes..')

	traverse({
		  path : basepath
		, onEnterDir
		, onFile
	})

	l('nDirs : ' + nDirs)
	l('nFiles: ' + nFiles)
	l('nSizes: ' + Object.keys(fileSizes).length)

	let totalDuplicates = 0
	l('comparing files..')
	
	_.each(fileSizes, (arr, i) => {
		// If the are multiple files with the same size
		if(arr.length > 1){
			// Create object to hold hashes->filepaths
			let hashes = {}

			// For each file with the same size
			_.each(arr, filepath => {
				// Calculate hash
				let hash = hashFile.sync(filepath)
				if(!hashes[hash])
					hashes[hash] = []
				// Store hash
				hashes[hash].push(filepath)
			}) 

			// For each hash
			_.each(hashes, (arr, hash) => {
				// If multiple files with the same size have the same hash
				if(arr.length > 1){
					// Create dir with hash
					let dirNew = p.join(duplicatePath, hash)
					fs.ensureDirSync(dirNew)

					// Move each file except original to dir
					let original = arr.shift()
					_.each(arr, filepath => {
						let filepathNew = p.join(dirNew, p.basename(filepath))
						fs.renameSync(filepath, filepathNew)
						totalDuplicates++
					})
				}
			})
		}
	})

	l('nDuplicates: ' + totalDuplicates)
};

function scanExtensions({basepath}){
	l("=== scanExtensions ===");
	// Load config
	let configFile = './config.json';
	let config = require(configFile);

	let onFile = ({path, depth, filename, filepath}) => {
		let ext = p.extname(filename);

		l(filepath, ext)

		checkExtension({filename})
	}

	traverse({
		  path : basepath
		, onFile
	})
}

function getFileInfo(filepath){
	// Get filename
	let filename = p.basename(filepath);
	// Get filestat
	let filestat = fs.statSync(filepath);
	// Get ID
	let id = getIdFromFilepathWithStream({filepath, filestat});
	// Get date
	let fileDate = getDateFromFilepath({filename, filepath, filestat});
	// Get relative dir
	let relativeDir = fileDate ? momentToDir(fileDate) : 'unknown';

	return {
		id,
		filename,
		relativeDir,
		filestat
	}
}

function mergeFileIntoAlbum({filename, filepath}){
	// let l = (...args) => winston.info('[mergeFileIntoAlbum] ' + args.join(' '));
	// let l = (...args) => console.log(["[mFIA]", ...args].join(" "));
	let l = () => {}

	l('filename: ' + filename + ' , filepath: ' + filepath);

	// Check if file already in index
	let fileId = getIdFromFilepath({filepath});

	// Get date of file
	let fileDate;
	try{
		fileDate = getDateFromFilepath({filename, filepath})
	}catch(e){
		console.log(e.message);
		return
	}

	let dir = fileDate ? momentToDir(fileDate) : 'unknown';
	// Create dir
	try{fs.ensureDirSync(p.join(albumPath, dir))}catch(e){if(e.code !== 'EEXIST')throw(e)}
	// Create filepath
	let filepathNew = p.join(albumPath, dir, filename);
	// Increment filepath if needed
	while(fs.existsSync(filepathNew)){
		filename = '_' + filename;
		filepathNew = p.join(albumPath, dir, filename);
	}
		
	// move file
	fs.copySync(filepath, filepathNew);
	l("file merged: " + filepathNew);

	// add to index
	let info = {
          id : fileId
        , relativeDir : dir
		, source : filepath.slice(albumPath.length)
		, filename
		, deleted : false
		, favourited : false
	};

    index[fileId] = info;
		
	return info;
}

function mergeFolder({folderpath}){
	l('Merging files')
	l(folderpath)
	traverse({
		  path : folderpath
		, onFile : mergeFileIntoAlbum
	})
	
	jsonfile.writeFileSync(indexFile, index)
}

function checkExtension({filename}){
	let ext = p.extname(filename);

	// If extension already denied
	if(config.extensionsDenied.indexOf(ext) > -1){
		return false;
	}
	// If extension is already allowed
	if(config.extensionsAllowed.indexOf(ext) > -1){
		return true;
	}

	l('\n' + filename);
	let input = question("Allow the extension " + ext + " ? (y/n)");
	let isAllowed

	if(input === 'y'){
		config.extensionsAllowed.push(ext);
		isAllowed = true;
	}else
	if(input === 'n'){
		config.extensionsDenied.push(ext);
		isAllowed = false;
	}else{
		return false;
	}

	jsonfile.writeFileSync(configFile, config, {spaces: 2});
	return isAllowed;
}

function getUUID_full({filepath, filestat}){
	return hashFile.sync(filepath);
}


// function getIdFromFilepathWithStream({filepath, filestat}){
// 	const bytesToRead = 100 * KB;	

// 	let fd = fs.openSync(filepath, 'r');

// 	let buffer = Buffer.alloc(bytesToRead);
// 	let bytesRead = fs.readSync(fd, buffer, 0, bytesToRead, 0);
// 	fs.closeSync(fd);

// 	let hash = hashFile.sync(buffer.slice(0, bytesRead));

// 	return hash;
// }


function getUUID({filepath, filestat}){

	if(!filestat){
		filestat = fs.statSync(filepath);
	}

	// Number of chunks to be read
	const nChunks = 97;
	// Size of a chunk in bytes
	const chunkSize = 20;

	const bytesToRead = nChunks * chunkSize;

	// // Total bytes to be read from the file
	// const bytesToRead = 1.69 * 10 * KB;	
	// // Bytes to be read per piece
	// const batchSize = bytesToRead/13;

	// // Number of pieces to read
	// let steps = bytesToRead/batchSize;
	// // Distance between pieces
	// let step = 1;
	
	let stepSize = 0;
	if(bytesToRead < filestat.size){
		stepSize = Math.floor(filestat.size / nChunks);
	}

	// Open the file
	let fd = fs.openSync(filepath, 'r');
	// Allocate a buffer for the bytes that are going to be read
	let buffer = Buffer.alloc(bytesToRead);
	// Track the number of bytes read
	let bytesRead = 0;

	// If there is no distance between the chunks, read all the bytes at once
	if(stepSize == 0){
		bytesRead = fs.readSync(fd, buffer, 0, bytesToRead, 0);
	}else{
		// Read each chunk
		for(let i = 0; i < nChunks; i++){
			const locationInBuffer = i * chunkSize;
			const locationInFile = i * stepSize;
			bytesRead += fs.readSync(fd, buffer, locationInBuffer, chunkSize, locationInFile);
		}
	}
	// Close the file
	fs.closeSync(fd);

	// Calculate the hash
	let hash = hashFile.sync(buffer.slice(0, bytesRead));
	return hash;	
}


function getDateFromFilepath({filename, filepath, filestat}){

	let dateRegex = {
		  regex : /(?:[^\d]|^)(20[01]\d[01]\d[0-3]\d)(?:[^\d])/	// 20160109
		, f : (matches) => {
			if(!matches) return null;
			return moment(matches[1], 'YYYYMMDD')
		}
	};
	let date2Regex 	= {
		  regex : /(?:[^\d]|^)(20[01]\d-[01]\d-[0-3]\d)[^\d]/	// 2016-01-09
		, f : (matches) => {
			if(!matches) return null;
			return moment(matches[1], 'YYYY-MM-DD');
		}
	};
	let date3Regex = {
		  regex : /(?:[^\d]|^)([0-3]\d-[01]\d-[01]\d)[^\d]/		// 18-02-13
		, f : (matches) => {
			if(!matches) return null;
			return moment(matches[1], 'DD-MM-YY');
		}
	};
	let unixMsRegex = {
		  regex : /(?:[^\d]|^)(1[3456]\d{11})(?:[^\d]|$)/				// 13 numbers
		, f : (matches) => {
			if(!matches) return null;
			return moment.unix(parseInt(matches[1]) / 1000);
		}
	};

	let regexes = [dateRegex, date2Regex, date3Regex, /*unixRegex,*/ unixMsRegex];

	let matches = _.map(regexes, r => r.f(filename.match(r.regex)));
	let matchesFiltered = _.filter(matches, null);

	if(matchesFiltered.length > 1)
		throw new Error("Error! two or more matches : " + filepath);

	if(matchesFiltered.length === 1)
		return matchesFiltered[0];

	if(matchesFiltered.length === 0){

		let exifdate = null;
		let data = fs.readFileSync(filepath);
		try{
			let parser = require('exif-parser').create(data);
			let dto = parser.parse().tags.DateTimeOriginal;
			if(typeof dto === 'number'){
				// dto *= 1000
				// exifdate = fileDate = new Date(dto)
				exifdate = moment.unix(dto);
			}
			return exifdate;
		}catch(e){
			// l('\tERROR ' + e.message)
		}
	}

	if(typeof filestat === "undefined")
		filestat = fs.statSync(filepath)

	if(typeof filestat !== "undefined")
		return moment(filestat.mtime)

}

function copyFilesWithRightExtensions({source, destination}){
	traverse({
		path : source,
		onFile : ({filepath}) => {

			// console.log("copying " + filepath + " to " + p.join(destination, filepath));
            fs.copySync(filepath, p.join(destination, filepath));

			return false;
        },
        onEnterDir : ({path}) => console.log(path) && false,
	})
}