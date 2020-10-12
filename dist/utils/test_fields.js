"use strict";

f = require("./fields.js");
console.log(f.getDefaultValue("int32"));
console.log(f.getDefaultValue("int32[]"));
console.log(f.getDefaultValue("int32[10]"));
console.log(f.getDefaultValue("string[4]"));