l = console.log;

// ===== Load modules
let os 			= require("os");
let fs 			= require('fs-extra');
let _  			= require('lodash');
let p  			= require('path');
let moment 		= require('moment');
let question 	= require('readline-sync').question;
let jsonfile 	= require('jsonfile');
let imageSize 	= require('image-size');
let crypto 		= require('crypto');


let toolbox = require('./toolbox');
let misc = require('./misc');
let lengthen = (str, len=25) => (str + '                                                                                    ').slice(0, len);


drive = (os.platform() === "win32") ? process.cwd().split(p.sep)[0] : __dirname.split(p.sep).slice(0, -1).join(p.sep);
albumPath = p.join(drive, 'album')

l('\n================================================================\n');
l('drive: ' + drive);
l('albumPath: ' + albumPath);

// Load config
configFile = './config.json';
config = require(configFile);

// Load index
indexFile = './index.json';
try{
	index = require(indexFile);
	l("Index file loaded");
	// fs.writeJsonSync('wer.json', index, {spaces : '\t'})
	// return

}catch(e){
	l("Error! No index file");
	// process.exit(1);
	index = toolbox.indexFiles({basePath : albumPath})
}
if(typeof index === "undefined")
	throw new Error("No index file!");

















function getArgs(fStr){
	let regexStr = /\({([\s\S]*?)}\)/;
	let args = fStr.match(regexStr)[0].replace(/[\r\n\t ]/g, '').slice(2, -2).split(',');
	let fArgs = {};

	_.each(args, arg => {
		arg = arg.split(/=(.+)/);
		fArgs[arg[0]] = eval(arg[1]);
	});
	return fArgs
}

// Map functions
let functions = (_.map(toolbox, (f, fName) => [fName, f, f.toString(), getArgs(f.toString())])).slice(1);
let printFunctions = () => {_.each(functions, ([fName, f, fStr, fArgs], i) => l(`\t ${i} : ${lengthen(fName, 30)}`, fArgs))};

// REPL
while(true){
	// Print functions
	l("\nFunctions:");
	printFunctions();

	// Query function
	let input = question("\nFunction: ");
	
	if(input === 'exit')
		return;

	// Get function	
	let [fName, f, fStr, fArgs] = functions[input];

	// Query arguments
	_.each(fArgs, (val, key) => {
		let i = question(`\t${key} (${val}) : `);
		if(i !== '')
			fArgs[key] = eval(i)
	});

	l(fArgs);

	if(fName !== 'listFiles'){
		l('WATCH OUT!');
		// return
	}

	// Execute function
	l(f(fArgs));

}