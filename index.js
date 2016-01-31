var _ = require('lodash');
var express = require('express');
var randomid = require('random-token').create('0123456789');

var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var users = [];

app.use('/node_modules', express.static('node_modules'));
app.use('/styles.css', express.static('styles.css'));
app.use('/scripts.js', express.static('scripts.js'));

app.get('/', function(req, res) {
  res.sendFile(__dirname + '/index.html');
});

function log() {
  console.log.apply(console, arguments);
  return arguments[0];
}

function randomname() {
  var names = _.map(users, 'name');
  var name = 'User'+randomid(5);
  while ( names.indexOf(name) != -1 ) {
    name = 'User'+randomid(5);
  }
  return name;
};

io.on('connection', function(socket) {
  log('CONNECTED', socket.id);

  socket.on('disconnect', function() {
    var user = socket.user;
    if ( user ) {
      _.pull(users, user);
      socket.broadcast.emit('goodbye', user.id);
      log('GOODBYE', user.id);
    }
    log('DISCONNECTED', socket.id);
  });

  socket.on('hello', function(data) {
    var user = {};
    data = data || {};

    user.id = socket.id;
    user.name = data.name || randomname();
    users.push(user);

    socket.user = user;

    socket.broadcast.emit('hello', user);
    socket.emit('init', user.id, users);

    log('HELLO', user);
  });

  socket.on('update', function(name) {
    socket.user.name = name || randomname();
    io.emit('update', socket.user);
    log('UPDATE', socket.user);
  });

  socket.on('say', function(text) {
    var user = socket.user;
    log('SAY', user.id, text);
    socket.broadcast.emit('say', user.id, text);
  });
});

http.listen(8080, function() {
  log('listening on *:8080');
});
