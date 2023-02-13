require('dotenv').config();
var { find, startsWith } =  require('lodash');
const axios = require('axios');
const log = require('./modules/logger');
const WebSocket = require('ws');
const authenticated_clients = new Map();
const clients = new Map();

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
    const metadata = { id, name, email, phone, institute: institution.name, messages: {} };
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
  const result = find(authtokenObj,(n) => { return startsWith(n.trim(),'auth._token'); });
  if(result){
    const token = result.split('=')[1].trim();
    if (await checkToken(token)){
      return true;
    }
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
        (resolved)=>{ 
          return resolved;
         },
        (rejected)=>{
          return rejected;
        },
      );
      if(result)  done(true, 'you are welcome'); else done(false);
    },
});

server.on('connection', (newclient) =>{
  //
  console.log('authenticated_clients:', authenticated_clients.size);
  console.log('clients:', clients.size);
  //
  clients.set(newclient, null);

  newclient.on('message', (reqdata, isBinary) => {
    try {
      const message = isBinary ? reqdata : reqdata.toString();
      console.log('messageAsString:',message)
  
      const {id, command, data } = JSON.parse(message);
      
      // const messageBody = JSON.parse(data);
      // ws.send(JSON.stringify({...messageBody, from: "from server"}));
    } catch (error) {
      console.log(error);
    }
  });  

  newclient.on('close', (con) => {
    console.log("closing connection");
    console.log('has key:', clients.has(newclient));
    if (clients.has(newclient)) clients.delete(newclient);
  });
});

console.log("wss up");