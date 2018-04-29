l = console.log

// ===== Load modules
let os 			= require("os");
let fs 			= require('fs-extra');
let _  			= require('lodash');
let p  			= require('path');
let moment 		= require('moment');
let readLine 	= require('readline-sync').question;
let jsonfile 	= require('jsonfile');
let imageSize 	= require('image-size');
let crypto 		= require('crypto');

let toolbox = require('./toolbox');
let misc = require('./misc');

drive = (os.platform() === "win32") ? process.cwd().split(p.sep)[0] : __dirname.split(p.sep).slice(0, -1).join(p.sep);
// albumPath = p.join(drive, 'album');
albumPath = p.join(drive, 'albumPhoneTest', 'album');

l('\n================================================================\n');
l('drive: ' + drive)
l('albumPath: ' + albumPath);

// Load config
configFile = './config.json';
config = require(configFile);

// Load index
// indexFile = './index.json';
indexFile = p.join(drive, 'albumPhoneTest', 'index.json');

try{
	index = require(indexFile);
	l("Index file loaded")
}catch(e){
	l("Error! No index file");
	process.exit(1);
	// index = toolbox.indexFiles(albumPath)
}
if(typeof index === "undefined")
	throw new Error("No index file!");

// return;

(function(){
	l('Merging files');

	let nIndexed = 0;
	let nUnindexed = 0;

	let kb = 1000;
	let mb = 1000 * kb;
	let gb = 1000 * mb;
	
	let totalsize = 0;
	
	toolbox.traverse({
		  path : albumPath
		, onFile : ({filename, filestat, path, filepath}) => {
			if(filestat.size > 10 * mb){
				totalsize += filestat.size;
				l(path, filename, filestat.size)
				// fs.copySync(filepath, p.join('E:/tooLarge', filename))
			}
		}
		//, onEnterDir
		//, checkExtension : true
	});
	
	l(Math.ceil(totalsize*100 / gb)/100 + ' gb');
	
	jsonfile.writeFileSync(indexFile, index);

});
// return





// l(toolbox.getDateFromFilepath('test.ARW', './test.ARW')); return;
// l(toolbox.getDateFromFilepath('DSC00011.JPG', '/media/emiel/External2TB/todo/100MSDCF/DSC00011.JPG')); return;



// toolbox.listFiles({basepath : customPath})
// toolbox.relocateFiles({basepath : albumPath}); return;
// toolbox.detectAndDeleteDoubleFiles({basepath : albumPath}); return;
// toolbox.scanExtensions({basepath : albumPath})
// toolbox.scanExtensions({basepath : customPath})

// let pathFrom = p.join(drive, 'todo')
let pathFrom = p.join(drive, 'albumPhoneTest', 'media');

l(pathFrom)
l(albumPath)
// return

;(function(){
	l('Merging files');

	let nIndexed = 0;
	let nUnindexed = 0;

	toolbox.traverse({
		  path : pathFrom
		, onFile : toolbox.mergeFileIntoAlbum
		//, onEnterDir
		//, checkExtension : true
	});
	
	jsonfile.writeFileSync(indexFile, index);

})();

return;
