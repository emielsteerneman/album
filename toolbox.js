let l = console.log

let fs = require('fs-extra');
let p = require('path');
let _  = require('lodash');
let moment = require('moment');
let question = require('readline-sync').question;
let hashFile = require('hash-file');
let jsonfile = require('jsonfile');

let winston = require('winston');
winston.add(winston.transports.File, { filename: 'log.txt', timestamp : false, json : false });
winston.level = 'debug';

module.exports = {
	  traverse
	, listFiles
	, indexFiles
	, relocateFiles
	, getDateFromFilepath
	, detectAndDeleteDoubleFiles
	, scanExtensions
	, mergeFileIntoAlbum
	, mergeFolder
	, getIdFromFilepath
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
}){
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

function indexFiles({basePath}){
	let l = (str) => winston.info('[indexFiles] ' + str)

	l('Indexing all files')

	// Open or create index file
	let index = {}
	if(!fs.existsSync(indexFile)){
		jsonfile.writeFileSync(indexFile, index, {spaces : 4})
	}else{
		index = jsonfile.readFileSync(indexFile)	
	}

	let onFile = ({filename, filepath}) => {
		let fileId = getIdFromFilepath({filepath})

		// If file already indexed
		if(typeof index[fileId] !== "undefined"){
			// l('\tIndexing # ' + filename)
			return
		}

		l('\tIndexing ' + filename)
		index[fileId] = {
			  filepath : filepath.slice(basePath.length)
			, filename
			, deleted : false
			, favourited : false
		}
	}

	let onEnterDir = ({path}) => {
		l(path)
	}

	traverse({
		  path : basePath
		, onFile
		, onEnterDir
	})

	jsonfile.writeFileSync(indexFile, index)
	l('Files indexed')
	return index
}

function relocateFiles({
	  basepath
}){
	l('\n === Relocating files ===')
	l(basepath)

	let onFile = ({filepath, path, depth, filename, filestat}) => {
		// Get filepath
		// let filepath = p.join(path, filename)
		// Get date of file
		let fileDate = getDateFromFilepath({filename, filepath, filestat})
		// Convert date to dir
		let dir = fileDate ? momentToDir(fileDate) : 'unknown'

		fs.ensureDirSync(p.join(basepath, dir))

		let filepathNew = p.join(basepath, dir, filename)
		
		// If file is placed wrong
		if(filepath !== filepathNew){
			// let filepathNew = p.join(basepath, dir ? dir : 'unknown', filename)

			l("\n\t1 : " + filepath + "\n\t2 : " + filepathNew)
			// l(dir.endsWith(path), dir, path)

			// If new location is null
			if(dir == 'unknown'){
				// Check if this is correct
				let input = question("\tMove 1 to 2 ? (y/n)")
				if(input != 'y'){
					l('\tNot relocating')
					return
				}
			}

			fs.renameSync(filepath, filepathNew)
			l("\tRelocated")
		} 
	}
	
	let onEnterDir = ({path}) => l(path)

	traverse({
		  path : basepath
		, onFile
		, onEnterDir
	})
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
	let id = getIdFromFilepath({filepath, filestat});
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

function getIdFromFilepath({filepath, filestat}){
	let hash = hashFile.sync(filepath);

	let f = filestat => hash;

	if(filestat)
		return f(filestat);
	else
		return f(fs.statSync(filepath));
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