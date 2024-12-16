'use strict';

// a utility script that will flatten the directory structure for the message
// files generated by genjs.

let message_utils = require('./utils/message_utils.js');

let args = process.argv;
console.log(args);

if (args.length < 3) {
  throw new Error('Must include desired output directory in calls to flatten!');
}

message_utils.findMessageFiles();
message_utils.flatten(args[2]);