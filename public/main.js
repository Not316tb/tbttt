
$(function() {
  var FADE_TIME = 150; // ms
  var TYPING_TIMER_LENGTH = 400; // ms
  var COLORS = [
    '#ff0000', '#ffa500', '#ffff00', '#00ff00',
    '#0000ff', '#4b0082', '#ff00ff', '#ffc0cb',
    '#f0f0f0'];

  // Initialize variables
  var $window = $(window);
  var $usernameInput = $('.usernameInput'); // Input for username
  var $messages = $('.messages'); // Messages area
  var $inputMessage = $('.inputMessage'); // Input message input box

  var $loginPage = $('.login.page'); // The login page
  var $chatPage = $('.chat.page'); // The chatroom page

  var username;
  var connected = false;
  var typing = false;
  var lastTypingTime;
  var totalConnect;
  var totalReady = 0;
  var readyList = [];
  var $currentInput = $usernameInput;

  var socket = io();

  function addParticipantsMessage (data) {
    var message = '';
    totalConnect = data.numUsers
    if (data.numUsers === 1) {
      message += "There's 1 participant";
    } else {
      message += "There are " + data.numUsers + " participants";
    }
    $('#log').html(message)
  }

  function setUsername () {
    username = cleanInput($usernameInput.val().trim());

    if (username) {
      $loginPage.fadeOut();
      $chatPage.show();
      $loginPage.off('click');
      $currentInput = $inputMessage.focus();

      socket.emit('add user', username);
    }
  }

  function sendMessage () {
    var message = $inputMessage.val();
    message = cleanInput(message);
    if (message && connected) {
      $inputMessage.val('');
      addChatMessage({
        username: username,
        message: message
      });

      if (message.startsWith('!')){
          var args = message.substring('!'.length).split(" ");

          switch (args[0].toLowerCase()) {
            case "cleanup":
              socket.emit("output cmd", "cleanup", username)
              addBotMessage("Cleaning...");
              $(".messages").html("");
              $("#log").html("The Server Has Listened...");
              addBotMessage("Just cleaned up chat!");
              break;
            case "ready":
              socket.emit("output cmd", "ready", username)
              if ((totalReady + 1) === Math.floor(totalConnect*(4/5))){
                readyList.push(username)
                totalReady++;
                socket.emit("user ready", username)
                addBotMessage(`You have voted to start the game (${totalReady}/${Math.floor(totalConnect*(4/5))})`)
                socket.emit("start count", `${username} has voted to start the game (${totalReady}/${Math.floor(totalConnect*(4/5))})`)
                break;
              }
              else{
                if (totalConnect < 5){
                  addBotMessage("Please wait for at least [5] users to connect.");
                  break;
                }
                if (readyList.includes(username)){
                  addBotMessage("You already voted to start!")
                  break;
                }
                readyList.push(username)
                totalReady++;
                socket.emit("user ready", username)
                addBotMessage(`You have voted to start the game (${totalReady}/${Math.floor(totalConnect*(4/5))})`)
                socket.emit("new bot message", `${username} has voted to start the game (${totalReady}/${Math.floor(totalConnect*(4/5))})`)
                break;
              }
            case "unready":
              socket.emit("output cmd", "unready", username)
              if (!readyList.includes(username)){
                break;
              }
              readyList.splice(readyList.indexOf(username), 1)
              totalReady--;
              socket.emit("user not ready", username)
              addBotMessage(`You have canceled your vote to start the game (${totalReady}/${Math.floor(totalConnect*(4/5))})`)
              socket.emit("new bot message", `${username} has canceled their vote to start the game (${totalReady}/${Math.floor(totalConnect*(4/5))})`)
              break;

            default:
              socket.emit("output cmd", message, username)
              addBotMessage("Doesn't look like that's a valid command!")
              break;
          }
          log("The Server Has Listened...")

          if (totalConnect === 1){
            setTimeout(function(){
              log(`There's ${totalConnect} participant`)
            }, 3000)
          }
          else{
            setTimeout(function(){
              log(`There are ${totalConnect} participants`)
            }, 3000)
          }
      }
      else{
        socket.emit('new message', message);
      }
    }
  }

  function log (message, options) {
    $("#log").text(message);
  }

  function sleep(milliseconds) {
    var start = new Date().getTime();
    for (var i = 0; i < 1e7; i++) {
      if ((new Date().getTime() - start) > milliseconds){
        break;
      }
    }
  }

  function addChatMessage (data, options) {
    var $typingMessages = getTypingMessages(data);
    options = options || {};
    if ($typingMessages.length !== 0) {
      options.fade = false;
      $typingMessages.remove();
    }

    var $usernameDiv = $('<span class="username"/>')
      .text(`[${data.username}]:`)
      .css('color', getUsernameColor(data.username));
    var $messageBodyDiv = $('<span class="messageBody">')
      .text(data.message);

    var typingClass = data.typing ? 'typing' : '';
    var $messageDiv = $('<li class="message"/>')
      .data('username', data.username)
      .addClass(typingClass)
      .append($usernameDiv, $messageBodyDiv);

    addMessageElement($messageDiv, options);
  }

  function addBotMessage (data, options) {

    var $usernameDiv = $('<span class="username rainbow"/>')
      .text(`[Server]:`)
      .css('color', 'transparent');
    var $messageBodyDiv = $('<span class="messageBody bot">')
      .text(data);

    var $messageDiv = $('<li class="message"/>')
      .data('username', 'Server')
      .append($usernameDiv, $messageBodyDiv);

    addMessageElement($messageDiv, options);
  }

  function addChatTyping (data) {
    data.typing = true;
    data.message = 'is typing';
    addChatMessage(data);
  }

  function removeChatTyping (data) {
    getTypingMessages(data).fadeOut(function () {
      $(this).remove();
    });
  }

  function addMessageElement (el, options) {
    
    var $el = $(el);

    if (!options) {
      options = {};
    }
    if (typeof options.fade === 'undefined') {
      options.fade = true;
    }
    if (typeof options.prepend === 'undefined') {
      options.prepend = false;
    }

    if (options.fade) {
      $el.hide().fadeIn(FADE_TIME);
    }
    if (options.prepend) {
      $messages.prepend($el);
    } else {
      $messages.append($el);
      return;
    }
    $messages[0].scrollTop = $messages[0].scrollHeight;
  }

  function cleanInput (input) {
    return $('<div/>').text(input).html();
  }

  function updateTyping () {
    if (connected) {
      if (!typing) {
        typing = true;
        socket.emit('typing');
      }
      lastTypingTime = (new Date()).getTime();

      setTimeout(function () {
        var typingTimer = (new Date()).getTime();
        var timeDiff = typingTimer - lastTypingTime;
        if (timeDiff >= TYPING_TIMER_LENGTH && typing) {
          socket.emit('stop typing');
          typing = false;
        }
      }, TYPING_TIMER_LENGTH);
    }
  }

  function getTypingMessages (data) {
    return $('.typing.message').filter(function (i) {
      return $(this).data('username') === data.username;
    });
  }

  function getUsernameColor (username) {
    var hash = 7;
    for (var i = 0; i < username.length; i++) {
       hash = username.charCodeAt(i) + (hash << 5) - hash;
    }
    var index = Math.abs(hash % COLORS.length);
    return COLORS[index];
  }

  // Keyboard events

  $window.keydown(function (event) {
    if (!(event.ctrlKey || event.metaKey || event.altKey)) {
      $currentInput.focus();
    }
    if (event.which === 13) {
      if (username) {
        if ($inputMessage.val().startsWith("/")){
          runCommand($inputMessage.val());
          sendMessage();
        } 
        sendMessage();
        socket.emit('stop typing');
        typing = false;
      } else {
        setUsername();
      }
    }
  });

  $inputMessage.on('input', function() {
    updateTyping();
  });

  // Click events

  $loginPage.click(function () {
    $currentInput.focus();
  });

  $inputMessage.click(function () {
    $inputMessage.focus();
  });

  // Socket events

  socket.on('login', function (data) {
    connected = true;
    var message = null;
    log(message);
    addParticipantsMessage(data);
  });

  socket.on('user ready', function(data) {
    readyList.push(data);
    totalReady++;
  })

  socket.on('user not ready', function(data) {
    readyList.splice(readyList.indexOf(data), 1)
    totalReady--;
  })

  socket.on('start count', function(){
    addBotMessage("Initiating Countdown...");
    addBotMessage("Game Starting in [5]");
    //sleep(1000);
    addBotMessage("Game Starting in [4]");
    //sleep(1000);
    addBotMessage("Game Starting in [3]");
    //sleep(1000);
    addBotMessage("Game Starting in [2]");
    //sleep(1000);
    addBotMessage("Game Starting in [1]")
    //sleep(1000);
  })

  socket.on('new message', function (data) {
    addChatMessage(data);
  });

  socket.on('new bot message', function (data) {
    addBotMessage(data);
  });

  socket.on('user joined', function (data) {
    addBotMessage(`${data.username} has joined.`)
    addParticipantsMessage(data);
  });

  socket.on('user left', function (data) {
    addBotMessage(`${data.username} has left.`)
    addParticipantsMessage(data);
  });

  socket.on('typing', function (data) {
    addChatTyping(data);
  });

  socket.on('stop typing', function (data) {
    removeChatTyping(data);
  });

  socket.on('disconnect', function () {
    log('[Server] ' + username + ' Disconnected');
  });

  socket.on('reconnect', function () {
    log('[Server] ' + username + ' Reconnected');
    if (username) {
      socket.emit('add user', username);
    }
  });

  socket.on('reconnect_error', function () {
    log('[Server] Failed to connect to server.');
  });

});