// Requires
const mongoose = require('mongoose');
const p = require('path');

const dbName = "album";

let db;
let l = (...args) => console.log("[Model.js]", ...args);

function init(){
    l("init()");
    let dbPath = "mongodb://localhost/" + dbName;
    l("Connecting to " + dbPath);
    mongoose.connect(dbPath);
    db = mongoose.connection;
    db.on('error', dbOnError);
    db.once('open', () => l(dbPath, "opened"))
}

function dbOnError(){
    l("db error");
}

// "210663_97747227560bfd024d4728cd8315192d65d8e595":{"filepath":"s_norway_converted\\DSC01514_20170821.jpg","filename":"DSC01514_20170821.jpg","deleted":false,"favourited":false}

const MediaSchema = mongoose.Schema({
    id : { type : String, unique : true },
    filename : String,
    relativeDir : String,
    source : String,
    deleted : {type : Boolean, default : false},
    favourited : {type : Boolean, default : false},
});



const MediaItem = mongoose.model('MediaItem', MediaSchema);

module.exports = {
    init,
    MediaItem
};