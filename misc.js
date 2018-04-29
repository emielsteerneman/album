let p  = require('path')
let fs = require('fs-extra')
let imageSize = require('image-size')
let _  = require('lodash')

let toolbox = require('./toolbox')

module.exports = {
	moveFilesBelowSize
}

function moveFilesBelowSize({filesize = 5000, basepath}){
	l('\n === moveFilesBelowSize ===')

	let rejectedPath = p.join(drive, 'rejected')
	let acceptedPath = p.join(drive, 'accepted')
	
	let maxFileSizes = [['a', 0],['a', 0],['a', 0],['a', 0],['a', 0],['a', 0],['a', 0],['a', 0],['a', 0],['a', 0]]
	
	let i = 0;

	let onFile = ({filepath, path, depth, filename, filestat}) => {
		
		// l(filestat)
		// return true
			
		let _path = acceptedPath

		if(filestat.size > maxFileSizes[0][1]){
			maxFileSizes[0] = [filepath, filestat.size]
			maxFileSizes = _.sortBy(maxFileSizes, x => x[1]);
		}

		if(10*1000*1024 <= filestat.size)
			return

		if(filestat.size < 50000){
			// l(filename)
			// return
			_path = rejectedPath
			l('file too small')
		}

		if(filestat.size > 10000000){ // 10mb
			l('file too large')
			return
		}
		
		let dimensions
		try{
			dimensions = imageSize(filepath)
			if(dimensions.width < 450 || dimensions.height < 450){
				// return
				l('size too small : ' + dimensions.width + ' ' + dimensions.height)
				_path = rejectedPath
			}
		}catch(e){
			l('wrong filetype')
			return
		};
		
		
		
		// l(dimensions)
		// return
		
		// Get filepath
		// let filepath = p.join(path, filename)

		if(_path === acceptedPath)
			return

		let filepathNew = p.join(_path, filename)

		fs.copySync(filepath, filepathNew)
		l("moved : " + filepathNew)

		if(i++ > 1000)
			process.exit()
	}
	
	toolbox.traverse({
		  path : basepath
		, onFile
	})
	
	l(_.map(maxFileSizes, x => x[0] + ' - ' + Math.round(x[1]/(1024*1000))).join('\n'))
	
	
};