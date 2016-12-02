'use strict';

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var fs = require('fs');
var util = require('util');
var IndentedWriter = require('./IndentedWriter.js');
var fieldsUtil = require('./fields.js');

module.exports = {
  createMessageClass: function createMessageClass(msgSpec) {
    var w = new IndentedWriter();
    writeHeader(w, msgSpec);
    writeRequires(w, msgSpec, false);
    writeClass(w, msgSpec);
    writeSerialize(w, msgSpec);
    writeDeserialize(w, msgSpec);
    writeGetMessageSize(w, msgSpec);
    writeRosDatatype(w, msgSpec);
    writeMd5sum(w, msgSpec);
    writeMessageDefinition(w, msgSpec);
    writeResolve(w, msgSpec);
    w.dedent('}').newline();
    writeConstants(w, msgSpec);
    w.write('module.exports = ' + msgSpec.messageName);

    return w.get();
  },
  createServiceClass: function createServiceClass(srvSpec) {
    var w = new IndentedWriter();
    writeHeader(w, srvSpec);

    var _writeRequires = writeRequires(w, srvSpec.request, true),
        localDeps = _writeRequires.localDeps,
        foundPackages = _writeRequires.foundPackages;

    writeRequires(w, srvSpec.response, true, foundPackages, localDeps);
    writeServiceComponent(w, srvSpec.request);
    writeServiceComponent(w, srvSpec.response);
    writeServiceEnd(w, srvSpec);

    return w.get();
  },
  generateActionGoalMessage: function generateActionGoalMessage(messageName) {
    var w = new IndentedWriter();
    w.write('# ===== DO NOT MODIFY! AUTOGENERATED FROM ACTION DEFINITION =====').write('std_msgs/Header header').write('actionlib_msgs/GoalID goal_id').write(messageName + 'Goal goal');

    return w.get();
  },
  generateActionResultMessage: function generateActionResultMessage(messageName) {
    var w = new IndentedWriter();
    w.write('# ===== DO NOT MODIFY! AUTOGENERATED FROM ACTION DEFINITION =====').write('std_msgs/Header header').write('actionlib_msgs/GoalStatus status').write(messageName + 'Result result');

    return w.get();
  },
  generateActionFeedbackMessage: function generateActionFeedbackMessage(messageName) {
    var w = new IndentedWriter();
    w.write('# ===== DO NOT MODIFY! AUTOGENERATED FROM ACTION DEFINITION =====').write('std_msgs/Header header').write('actionlib_msgs/GoalStatus status').write(messageName + 'Feedback feedback');

    return w.get();
  },
  generateActionMessage: function generateActionMessage(messageName) {
    var w = new IndentedWriter();
    w.write('# ===== DO NOT MODIFY! AUTOGENERATED FROM ACTION DEFINITION =====').write(messageName + 'ActionGoal action_goal').write(messageName + 'ActionResult action_result').write(messageName + 'ActionFeedback action_feedback');

    return w.get();
  }
};

function writeHeader(w, spec) {
  w.dividingLine();
  w.write('// Auto-generated from package %s.', spec.packageName);
  w.write('// !! Do not edit !!');
  w.dividingLine();
  w.newline();
}

function writeRequires(w, spec, isSrv) {
  var previousPackages = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : null;
  var previousDeps = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : null;

  if (previousPackages === null) {
    w.write('"use strict";');
    w.newline();
    w.write('const _serializer = _ros_msg_utils.Serialize;');
    w.write('const _arraySerializer = _serializer.Array;');
    w.write('const _deserializer = _ros_msg_utils.Deserialize;');
    w.write('const _arrayDeserializer = _deserializer.Array');
    w.write('const _finder = _ros_msg_utils.Find;');
    w.write('const _getByteLength = _ros_msg_utils.getByteLength');
    previousPackages = new Set();
  }
  if (previousDeps === null) {
    previousDeps = new Set();
  }

  var packageName = spec.packageName;
  // a unique list of package-local dependencies on other messages
  var localDeps = new Set();
  // a unique list of other package dependencies
  var foundPackages = new Set();

  spec.fields.forEach(function (field) {
    if (!field.isBuiltin) {
      var fieldPack = field.getPackage();
      if (fieldPack === packageName) {
        var fieldMsgType = field.getMessage();
        // don't require this type again
        if (!previousDeps.has(fieldMsgType) && !localDeps.has(fieldMsgType)) {
          localDeps.add(fieldMsgType);
          if (isSrv) {
            w.write('const %s = require(\'../msg/%s.js\');', fieldMsgType, fieldMsgType);
          } else {
            w.write('const %s = require(\'./%s.js\');', fieldMsgType, fieldMsgType);
          }
        }
      } else {
        // don't find this package again
        if (!previousPackages.has(fieldPack) && !foundPackages.has(fieldPack)) {
          foundPackages.add(fieldPack);
          w.write('const %s = _finder(\'%s\');', fieldPack, fieldPack);
        }
      }
    }
  });

  w.newline();
  w.dividingLine();
  w.newline();
  return { localDeps: localDeps, foundPackages: foundPackages };
}

function getMessagePathFromField(field, packageName) {
  var _field$baseType$split = field.baseType.split('/'),
      _field$baseType$split2 = _slicedToArray(_field$baseType$split, 2),
      fieldPackage = _field$baseType$split2[0],
      fieldMsg = _field$baseType$split2[1];

  if (fieldPackage === packageName) {
    return util.format('%s', fieldMsg);
  }
  // else
  return util.format('%s.msg.%s', fieldPackage, fieldMsg);
}

function getDefaultValue(field, packageName) {
  if (field.isArray) {
    if (!field.arrayLen) {
      return '[]';
    } else {
      var fieldCopy = Object.assign({}, field);
      fieldCopy.isArray = false;
      var fieldDefault = getDefaultValue(fieldCopy, packageName);
      return util.format('new Array(%s).fill(%s)', field.arrayLen, fieldDefault);
    }
  } else if (field.isBuiltin) {
    if (fieldsUtil.isString(field.type)) {
      return '\'\'';
    } else if (fieldsUtil.isTime(field.type)) {
      return '{secs: 0, nsecs: 0}';
    } else if (fieldsUtil.isBool(field.type)) {
      return 'false';
    } else if (fieldsUtil.isFloat(field.type)) {
      return '0.0';
    }
    // else is int
    return '0';
  }
  // else
  return 'new ' + getMessagePathFromField(field, packageName) + '()';
}

function writeMsgConstructorField(w, spec, field) {
  w.write('if (initObj.hasOwnProperty(\'%s\')) {', field.name).indent();
  w.write('this.%s = initObj.%s;', field.name, field.name).dedent();
  w.write('}');
  w.write('else {').indent();
  w.write('this.%s = %s;', field.name, getDefaultValue(field, spec.packageName)).dedent();
  w.write('}');
  w.newline();
}

function writeClass(w, spec) {
  w.write('class %s {', spec.messageName);
  w.indent();
  w.write('constructor(initObj={}) {');
  w.indent('if (initObj === null) {').indent('// initObj === null is a special case for deserialization where we don\'t initialize fields');
  spec.fields.forEach(function (field) {
    w.write('this.%s = null;', field.name);
  });
  w.dedent('}').write('else {').indent('// check for this message\'s fields by key name - otherwise assign default values');
  spec.fields.forEach(function (field) {
    writeMsgConstructorField(w, spec, field);
  });
  w.dedent('}').dedent('}').newline();
}

function writeResolve(w, spec) {
  // this borrows a lot from the constructor but I'm worried about passing in
  // a second argument to the constructor (e.g. constructor(json, forceResolve)) and
  // then in the future we're hosed if we want to accept in-order arguments
  w.write('static Resolve(msg) {').indent('// deep-construct a valid message object instance of whatever was passed in').write('if (typeof msg !== \'object\' || msg === null) {').indent('msg = {};').dedent('}').write('const resolved = new ' + spec.messageName + '(null);');
  spec.fields.forEach(function (field) {
    if (!field.isBuiltin) {
      w.write('if (msg.' + field.name + ' !== undefined) {').indent();
      if (field.isArray) {
        if (field.arrayLen === null) {
          w.write('resolved.' + field.name + ' = new Array(msg.' + field.name + '.length);').write('for (let i = 0; i < resolved.' + field.name + '.length; ++i) {').indent('resolved.' + field.name + '[i] = ' + getMessagePathFromField(field, spec.packageName) + '.Resolve(msg.' + field.name + '[i]);').dedent('}');
        } else {
          w.write('resolved.' + field.name + ' = new Array(' + field.arrayLen + ');').write('for (let i = 0; i < resolved.' + field.name + '.length; ++i) {').indent('if (msg.' + field.name + '.length > i) {').indent('resolved.' + field.name + '[i] = ' + getMessagePathFromField(field, spec.packageName) + '.Resolve(msg.' + field.name + '[i]);').dedent('}').write('else {').indent('resolved.' + field.name + '[i] = new ' + getMessagePathFromField(field, spec.packageName) + '();').dedent('}').dedent('}');
        }
      } else {
        w.write('resolved.' + field.name + ' = ' + getMessagePathFromField(field, spec.packageName) + '.Resolve(msg.' + field.name + ');');
      }

      w.dedent('}').write('else {') // msg.fieldName === undefined
      .indent('resolved.' + field.name + ' = ' + getDefaultValue(field, spec.packageName) + ';').dedent('}');
    } else {
      w.write('if (msg.' + field.name + ' !== undefined) {').indent('resolved.' + field.name + ' = msg.' + field.name + ';').dedent('}').write('else {').indent('resolved.' + field.name + ' = ' + getDefaultValue(field, spec.packageName) + ';').dedent('}');
    }

    w.newline();
  });
  w.write('return resolved;').dedent('}');
}

function writeSerializeLength(w, name) {
  w.write('// Serialize the length for message field [' + name + ']').write('bufferOffset = _serializer.uint32(obj.' + name + '.length, buffer, bufferOffset);');
}

function writeSerializeLengthCheck(w, field) {
  w.write('// Check that the constant length array field [' + field.name + '] has the right length').write('if (obj.' + field.name + '.length !== ' + field.arrayLen + ') {').indent().write('throw new Error(\'Unable to serialize array field ' + field.name + ' - length must be ' + field.arrayLen + '\')').dedent().write('}');
}

function writeSerializeBuiltinField(w, f) {
  if (f.isArray) {
    w.write('bufferOffset = _arraySerializer.' + f.baseType + '(obj.' + f.name + ', buffer, bufferOffset, ' + f.arrayLen + ');');
  } else {
    w.write('bufferOffset = _serializer.' + f.baseType + '(obj.' + f.name + ', buffer, bufferOffset);');
  }
}

function writeSerializeMessageField(w, f, thisPackage) {
  var fieldPackage = fieldsUtil.getPackageNameFromMessageType(f.baseType);
  var msgName = fieldsUtil.getMessageNameFromMessageType(f.baseType);
  var samePackage = fieldPackage === thisPackage;
  if (f.isArray) {
    if (!f.arrayLen) {
      writeSerializeLength(w, f.name);
    }
    w.write('obj.' + f.name + '.forEach((val) => {').indent();
    if (samePackage) {
      w.write('bufferOffset = ' + msgName + '.serialize(val, buffer, bufferOffset);');
    } else {
      w.write('bufferOffset = ' + fieldPackage + '.msg.' + msgName + '.serialize(val, buffer, bufferOffset);');
    }
    w.dedent().write('});');
  } else {
    if (samePackage) {
      w.write('bufferOffset = ' + msgName + '.serialize(obj.' + f.name + ', buffer, bufferOffset);');
    } else {
      w.write('bufferOffset = ' + fieldPackage + '.msg.' + msgName + '.serialize(obj.' + f.name + ', buffer, bufferOffset);');
    }
  }
}

function writeSerializeField(w, field, packageName) {
  if (field.isArray) {
    if (field.arrayLen) {
      writeSerializeLengthCheck(w, field);
    }
    w.newline();
  }
  w.write('// Serialize message field [%s]', field.name);
  if (field.isBuiltin) {
    writeSerializeBuiltinField(w, field);
  } else {
    writeSerializeMessageField(w, field, packageName);
  }
  w.newline();
}

function writeSerialize(w, spec) {
  w.write('static serialize(obj, buffer, bufferOffset) {').indent().write('// Serializes a message object of type %s', spec.messageName);
  spec.fields.forEach(function (field) {
    writeSerializeField(w, field, spec.packageName);
  });
  w.write('return bufferOffset;').dedent().write('}').newline();
}

function writeDeserializeLength(w, name) {
  w.write('// Deserialize array length for message field [' + name + ']');
  w.write('len = _deserializer.uint32(buffer, bufferOffset);');
}

function writeDeserializeMessageField(w, field, thisPackage) {
  var fieldPackage = fieldsUtil.getPackageNameFromMessageType(field.baseType);
  var msgName = fieldsUtil.getMessageNameFromMessageType(field.baseType);
  var samePackage = fieldPackage === thisPackage;
  if (field.isArray) {
    // only create a new array if it has a non-constant length
    if (!field.arrayLen) {
      writeDeserializeLength(w, field.name);
    } else {
      w.write('len = ' + field.arrayLen + ';');
    }

    w.write('data.' + field.name + ' = new Array(len);').write('for (let i = 0; i < len; ++i) {').indent();
    if (samePackage) {
      w.write('data.' + field.name + '[i] = ' + msgName + '.deserialize(buffer, bufferOffset);');
    } else {
      w.write('data.' + field.name + '[i] = ' + fieldPackage + '.msg.' + msgName + '.deserialize(buffer, bufferOffset);');
    }
    w.dedent('}');
  } else {
    if (samePackage) {
      w.write('data.' + field.name + ' = ' + msgName + '.deserialize(buffer, bufferOffset);');
    } else {
      w.write('data.' + field.name + ' = ' + fieldPackage + '.msg.' + msgName + '.deserialize(buffer, bufferOffset);');
    }
  }
}

function writeDeserializeBuiltinField(w, field) {
  if (field.isArray) {
    w.write('data.' + field.name + ' = _arrayDeserializer.' + field.baseType + '(buffer, bufferOffset, ' + field.arrayLen + ');');
  } else {
    w.write('data.' + field.name + ' = _deserializer.' + field.baseType + '(buffer, bufferOffset);');
  }
}

function writeDeserializeField(w, field, packageName) {
  w.write('// Deserialize message field [' + field.name + ']');
  if (field.isBuiltin) {
    writeDeserializeBuiltinField(w, field);
  } else {
    writeDeserializeMessageField(w, field, packageName);
  }
  w.newline();
}

function writeDeserialize(w, spec) {
  w.write('static deserialize(buffer, bufferOffset=[0]) {').indent('// Deserializes a message object of type %s', spec.messageName).write('let data = new %s(null);', spec.messageName).write('let len;');
  spec.fields.forEach(function (field) {
    writeDeserializeField(w, field, spec.packageName);
  });
  w.write('return data;').dedent().write('}').newline();
}

function getTypeSize(t) {
  switch (t) {
    case 'int8':
    case 'uint8':
    case 'byte':
    case 'bool':
    case 'char':
      return 1;
    case 'int16':
    case 'uint16':
      return 2;
    case 'int32':
    case 'uint32':
    case 'float32':
      return 4;
    case 'int64':
    case 'uint64':
    case 'float64':
    case 'time':
    case 'duration':
      return 8;
  }
  return null;
}

function writeGetMessageSize(w, spec) {
  // Write a static method to determine the buffer size of a complete message
  w.write('static getMessageSize(object) {');
  var msgSize = spec.getMessageFixedSize();
  if (msgSize !== null) {
    w.indent().write('return ' + msgSize + ';');
  } else {
    w.indent().write('let length = 0;');

    // certain fields will always have the same size
    // calculate that here instead of dynamically every time
    var lenConstantLengthFields = 0;
    spec.fields.forEach(function (field) {
      var fieldSize = 0;
      if (field.isBuiltin) {
        fieldSize = getTypeSize(field.baseType);
      } else {
        var fieldSpec = spec.getMsgSpecForType(field.baseType);
        if (!fieldSpec) {
          spec.getMsgSpecForType(field.baseType);
        }
        fieldSize = fieldSpec.getMessageFixedSize();
      }

      if (field.isArray) {
        if (field.arrayLen && fieldSize !== null) {
          lenConstantLengthFields += fieldSize * field.arrayLen;
          return;
        } else if (field.arrayLen === null) {
          // account for 4 byte array length
          lenConstantLengthFields += 4;
        }

        if (fieldSize === 1) {
          w.write('length += object.' + field.name + '.length;');
        } else if (fieldSize !== null) {
          w.write('length += ' + fieldSize + ' * object.' + field.name + '.length');
        } else {
          var lineToWrite = void 0;
          if (field.isBuiltin) {
            if (!fieldsUtil.isString(field.baseType)) {
              throw new Error('Unexpected field ' + field.name + ' with type ' + field.baseType + ' has unknown length');
            }

            // it's a string array!
            lineToWrite = 'length += 4 + _getByteLength(object.' + field.name + '[i]);';
          } else {
            var _field$baseType$split3 = field.baseType.split('/'),
                _field$baseType$split4 = _slicedToArray(_field$baseType$split3, 2),
                pkg = _field$baseType$split4[0],
                msgType = _field$baseType$split4[1];

            var samePackage = spec.packageName === pkg;
            if (samePackage) {
              lineToWrite = 'length += ' + msgType + '.getMessageSize(object.' + field.name + '[i]);';
            } else {
              lineToWrite = 'length += ' + pkg + '.msg.' + msgType + '.getMessageSize(object.' + field.name + '[i]);';
            }
          }

          w.write('for(let i = 0; i < object.' + field.name + '.length; ++i) {').indent().write(lineToWrite).dedent().write('}');
        }
      } else if (fieldSize !== null) {
        lenConstantLengthFields += fieldSize;
      } else {
        var _lineToWrite = void 0;
        // field size is variable *blurgh blurgh*
        if (field.isBuiltin) {
          if (!fieldsUtil.isString(field.baseType)) {
            throw new Error('Unexpected field ' + field.name + ' with type ' + field.baseType + ' has unknown length');
          }
          // it's a string!
          // string length consumes 4 bytes in message
          lenConstantLengthFields += 4;
          _lineToWrite = 'length += _getByteLength(object.' + field.name + ');';
        } else {
          var _field$baseType$split5 = field.baseType.split('/'),
              _field$baseType$split6 = _slicedToArray(_field$baseType$split5, 2),
              _pkg = _field$baseType$split6[0],
              _msgType = _field$baseType$split6[1];

          var _samePackage = spec.packageName === _pkg;
          if (_samePackage) {
            _lineToWrite = 'length += ' + _msgType + '.getMessageSize(object.' + field.name + ')';
          } else {
            _lineToWrite = 'length += ' + _pkg + '.msg.' + _msgType + '.getMessageSize(object.' + field.name + ')';
          }
        }
        w.write(_lineToWrite);
      }
    });

    if (lenConstantLengthFields > 0) {
      w.write('// ' + lenConstantLengthFields + ' is precalculated sum of the constant length fields');
      w.write('return length + ' + lenConstantLengthFields + ';');
    } else {
      w.write('return length;');
    }
  }
  w.dedent().write('}').newline();
}

function writeRosDatatype(w, spec) {
  w.write('static datatype() {').indent('// Returns string type for a ' + spec.getFullMessageName() + ' object').write('return \'' + spec.getFullMessageName() + '\';').dedent('}').newline();
}

function writeMd5sum(w, spec) {
  w.write('static md5sum() {').indent('// Returns md5sum of message object').write('return \'' + spec.getMd5sum() + '\'').dedent('}').newline();
}

function writeMessageDefinition(w, spec) {
  w.write('static messageDefinition() {').indent('// Returns full string definition for message').write('return `');

  var lines = spec.fileContents.split('\n');
  lines.forEach(function (line) {
    w.write('' + line);
  });
  w.write('`;').dedent('}').newline();
}

function writeConstants(w, spec) {
  if (spec.constants && spec.constants.length > 0) {
    w.write('// Constants for message').write(spec.messageName + '.Constants = {').indent();
    spec.constants.forEach(function (constant) {
      if (fieldsUtil.isString(constant.type)) {
        w.write(constant.name.toUpperCase() + ': \'' + constant.value + '\',');
      } else {
        w.write(constant.name.toUpperCase() + ': ' + constant.value + ',');
      }
    });
    w.dedent('}').newline();
  }
}

function writeServiceComponent(w, spec) {
  writeClass(w, spec);
  writeSerialize(w, spec);
  writeDeserialize(w, spec);
  writeGetMessageSize(w, spec);
  writeRosDatatype(w, spec);
  writeMd5sum(w, spec);
  writeMessageDefinition(w, spec);
  writeResolve(w, spec);
  w.dedent('}').newline();
  writeConstants(w, spec);
  w.dividingLine();
}

function writeServiceEnd(w, spec) {
  w.write('module.exports = {').indent('Request: ' + spec.request.messageName + ',').write('Response: ' + spec.response.messageName + ',').write('md5sum() { return \'' + spec.getMd5sum() + '\'; },').write('datatype() { return \'' + spec.getFullMessageName() + '\'; }').dedent('};').newline();
}