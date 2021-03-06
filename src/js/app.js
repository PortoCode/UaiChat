'use strict';

const USERS_LIST_TOPIC_PREFIX = 'users';
const USERS_LIST_TOPIC = USERS_LIST_TOPIC_PREFIX + '/#';
const CHAT_ROOM_TOPIC = 'chat';

// Endereço MQTT.Cool de destino
const MQTT_COOL_URL = 'http://localhost:8080';

// Broker MQTT padrão para se conectar
const DEFAULT_BROKER_HOST = 'broker.mqtt.cool';
const DEFAULT_BROKER_PORT = '1883';

const USER_STYLE = {
  MY_USER_COLOR: 'loggedUser',
  MY_USER_ICON: 'fas fa-user',
  OTHER_USER_COLOR: 'text-primary',
  OTHER_USER_ICON: 'far fa-user'
};

const MSG_LEVEL_STYLE = {
  INFO: 'text-info',
  WARN: 'text-warning',
  ERROR: 'text-danger',
  SUCCESS: 'text-success'
};

/* Ponto de entrada */
$(function() {
  $('#brokerHost').val(DEFAULT_BROKER_HOST);
  $('#brokerPort').val(DEFAULT_BROKER_PORT);

  $('#sendMessage').on('keypress', function(e) {
    if (e && e.keyCode === 13) {
      $('#replyBtn').click();
    }
  });

  $('#clearMessages').click(function() {
    $('#messages').empty();
  });

  connectToMQTTCool(MQTT_COOL_URL);
});

/**
 * Conecta o servidor MQTT.Cool hospedado na URL fornecida
 */
function connectToMQTTCool(mqttCoolUrl) {
  showMessage(MSG_LEVEL_STYLE.INFO, 'Conectando ao servidor MQTT...');
  mqttcool.openSession(mqttCoolUrl, 'demouser', '', {

    onConnectionFailure: function(errType, errCode, errMessage) {
      onMqttCoolFailure(errType, errCode, errMessage);
    },

    onConnectionSuccess: function(mqttCoolSession) {
      onMqttCoolSuccess(mqttCoolSession);
    }
  });
}

function onMqttCoolFailure(errType, errCode, errMessage) {
  const message = errType + ': ' + (errCode || '') + (errMessage || '');
  showMessage(MSG_LEVEL_STYLE.ERROR, message);
  close();
}

function close() {
  showMessage(MSG_LEVEL_STYLE.INFO, 'Saiu');
  disableDisconnection();
  disableUserMessage();
  enableLogin();
}

function onMqttCoolSuccess(mqttCoolSession) {
  showMessage(MSG_LEVEL_STYLE.SUCCESS, 'Conectado ao servidor MQTT');
  enableLogin();
  $('#connectBtn').click(function() {
    handleConnectionBtn(mqttCoolSession);
  });
}

function handleConnectionBtn(mqttCoolSession) {
  if (validateLoginForm()) {
    disableLogin();
    const url = makeUrlBroker();
    const user = $('#user').val();
    connectToBroker(url, user, mqttCoolSession);
  }
}

function validateLoginForm() {
  const loginForm = $('#loginForm');
  if (loginForm[0].checkValidity() === false) {
    loginForm.addClass('was-validated');
    return false;
  } else {
    loginForm.removeClass('was-validated');
    return true;
  }
}

function makeUrlBroker() {
  return 'tcp://' + $('#brokerHost').val() + ':' + $('#brokerPort').val();
}

function connectToBroker(urlBroker, user, mqttCoolSession) {
  const clientId = user + '_' + new Date().getTime().toString(36);

  // Configura um novo cliente MQTT e conecta ao broker MQTT hospedado na 
  // URL do provedor
  const mqttClient = setupMqttClient(urlBroker, clientId, mqttCoolSession);

  showMessage(MSG_LEVEL_STYLE.INFO, 'Conectando ao MQTT broker na '
    + urlBroker + '...');
  mqttClient.connect({
    onSuccess: function() {
      connected(urlBroker, mqttClient, clientId);
    },

    onFailure: function(response) {
      connectionFailed(response);
    },

    willMessage: makeDisconnectMessage(clientId)
  });
}

function setupMqttClient(urlBroker, myClientId, mqttCoolSession) {
  const mqttClient = mqttCoolSession.createClient(urlBroker, myClientId);

  mqttClient.onMessageDelivered = function(message) {
    if (!message.payloadString) {
      mqttClient.disconnect();
    }
  };

  mqttClient.onMessageArrived = function(message) {
    // Ao receber uma mensagem de "presença"
    if (message.destinationName.startsWith(USERS_LIST_TOPIC_PREFIX)) {
      handlePresence(message, myClientId);
    } else if (message.destinationName === CHAT_ROOM_TOPIC) {
      // Ao receber uma mensagem de "bate-papo"
      handleChatMessage(message, myClientId);
    }
  };

  mqttClient.onReconnectionStart = function() {
    showMessage(MSG_LEVEL_STYLE.INFO, 'Reconectando ao servidor '
      + 'MQTT...');
    disableDisconnection();
    disableUserMessage();
  };

  mqttClient.onReconnectionComplete = function() {
    showMessage(MSG_LEVEL_STYLE.SUCCESS, 'Reconectado ao servidor MQTT');
    showMessage(MSG_LEVEL_STYLE.SUCCESS, 'Reconectado ao broker MQTT na '
      + urlBroker);
    sendPresence(mqttClient, myClientId);
    enableDisconnection(mqttClient, myClientId);
    enableUserMessage(mqttClient, myClientId);
  };

  // Chamado quando o cliente perde a conexão
  mqttClient.onConnectionLost = function(response) {
    connectionLost(response, urlBroker, mqttCoolSession, myClientId);
  };

  return mqttClient;
}

function handlePresence(message, myClientId) {
  const encodedUser = message.destinationName.split('/')[1];
  const user = decodeUser(encodedUser);
  if (!message.payloadString) {
    $('#' + user.clientId).remove();
    showMessage(MSG_LEVEL_STYLE.INFO, user.username + ' deixou o chat');
  } else {
    const isMe = user.clientId === myClientId;
    showNewLoggedUser(user, isMe, message.payloadString);
  }
}

function handleChatMessage(message, myClientId) {
  const parsedPayload = JSON.parse(message.payloadString);
  const messageAuthor = decodeUser(parsedPayload.clientId);
  showUserMessage(messageAuthor, messageAuthor.clientId === myClientId,
    parsedPayload.textReply);
}

function connectionLost(response, urlBroker, mqttCoolSession, myClientId) {
  switch (response.errorCode) {
    case 0:
      const user = decodeUser(myClientId);
      showUserMessage(user, true, 'se desconectou');
      break;
    case 12:
      showMessage(MSG_LEVEL_STYLE.WARN, response.errorMessage);
      break;
    default:
      showMessage(MSG_LEVEL_STYLE.ERROR, response.errorMessage);
  }
  showMessage(MSG_LEVEL_STYLE.INFO, 'Conecção perdida com ' + urlBroker);
  close();
}

function connected(urlBroker, mqttClient, myClientId) {
  showMessage(MSG_LEVEL_STYLE.SUCCESS, 'Conectado ao MQTT broker na '
    + urlBroker);

  mqttClient.subscribe(CHAT_ROOM_TOPIC);
  mqttClient.subscribe(USERS_LIST_TOPIC);

  sendPresence(mqttClient, myClientId);
  enableDisconnection(mqttClient, myClientId);
  enableUserMessage(mqttClient, myClientId);
}

function sendPresence(mqttClient, myClientId) {
  const structuredPayload = { timestamp: new Date().getTime() };
  const plainPayload = JSON.stringify(structuredPayload);
  const presenceMessage = new mqttcool.Message(plainPayload);
  presenceMessage.destinationName = makeUserTopic(myClientId);
  presenceMessage.retained = true;
  mqttClient.send(presenceMessage);
}

function makeUserTopic(clientId) {
  return USERS_LIST_TOPIC_PREFIX + '/' + clientId;
}

function enableDisconnection(mqttClient, myClientId) {
  setDisconnectBtnDisabled(false);
  $('#disconnectBtn').click(function() {
    mqttClient.send(makeDisconnectMessage(myClientId));
  });
}

function disableDisconnection() {
  if (!isDisabled('#disconnectBtn')) {
    setDisconnectBtnDisabled(true);
    $('#disconnectBtn').unbind('click');
  }
}

function makeDisconnectMessage(myClientId) {
  const userTopic = makeUserTopic(myClientId);
  const disconnectMessage = new mqttcool.Message(new Int8Array());
  disconnectMessage.retained = true;
  disconnectMessage.destinationName = userTopic;
  return disconnectMessage;
}

function enableUserMessage(mqttClient, myClientID) {
  $('#replyBtn').click(function() {
    sendNewChatMessage(mqttClient, myClientID);
  });

  setUserMessageDisabled(false);
}

function disableUserMessage() {
  if (!isDisabled('#sendMessage')) {
    setUserMessageDisabled(true);
    $('#replyBtn').unbind('click');
  }
}

function setUserMessageDisabled(disabled) {
  $('#sendMessage').prop('disabled', disabled);
  $('#replyBtn').prop('disabled', disabled);
}

function sendNewChatMessage(mqttClient, myClientId) {
  const structuredPayload = {
    clientId: myClientId,
    textReply: $('#sendMessage').val()
  };

  const plainPayload = JSON.stringify(structuredPayload);
  const message = new mqttcool.Message(plainPayload);
  message.destinationName = CHAT_ROOM_TOPIC;
  mqttClient.send(message);

  $('#sendMessage').val('');
  $('#sendMessage').focus();
}

function connectionFailed(response) {
  showMessage(MSG_LEVEL_STYLE.ERROR, response.errorMessage);
  close();
}

function showNewLoggedUser(decodedUser, isMe, presenceMessagePayload) {
  updateUsersList(decodedUser, isMe);

  const parsedPayload = JSON.parse(presenceMessagePayload);
  const connectTimestamp = parsedPayload.timestamp;
  const now = new Date().getTime();
  if ((now - connectTimestamp) <= 10 * 1000) {
    showMessage(MSG_LEVEL_STYLE.INFO, decodedUser.username
      + ' se juntou ao chat');
  }
}

function decodeUser(encodedUser) {
  const lastUsernameIndex = encodedUser.lastIndexOf('_');
  const username = encodedUser.substring(0, lastUsernameIndex);
  return { clientId: encodedUser, username: username };
}

function updateUsersList(decodedUser, isMe) {
  const userColorClass = decodeUserColor(isMe);
  const userIconClass = decoderUserIcon(isMe);
  const userTextSuffix = isMe ? ' (you) ' : '';

  const newUser = $('<li>')
    .prop('id', decodedUser.clientId)
    .addClass('list-group-item')
    .addClass('p-1 border-0')
    .addClass(userColorClass)
    .append($('<i>').addClass(userIconClass).addClass('mr-1'))
    .append(decodedUser.username + userTextSuffix);

  // Insere o ícone relativo a este usuário no início
  if (isMe) {
    $('#usersList').prepend(newUser);
  } else {
    $('#usersList').append(newUser);
  }
}

function decodeUserColor(isMe) {
  return isMe ? USER_STYLE.MY_USER_COLOR : USER_STYLE.OTHER_USER_COLOR;
}

function decoderUserIcon(isMe) {
  return isMe ? USER_STYLE.MY_USER_ICON : USER_STYLE.OTHER_USER_ICON;
}

function showUserMessage(decodedUser, isMe, message) {
  const messageStyle = decodeUserColor(isMe);
  showMessage(messageStyle, decodedUser.username + ': ' + message);
}

function showMessage(messageStyle, message) {
  $('#messages')
    .append($('<div>').addClass(messageStyle).text(message)
    );

  const scrollHeight = $('#messages').prop('scrollHeight');
  if (scrollHeight > 0) {
    $('#messages').animate({ scrollTop: scrollHeight }, 1500);
  }
}

function enableLogin() {
  changeLoginFormStatusTo(true);
  $('#user').val('');
  $('#usersList li').fadeTo(500, 0.01, function() {
    $(this).slideUp(150, function() {
      $(this).remove();
    });
  });
}

function disableLogin() {
  changeLoginFormStatusTo(false);
}

function changeLoginFormStatusTo(enable) {
  $('#brokerHost').prop('disabled', !enable);
  $('#brokerPort').prop('disabled', !enable);
  $('#connectBtn').prop('disabled', !enable);
  $('#user').prop('disabled', !enable);
}

function setDisconnectBtnDisabled(disabled) {
  $('#disconnectBtn').prop('disabled', disabled);
}

function isDisabled(element) {
  return $(element).prop('disabled');
}
