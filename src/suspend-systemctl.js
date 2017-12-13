const exec = require('./exec-promise');

module.exports = () => exec('systemctl suspend');
