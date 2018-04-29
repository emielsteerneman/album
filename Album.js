const fs = require('fs-extra');
const hashFile = require('hash-file');
const crypto = require('crypto');
const mongoose = require('mongoose');
const model = require('./Model');
const p = require('path');
const toolbox = require('./toolbox');
const Promise = require("bluebird");
const _ = require('lodash');

let getL = name => (...args) => console.log(`[Album]` + (name ? `[${name}]` : ''), ...args);
let l = getL();

class Album {

    constructor({
        dir,
        config
    }){
        l("New album : " + dir);
        this.dir = dir;
        this.config = config;

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
        return new Promise((resolve, reject) => {

            let rand = Math.floor(Math.random() * 10000);
            let l = getL(rand);

            l("Adding file ..." + filepath.slice(-40));

            // Get info of file
            let info = toolbox.getFileInfo(filepath);

            // Check if file is large enough
            if(info.filestat.size < this.config.minSize){
                l("File is too small : " + info.filestat.size);
                return reject("File too small : " + info.filestat.size);
            }

            // Check if file is small enough
            if(this.config.maxSize < info.filestat.size){
                l("File is too large : " + info.filestat.size);
                return reject("File too large : " + info.filestat.size);
            }

            // Check if file already in album
            model.MediaItem.findOne({id: info.id}, (err, item) => {
                // If error
                if (err) {
                    l("Error while searching for id " + info.id + " : " + err);
                    return reject(err);
                }
                // If file already in album
                if (item) {
                    l("Item already in database");
                    return resolve(item);
                }

                l("Item not yet in database");
                l("Copying..");
                let filepathNew = p.join(this.dir, info.relativeDir, info.filename);
                fs.copy(filepath, filepathNew, err => {
                    if (err) {
                        l("Error while copying file to " + filepathNew);
                        l(err);
                        return reject(err);
                    }

                    l("Saving..");
                    info.source = filepath;
                    let itemNew = new model.MediaItem({
                        id : info.id,
                        filename : info.filename,
                        relativeDir : info.relativeDir,
                        source : filepath
                    });
                    itemNew.save(err => {
                        if (err) {
                            l("Error while saving " + info.filename + " : " + err);
                            return reject(err);
                        } else {
                            l("Item added", info.filename);
                            return resolve(itemNew);
                        }
                    });
                });
            });
        })
    }// addFile

    treeFiles(){
        let tree = {};

        toolbox.traverse({
            path : this.dir,
            onFile : function({relativeDir, filename}){
                tree[relativeDir] = tree[relativeDir] ? tree[relativeDir] : [];
                tree[relativeDir].push(filename);
            }
        });

        return tree;
    }

    treeDatabase(){
        return new Promise((resolve, reject) => {
            let tree = {};
            model.MediaItem.find({}, (err,items) => {
                if(err)
                    return reject(err);

                _.each(items, item => {
                    tree[item.relativeDir] = tree[item.relativeDir] ? tree[item.relativeDir] : [];
                    tree[item.relativeDir].push(item.filename)
                });
                return resolve(tree);
            })
        })
    }// treeDatabase

    treeDirDatabase(){
        return new Promise((resolve, reject) => {
            let tree = {};
            model.MediaItem.find({}, (err,items) => {
                if(err)
                    return reject(err);

                _.each(items, item => {
                    tree[item.relativeDir] = tree[item.relativeDir] ? tree[item.relativeDir] : 0;
                    tree[item.relativeDir]++;
                });
                return resolve(tree);
            })
        })
    }


}

module.exports = Album;