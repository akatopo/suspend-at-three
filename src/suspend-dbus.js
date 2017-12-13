const exec = require('./exec-promise');

module.exports = () => exec(
  'dbus-send --system --print-reply ' +
  '--dest="org.freedesktop.UPower" ' +
  '/org/freedesktop/UPower ' +
  'org.freedesktop.UPower.Suspend'
);
