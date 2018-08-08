l = console.log;

const KB = 1000;
const MB = 1000 * KB;
const GB = 1000 * MB;

const express   = require('express');
const p         = require('path');
const app       = express();
const http      = require('http').Server(app);
const bodyParser= require('body-parser');

const os        = require("os");
const fs        = require('fs-extra');
const _         = require('lodash');
const moment    = require('moment');
const readLine  = require('readline-sync').question;
const crypto    = require('crypto');
const Promise   = require("bluebird");
const ExifImage = require('exif').ExifImage;
// const readline = require('readline');
const {google}  = require('googleapis');
const io        = require('socket.io')(http);

let toolbox     = require('./toolbox');
let misc        = require('./misc');
const Album     = require("./Album");
const UUIDTree  = require("./UUIDTree");
const model     = require('./Model');

const albumPath = "/home/emiel/Desktop/hugeasscalendar2/";

// Load config
configFile = './config.json';
config = require(configFile);


// model.MediaItem.remove({}, () => l("Items removed")); return;
// model.MediaItem.find((err, items) => l("Items : " + items.length));

// Init album
let album = new Album({
    dir : albumPath,
    config
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

app.use('/album', express.static(albumPath));
app.use('/', express.static(p.join(__dirname, 'public')));

app.use('/get/:year/:month/:day', function(req, res, next){
    album.getYMD(req.params.year, req.params.month, req.params.day).then(items => {
        res.send(items);
    }).catch(err => {
        l(err);
        res.send(null);
    })
});

app.use('/get/unknown', function(req, res, next){
    album.getByRelativeDir('unknown').then(items => {
        res.send(items)
    }).catch(err => {
        l(err);
        res.send(null);
    })
})



let TREE = {};

io.on('connection', function(client){
	l("New SocketIO connection");
    client.emit('tree', TREE);
});









// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
const TOKEN_PATH = 'token.json';

// Load client secrets from a local file.
fs.readFile('credentials.json', (err, content) => {
  if (err) return console.log('Error loading client secret file:', err);
  // Authorize a client with credentials, then call the Google Calendar API.
  authorize(JSON.parse(content), listEvents);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getAccessToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getAccessToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  // const rl = readline.createInterface({
  //   input: process.stdin,
  //   output: process.stdout,
  // });
  // rl.question('Enter the code from that page here: ', (code) => {
    // rl.close();
    const code = "4/NAD_m1Qdn64xtFa1PFQTF-qYx4G3hWV-_PgWieetVvbxjM8FRo3IpW0";
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  // });
}

/**
 * Lists the next 10 events on the user's primary calendar.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listEvents(auth) {
  // console.log((new Date()).toISOString());
  // return;

  const calendar = google.calendar({version: 'v3', auth});
  calendar.events.list({
    calendarId: 'primary',
    // timeMin: (new Date()).toISOString(),
    timeMin: moment("2016 01 01", "YYYY MM DD").toDate().toISOString(),
    maxResults: 1000,
    singleEvents: true,
    orderBy: 'startTime',
  }, (err, res) => {
    if (err) return console.log('The API returned an error: ' + err);
    const events = res.data.items;
    if (events.length) {
      console.log('Upcoming 10 events:');
      events.map((event, i) => {
        const start = event.start.dateTime || event.start.date;
        console.log(`${start} - ${event.summary}`);
      });
    } else {
      console.log('No upcoming events found.');
    }
  });
}










album.treeDirDatabase().then(tree => {
    TREE = tree;

    http.listen(3000, function(){
        console.log("Server listening");
    });

}).catch(err => {
    l('Error! : ' + err)
});



