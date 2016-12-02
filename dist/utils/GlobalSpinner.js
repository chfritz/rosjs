'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var DEFAULT_SPIN_RATE_HZ = 200;
var events = require('events');
var LoggingManager = require('../lib/Logging.js');
var log = LoggingManager.getLogger('ros.spinner');

var PING_OP = 'ping';
var DELETE_OP = 'delete';

/**
 * @class ClientQueue
 * Queue of messages to handle for an individual client (subscriber or publisher)
 */

var ClientQueue = function () {
  function ClientQueue(client, queueSize, throttleMs) {
    _classCallCheck(this, ClientQueue);

    if (queueSize < 1) {
      throw new Error('Unable to create client message queue with size ' + queueSize + ' - minimum is 1');
    }

    this._client = client;

    this._queue = [];
    this._queueSize = queueSize;

    this.throttleMs = throttleMs;
    this._handleTime = null;
  }

  _createClass(ClientQueue, [{
    key: 'push',
    value: function push(item) {
      this._queue.push(item);
      if (this.length > this._queueSize) {
        this._queue.shift();
      }
    }
  }, {
    key: 'handleClientMessages',
    value: function handleClientMessages(time) {
      if (this._handleTime === null || time - this._handleTime >= this.throttleMs) {
        this._handleTime = time;
        try {
          this._client._handleMsgQueue(this._queue);
        } catch (err) {
          // log something?
        }
        this._queue = [];
        return true;
      }
      // else
      return false;
    }
  }, {
    key: 'length',
    get: function get() {
      return this._queue.length;
    }
  }]);

  return ClientQueue;
}();

/**
 * @class GlobalSpinner
 * Clients (subscribers and publishers) will register themselves with the node's spinner
 * when they're created. Clients will disconnect from the spinner whenever they're shutdown.
 * Whenever they receive a new message to handle, those clients will "ping" the spinner,
 * which will push the new message onto that client's queue and add the client to a list
 * of clients to be handled on the next spin. While spinning, the spinner is locked and
 * ping and disconnect operations are cached in order to ensure that changes aren't
 * made to the spinner during its execution (e.g. subscriber callback publishes a message,
 * publisher pings the spinner which queues the new message and adds the client to its callback
 * list, the client list is cleared at the end of the spin and this client has a
 * message hanging in its queue that will never be handled). Once all of the messages
 * received since the last spin are handled the Spinner is unlocked and all cached
 * ping and disconnect operations are replayed in order.
 */


var GlobalSpinner = function (_events) {
  _inherits(GlobalSpinner, _events);

  function GlobalSpinner() {
    var spinRate = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : DEFAULT_SPIN_RATE_HZ;
    var emit = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

    _classCallCheck(this, GlobalSpinner);

    var _this = _possibleConstructorReturn(this, (GlobalSpinner.__proto__ || Object.getPrototypeOf(GlobalSpinner)).call(this));

    if (typeof spinRate !== 'number') {
      spinRate = DEFAULT_SPIN_RATE_HZ;
    }

    _this._spinTime = 1 / spinRate;
    _this._expectedSpinExpire = null;
    _this._spinTimer = null;

    _this._clientCallQueue = [];
    _this._clientQueueMap = new Map();

    /**
     * Acts as a mutex while handling messages in _handleQueue
     * @type {boolean}
     * @private
     */
    _this._queueLocked = false;
    _this._lockedOpCache = [];

    // emit is just for testing purposes
    _this._emit = emit;
    return _this;
  }

  _createClass(GlobalSpinner, [{
    key: 'addClient',
    value: function addClient(client, clientId, queueSize, throttleMs) {
      if (queueSize > 0) {
        this._clientQueueMap.set(clientId, new ClientQueue(client, queueSize, throttleMs));
      }
    }

    /**
     * When subscribers/publishers receive new messages to handle, they will
     * "ping" the spinner.
     * @param clientId
     * @param msg
     */

  }, {
    key: 'ping',
    value: function ping() {
      var clientId = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
      var msg = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

      if (!clientId || !msg) {
        throw new Error('Trying to ping spinner without clientId');
      }

      if (this._queueLocked) {
        this._lockedOpCache.push({ op: PING_OP, clientId: clientId, msg: msg });
      } else {
        this._queueMessage(clientId, msg);
        this._setTimer();
      }
    }
  }, {
    key: 'disconnect',
    value: function disconnect(clientId) {
      if (this._queueLocked) {
        this._lockedOpCache.push({ op: DELETE_OP, clientId: clientId });
      } else {
        var index = this._clientCallQueue.indexOf(clientId);
        if (index !== -1) {
          this._clientCallQueue.splice(index, 1);
        }
        this._clientQueueMap.delete(clientId);
      }
    }
  }, {
    key: '_queueMessage',
    value: function _queueMessage(clientId, message) {
      var clientQueue = this._clientQueueMap.get(clientId);
      if (!clientQueue) {
        throw new Error('Unable to queue message for unknown client ' + clientId);
      }
      // else
      if (clientQueue.length === 0) {
        this._clientCallQueue.push(clientId);
      }

      clientQueue.push(message);
    }
  }, {
    key: '_handleLockedOpCache',
    value: function _handleLockedOpCache() {
      var len = this._lockedOpCache.length;
      for (var i = 0; i < len; ++i) {
        var _lockedOpCache$i = this._lockedOpCache[i],
            op = _lockedOpCache$i.op,
            clientId = _lockedOpCache$i.clientId,
            msg = _lockedOpCache$i.msg;

        if (op === PING_OP) {
          this.ping(clientId, msg);
        } else if (op === DELETE_OP) {
          this.disconnect(clientId);
        }
      }
      this._lockedOpCache = [];
    }
  }, {
    key: '_getClientsWithQueuedMessages',
    value: function _getClientsWithQueuedMessages() {
      var _this2 = this;

      var clients = {};
      this._clientQueueMap.forEach(function (value, clientId) {
        var queueSize = value.length;
        clients[clientId] = queueSize;
        if (queueSize > 0 && _this2._clientCallQueue.indexOf(clientId) === -1) {
          throw new Error('Client ' + clientId + ' has ' + value.length + ' queued messages but is not in call list!');
        }
      });
    }
  }, {
    key: '_setTimer',
    value: function _setTimer() {
      var _this3 = this;

      if (this._spinTimer === null) {
        if (this._emit) {
          this._spinTimer = setTimeout(function () {
            _this3._handleQueue();
            _this3.emit('tick');
          }, this._spinTime);
        } else {
          this._spinTimer = setTimeout(this._handleQueue.bind(this), this._spinTime);
        }
        this._expectedSpinExpire = Date.now() + this._spinTime;
      }
    }
  }, {
    key: '_handleQueue',
    value: function _handleQueue() {
      // lock the queue so that ping and disconnect operations are cached
      // while we're running through the call list instead of modifying
      // the list beneath us.
      this._queueLocked = true;
      var now = Date.now();
      var keepOnQueue = [];
      var len = this._clientCallQueue.length;
      for (var i = 0; i < len; ++i) {
        var clientId = this._clientCallQueue[i];
        var clientQueue = this._clientQueueMap.get(clientId);
        if (!clientQueue.handleClientMessages(now)) {
          keepOnQueue.push(clientId);
        }
      }

      if (keepOnQueue.length > 0) {
        this._clientCallQueue = keepOnQueue;
      } else {
        this._clientCallQueue = [];
      }

      // unlock the queue now that we've handled everything
      this._queueLocked = false;
      // handle any operations that occurred while the queue was locked
      this._handleLockedOpCache();

      // TODO: figure out if these clients that are throttling messages are
      // consistently keeping the timer running when it otherwise wouldn't be
      // and eating up CPU. Consider starting a slower timer if the least-throttled
      // client won't be handled for N cycles (e.g N === 5).
      this._spinTimer = null;
      if (this._clientCallQueue.length > 0) {
        this._setTimer();
      }
    }
  }]);

  return GlobalSpinner;
}(events);

module.exports = GlobalSpinner;