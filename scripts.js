var app = angular.module('PubApp', ['ngCookies']);

app.filter('filterBy', function() {
  return function(list, property) {
    return _.filter(list, property);
  };
});

app.filter('sortBy', function() {
  return function(list, property) {
    return _.sortBy(list, property);
  };
});

app.filter('ago', function($interval) {
  var now = moment();
  $interval(function() {
    now = moment();
  }, 1000);

  var ONE_SECOND = 1000,
      TEN_SECONDS = 10 * ONE_SECOND,
      ONE_MINUTE = 60 * ONE_SECOND,
      ONE_HOUR = 60 * ONE_MINUTE,
      FIVE_HOURS = 5 * ONE_HOUR;

  var fn = function(timestamp) {
    timestamp = moment(timestamp);

    var ago = now.diff(timestamp);
    if ( ago < ONE_MINUTE ) {
      return 'a moment ago'
    } else if ( ago > FIVE_HOURS ) {
      return timestamp.format('llll');
    } else if ( ago > ONE_HOUR ) {
      return timestamp.format('LT');
    } else {
      return timestamp.fromNow();
    }
  };

  fn.$stateful = true;

  return fn;
});

app.directive('stickyBottom', function($interval) {
  return {
    restrict: 'A',
    scope: {
      stickyBottom: '='
    },
    link: function(scope, element, attrs) {
      var sticky = true,
          timer;

      element.on('scroll', function(e) {
        sticky = element[0].scrollTop >= element[0].scrollHeight - element[0].offsetHeight;
      });

      function scroll() {
        if ( sticky ) {
          element[0].scrollTop = element[0].scrollHeight - element[0].offsetHeight;
        }
      }

      timer = $interval(scroll, 100);

      scope.$watchCollection('stickyBottom', function(newValue) {
        if ( newValue ) {
          element[0].scrollTop = element[0].scrollHeight;
        }
      });

      element.on('$destroy', function() {
        $interval.cancel(timer);
      });
    }
  };
});

app.factory('socket', function($rootScope) {
  var socket = io();
  return {
    on: function(event, callback) {
      socket.on(event, function() {
        var args = arguments;
        $rootScope.$apply(function() {
          callback.apply(socket, args);
        });
      });
    },
    emit: function(event, data, callback) {
      socket.emit(event, data, function() {
        var args = arguments;
        $rootScope.$apply(function() {
          if ( callback ) {
            callback.apply(socket, args);
          }
        });
      });
    }
  };
});

app.controller('PubCtrl', function($scope, $timeout, socket, $cookies) {
  $scope.user = {};
  $scope.user.name = $cookies.get('name');
  $scope.messages = [];

  $scope.send = function() {
    var message = $scope.message;
    $scope.message = '';
    if ( message.indexOf('/name') == 0 ) {
      var name = message.substring(6);
      $cookies.put('name', name);
      socket.emit('update', name);
    } else {
      socket.emit('say', message);
      addMessage('say', $scope.user, message);
    }
  };

  var timestamp_check;
  var last_timestamp = Date.now();
  function add_timestamp() {
    var messages = $scope.messages;
    last_timestamp = Date.now();
    messages.push({
      timestamp: messages[messages.length - 1].timestamp,
      type: 'timestamp'
    });
  }
  function check_timestamp() {
    var messages = $scope.messages;
    if ( timestamp_check ) {
      $timeout.cancel(timestamp_check);
    }
    if ( !messages[messages.length-1].extras && moment().diff(last_timestamp) > 300000 ) {
      add_timestamp();
    } else {
      timestamp_check = $timeout(add_timestamp, 10000);
    }
  }

  var MESSAGE_EXTRA_TYPES = [ 'say' ];
  function addMessage(type, user_id, text) {
    var messages = $scope.messages,
        last_message = messages[messages.length - 1],
        timestamp = Date.now(),
        user;
    if ( user_id ) {
      user = typeof user_id === 'object' ? user_id : _.find($scope.users, { id: user_id });
    }
    if ( MESSAGE_EXTRA_TYPES.indexOf(type) != -1 && last_message.type === type && last_message.user === user ) {
      last_message.extras = last_message.extras || [];
      last_message.extras.push(text);
      last_message.timestamp = timestamp;
    } else {
      messages.push({
        timestamp: timestamp,
        type: type,
        user: user,
        text: text
      });
    }
    check_timestamp();
  }

  socket.on('connect', function() {
    socket.emit('hello', $scope.user);
  });

  socket.on('init', function(id, users) {
    var user = _.find(users, { id: id });
    socket.user = user;
    $scope.user = user;
    $scope.users = users;
    _.each($scope.users, function(user) {
      user.connected = true;
    });
    addMessage('hello', user);
  });

  socket.on('hello', function(user) {
    user.connected = true;
    $scope.users.push(user);
    addMessage('hello', user);
  });

  socket.on('goodbye', function(user_id) {
    var user = _.find($scope.users, { id: user_id });
    if ( user ) {
      user.connected = false;
    }
  });

  socket.on('say', function(user_id, text) {
    addMessage('say', user_id, text);
  });

  socket.on('update', function(data) {
    var user = _.find($scope.users, { id: data.id });
    if ( user ) {
      user.name = data.name;
    }
  });

  socket.on('disconnect', function() {
    //location.reload();
    $scope.users = [];
    addMessage('disconnect');
  });
});

document.body.style.display = "block";
