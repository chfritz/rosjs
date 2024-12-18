/*
 *    Copyright 2016 Rethink Robotics
 *
 *    Copyright 2016 Chris Smith
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

'use strict';

const ros_msg_utils = require('../ros_msg_utils');
const base_serializers = ros_msg_utils.Serialize;
const base_deserializers = ros_msg_utils.Deserialize;

//-----------------------------------------------------------------------

const callerIdPrefix = 'callerid=';
const md5Prefix = 'md5sum=';
const topicPrefix = 'topic=';
//const servicePrefix = 'service=';
const typePrefix = 'type=';
//const errorPrefix = 'error=';
const messageDefinitionPrefix = 'message_definition=';
//const latchingField = 'latching=1';
//const persistentField = 'persistent=1';
//const tcpNoDelayField = 'tcp_nodelay=1';

//-----------------------------------------------------------------------

function serializeStringFields(fields) {
  let length = 0;
  fields.forEach(field => {
    length += field.length + 4;
  });
  let buffer = Buffer.allocUnsafe(length);
  let offset = 0;

  fields.forEach(field => {
    offset = base_serializers.string(field, buffer, offset);
  });
  return buffer;
}

function deserializeStringFields(buffer) {
  const fields = [];
  const offset = [0];
  while (offset[0] < buffer.length) {
    const str = base_deserializers.string(buffer, offset);
    fields.push(str);
  }

  return fields;
}

/**
 * NOTE for general questions see
 * http://wiki.ros.org/ROS/UDPROS
 */
let UdprosUtils = {

  createSubHeader(callerId, md5sum, topic, type) {
    const fields = [callerIdPrefix + callerId, md5Prefix + md5sum, topicPrefix + topic, typePrefix + type];
    return serializeStringFields(fields);
  },

  /**
   * Creates a UDPROS connection header for a publisher to send.
   * @param callerId {string} node publishing this topic
   * @param md5sum {string} md5 of the message
   * @param messageDefinition {string} trimmed message definition.
   * @param topic {string} topic name
   * @param type {string} type of the message
   *          rosbag relies on this being sent although it is not mentioned in the spec.
   */
  createPubHeader(callerId, md5sum, messageDefinition, topic, type) {
    const fields = [callerIdPrefix + callerId, md5Prefix + md5sum, messageDefinitionPrefix + messageDefinition, topicPrefix + topic, typePrefix + type];

    return serializeStringFields(fields);
  },

  createServiceClientHeader(callerId, service, md5sum, type, persistent) {
    const fields = [callerIdPrefix + callerId, servicePrefix + service, md5Prefix + md5sum];

    if (persistent) {
      fields.push(persistentField);
    }

    return serializeStringFields(fields);
  },

  createServiceServerHeader(callerId, md5sum, type) {
    const fields = [callerIdPrefix + callerId, md5Prefix + md5sum, typePrefix + type];
    return serializeStringFields(fields);
  },

  parseUdpRosHeader(header) {
    let info = {};

    const fields = deserializeStringFields(header);
    fields.forEach(field => {
      let matchResult = field.match(/^(\w+)=([\s\S]+)/);

      // invalid connection header
      if (!matchResult) {
        console.error('Invalid connection header while parsing field %s', field);
        return null;
      }
      // else
      info[matchResult[1]] = matchResult[2];
    });

    return info;
  },

  validateSubHeader(header, topic, type, md5sum) {
    if (!header.hasOwnProperty('topic')) {
      return this.serializeString('Connection header missing expected field [topic]');
    } else if (!header.hasOwnProperty('type')) {
      return this.serializeString('Connection header missing expected field [type]');
    } else if (!header.hasOwnProperty('md5sum')) {
      return this.serializeString('Connection header missing expected field [md5sum]');
    } else if (header.topic !== topic) {
      return this.serializeString('Got incorrect topic [' + header.topic + '] expected [' + topic + ']');
    }
    // rostopic will send '*' for some commands (hz)
    else if (header.type !== type && header.type !== '*') {
        return this.serializeString('Got incorrect message type [' + header.type + '] expected [' + type + ']');
      } else if (header.md5sum !== md5sum && header.md5sum !== '*') {
        return this.serializeString('Got incorrect md5sum [' + header.md5sum + '] expected [' + md5sum + ']');
      }
    // else
    return null;
  },

  validatePubHeader(header, type, md5sum) {
    if (!header.hasOwnProperty('type')) {
      return this.serializeString('Connection header missing expected field [type]');
    } else if (!header.hasOwnProperty('md5sum')) {
      return this.serializeString('Connection header missing expected field [md5sum]');
    }
    // rostopic will send '*' for some commands (hz)
    else if (header.type !== type && header.type !== '*') {
        return this.serializeString('Got incorrect message type [' + header.type + '] expected [' + type + ']');
      } else if (header.md5sum !== md5sum && header.md5sum !== '*') {
        return this.serializeString('Got incorrect md5sum [' + header.md5sum + '] expected [' + md5sum + ']');
      }
    // else
    return null;
  },

  validateServiceClientHeader(header, service, md5sum) {
    if (!header.hasOwnProperty('service')) {
      return 'Connection header missing expected field [service]';
    } else if (!header.hasOwnProperty('md5sum')) {
      return 'Connection header missing expected field [md5sum]';
    } else if (header.service !== service) {
      return 'Got incorrect service [' + header.service + '] expected [' + service + ']';
    } else if (header.md5sum !== md5sum && header.md5sum !== '*') {
      return 'Got incorrect md5sum [' + header.md5sum + '] expected [' + md5sum + ']';
    }
  },

  serializeMessage(MessageClass, message) {
    let prependMessageLength = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;

    const msgSize = MessageClass.getMessageSize(message);
    let msgBuffer;
    let offset = 0;
    if (prependMessageLength) {
      msgBuffer = Buffer.allocUnsafe(msgSize + 4);
      offset = base_serializers.uint32(msgSize, msgBuffer, 0);
    } else {
      msgBuffer = Buffer.allocUnsafe(msgSize);
    }

    MessageClass.serialize(message, msgBuffer, offset);
    return msgBuffer;
  },

  serializeServiceResponse(ResponseClass, response, success) {
    let prependResponseInfo = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : true;

    let responseBuffer;
    if (prependResponseInfo) {
      if (success) {
        const respSize = ResponseClass.getMessageSize(response);
        responseBuffer = Buffer.allocUnsafe(respSize + 5);

        // add the success byte
        base_serializers.uint8(1, responseBuffer, 0);
        // add the message length
        base_serializers.uint32(respSize, responseBuffer, 1);
        ResponseClass.serialize(response, responseBuffer, 5);
      } else {
        const errorMessage = 'Unable to handle service call';
        const errLen = errorMessage.length;
        // FIXME: check that we don't need the extra 4 byte message len here
        responseBuffer = Buffer.allocUnsafe(5 + errLen);
        base_serializers.uint8(0, responseBuffer, 0);
        base_serializers.string(errorMessage, responseBuffer, 1);
      }
    } else {
      responseBuffer = Buffer.allocUnsafe(ResponseClass.getMessageSize(response));
    }

    return responseBuffer;
  },

  deserializeMessage(MessageClass, messageBuffer) {
    return MessageClass.deserialize(messageBuffer, [0]);
  },

  serializeString(str) {
    const buf = Buffer.allocUnsafe(str.length + 4);
    base_serializers.string(str, buf, 0);
    return buf;
  },

  deserializeString(buffer) {
    return base_deserializers.string(buffer, [0]);
  },

  createUdpRosError(str) {
    return this.serializeString(`{errorPrefix}${str}`);
  },

  deserializeHeader(buff) {
    if (buff.length < 8) {
      return undefined;
    }
    let connectionId = buff.readUInt32LE(0);
    let opCode = buff.readUInt8(4);
    let msgId = buff.readUInt8(5);
    let blkN = buff.readUInt16LE(6);
    return {
      connectionId,
      opCode,
      msgId,
      blkN
    };
  },

  serializeUdpHeader(connectionId, opCode, msgId, blkN) {
    const buf = Buffer.allocUnsafe(8);
    base_serializers.uint32(connectionId, buf, 0);
    base_serializers.uint8(opCode, buf, 4);
    base_serializers.uint8(msgId, buf, 5);
    base_serializers.uint16(blkN, buf, 6);
    return buf;
  }
};

//-----------------------------------------------------------------------

module.exports = UdprosUtils;