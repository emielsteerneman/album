const fs = require('fs-extra');
const hashFile = require('hash-file');
const crypto = require('crypto');
const mongoose = require('mongoose');
const model = require('./Model');
const p = require('path');
const toolbox = require('./toolbox');

let getL = name => (...args) => console.log(`[Album]` + (name ? `[${name}]` : ''), ...args);
let l = getL();

class Album {

    constructor({
        dir,
    }){
        l("New album : " + dir);
        this.dir = dir;

        this.dbHash = "album_" + crypto.createHash('md5').update(dir).digest("hex");
        l("Database hash : " + this.dbHash);

        l("Creating database connection..");
        let dbPath = "mongodb://localhost/" + this.dbHash;
        mongoose.connect(dbPath);

        l("Ensuring directory..");
        if(!fs.existsSync(this.dir)){
            fs.mkdirSync(this.dir);
            if(!fs.existsSync(this.dir))
                l("Error! Could not create " + this.dir);
        }

        l("Album initialized");
    }

    addFile(filepath){
        let rand = Math.floor(Math.random() * 10000);
        let l = getL(rand);

        l("Adding file .." + filepath.slice(-40));

        // Get info of file
        let info = toolbox.getFileInfo(filepath);

        // Check if file already in album
        model.MediaItem.findOne({id : info.id}, (err, item) => {
            // If error
            if(err){
                l("Error while searching for id " + info.id + " : " + err);
                return;
            }
            // If file already in album
            if(item) {
                l("Item already in database");
                return;
            }

            l("Item not yet in database");
            l("Copying..");
            let filepathNew = p.join(this.dir, info.relativeDir, info.filename);
            fs.copy(filepath, filepathNew, err => {
                if(err){
                    l("Error while copying file to " + filepathNew);
                    l(err);
                    return;
                }

                l("Saving..");
                info.source = filepath;
                let itemNew = new model.MediaItem(info);
                itemNew.save(err => {
                    if(err){
                        l("Error while saving " + info.filename + " : " + err);
                    }else{
                        l("Item added", info.filename);
                    }
                });
            });
        });
    }

}

module.exports = Album;