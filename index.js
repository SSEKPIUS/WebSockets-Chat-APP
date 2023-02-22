require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
var moment = require('moment');
moment().format(); 

var { find, startsWith } =  require('lodash');
const axios = require('axios');
const log = require('./modules/logger');
const WebSocket = require('ws');
const authenticated_clients = new Map();
const clients = new Map();
const messages = new Map();

// test run 
const messagestmp = [
  { id: uuidv4(), from: 1, to: 5, message: 'Elitr et et rebum et tempor nonumy nonumy sed aliquyam. Et magna vero stet clita clita aliquyam lorem, stet eirmod.', deleted: false, read: true, date_sent: '2023-01-18 08:14:03' },
  { id: uuidv4(), from: 5, to: 1, message: 'Parasites to lay a there power the thou massy nor,.message 2', deleted: false, read: false, date_sent: '2023-01-18 08:18:03' },
  { id: uuidv4(), from: 1, to: 7, message: 'Choient noyé et yeux des.message 3', deleted: false, read: true, date_sent: '2023-01-18 08:20:03' },
  { id: uuidv4(), from: 7, to: 1, message: 'Labore amet dolor clita accusam dolores nonumy. Sed amet sed takimata ut at. Dolor lorem diam vero stet magna eos.message 6', deleted: false, read: true, date_sent: '2023-01-18 08:24:03' },
  { id: uuidv4(), from: 1, to: 7, message: 'Justo diam invidunt sit vero clita stet stet consetetur. Amet et.message 7', deleted: false, read: false, date_sent: '2023-01-18 09:20:03' },
  { id: uuidv4(), from: 7, to: 1, message: 'Amet labore nonumy lorem aliquyam dolores amet, gubergren.message 7', deleted: false, read: false, date_sent: '2023-01-19 08:14:03' },
  { id: uuidv4(), from: 2, to: 1, message: 'Schatten einst dunst  zu lispelnd der in lied mir mit, euch mein die ergreift vom, sich macht wirklichkeiten vom.Amet labore nonumy lorem aliquyam dolores amet, gubergren.message 7', deleted: false, read: false, date_sent: '2023-01-19 08:14:03' },
  { id: uuidv4(), from: 3, to: 1, message: 'Amet labore nonumy lorem aliquyam dolores amet, gubergren.message 6Aliquyam et tempor et ut lorem.', deleted: false, read: false, date_sent: '2023-01-19 08:14:03' },
  { id: uuidv4(), from: 6, to: 1, message: 'Amet labore nonumy lorem aliquyam dolores amet, gubergren.message 6Magna dolor diam at et lorem. Et.', deleted: false, read: false, date_sent: '2023-01-19 08:14:03' },
  { id: uuidv4(), from: 6, to: 3, message: 'Justo diam aliquyam vero takimata justo et sed sed amet. Lorem et consetetur amet.Amet labore nonumy lorem aliquyam dolores amet, gubergren.message 6Magna dolor diam at et lorem. Et.', deleted: false, read: false, date_sent: '2023-01-19 08:14:03' },
  { id: uuidv4(), from: 3, to: 6, message: 'Amet labore nonumy lorem aliquyam dolores amet, gubergren.message 6Magna dolor diam at et lorem. Et.Sanctus ut takimata aliquyam sit dolor est lorem.', deleted: false, read: false, date_sent: '2023-01-19 08:14:03' }
]
messages.set('0', messagestmp); // use institute: institution.registration_no
//  test run

async function checkToken (token) {
  const url = process.env.SP5 || 'http://192.168.1.15:8084';
  const config = {
    headers: {
      'Accept': 'application/json, text/plain, */*',
      'Accept-Encoding': 'gzip, deflate',
      'Authorization': decodeURI(token) 
    }
  };
  const request = await axios.get(`${url}/api/auth/me`, config)
  .then(function ({data}) {
    const {id, name, email, phone, institution } = data.data;
    const metadata = { id, name, email, phone, institute: institution.registration_no };
    authenticated_clients.set(id, metadata);
    return true;
  })
  .catch(function (error) {
    log('Error', error);
    return false
  }); 
  return request;
}
async function authenticate (req) {
  const authtokenObj = req.headers.cookie.split(';');
  const result = find(authtokenObj,n => startsWith(n.trim(),'auth._token'));
  if(result){
    const token = result.split('=')[1].trim();
    if (await checkToken(token)){ return true; }
  }
  return false;
}
const server = new WebSocket.Server({
    port: process.env.PORT || 7071, // The port number the server should listen on. This is a required property.
    host: process.env.HOST || 'localhost', // The hostname the server should listen on. || will listen on all available network interfaces.
    verifyClient: async function ({req}, done) { // Verify client here, for example, return true if the connection is allowed, or false if the connection should be rejected.
      if (req.method !== 'GET')  return done(false, 401, 'Unauthorized, use GET method');
      if (!req.headers.cookie)  return done(false, 401, 'Unauthorized, auth required');
      const result = await authenticate(req)
      .then(
        resolved => resolved,
        rejected => rejected,
      );
      if(result)  done(true, 'you are welcome'); else done(false);
    },
});

server.on('connection', (client) =>{
  clients.set(client, null);
  client.on('message', (reqdata, isBinary) => {
    try {
      const message = isBinary ? reqdata : reqdata.toString();
      //
      console.log('messageAsString:',message)
      //
      const {id, command, data } = JSON.parse(message);
      if (id && authenticated_clients.has(id)) {
        const metadata = authenticated_clients.get(id); 
        if (command) {
          switch (command) {
            case '001': // request chats ie { id: 1, command: '001' }
              clients.set(client, id); // update client id
              const messageBlock =  messages.get(metadata.institute);
              const filtered = messageBlock.filter(block => block.from === id || block.to === id)
              client.send(JSON.stringify({command, response: filtered}));
              break
            case '002': // recieve message ie {to: 5, message: 'example message'} => { id: uuidv4(), from: 1, to: 5, message: 'example message', deleted: false, read: true, date_sent: '2023-01-18 08:14:03' }
               const {to, message} = data  
               const meta = {id: uuidv4(), from: id, to, message, deleted: false, read: false, date_sent: moment().format('YYYY-MM-D HH:MM:ss')}
              
               // filter clients where id = from and to, filter coresoponding messsages
               messages.set('0', [...messages.get('0'), meta])

               //
               console.log('recieve message:',meta)
               //
               client.send(JSON.stringify({command, response: messages.get('0')}));
              break
            default:
              break
          }
        }
      }
    } catch (error) {
      console.log(error);
    }
  });  

  client.on('close', (e) => {
    console.log(e);
    if (clients.has(client)) clients.delete(client);
  });
});

console.log("wss up");