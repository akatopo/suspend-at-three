const Promise = require('bluebird');
const { exec } = require('child_process');

module.exports = Promise.promisify(exec, { multiArgs: true });
