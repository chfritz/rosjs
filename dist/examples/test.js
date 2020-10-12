"use strict";

var rosnodejs = require("../index.js");

rosnodejs.initNode("/my_node", { onTheFly: true }).then(function (rosNode) {

  var geometry_msgs = rosnodejs.require("geometry_msgs").msg;
  var msg = new geometry_msgs.PoseWithCovariance({
    pose: {
      position: { x: 0.654321654321, y: 0, z: 0 },
      orientation: { w: 1, x: 0, y: 0, z: 0 }
    },
    covariance: [1, 2, 3, 4, 0, 0.123, 64, 128, 256, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 6, 0, 0, 0, 0, 0, 0, 8, 0, 0.123, 0, 0, 0, 0, 0.654321654321]
  });

  var pub = rosNode.advertise("/mytest", "geometry_msgs/PoseWithCovariance", {
    queueSize: 1,
    latching: true,
    throttleMs: 9
  });
  pub.publish(msg);

  // test variable length arrays

  rosNode.advertise("/mytest2", "trajectory_msgs/JointTrajectoryPoint", {
    queueSize: 1,
    latching: true,
    throttleMs: 9
  }).publish(new rosnodejs.require("trajectory_msgs").msg.JointTrajectoryPoint({
    positions: [1],
    velocities: [1, 2],
    accelerations: [1, 2, 3],
    effort: [1, 2, 3, 4],
    time_from_start: 100 }));
});