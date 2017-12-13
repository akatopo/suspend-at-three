const net = require('net');
const isDomainName = require('is-domain-name');
const exec = require('./exec-promise');

module.exports = (ipOrDomainName) => {
  if (net.isIP(ipOrDomainName) === 0 && !isDomainName(ipOrDomainName)) {
    throw new Error('invalid IP or hostname provided');
  }

  return exec(`ping ${ipOrDomainName} -w 2 -q`)
    .then(() => ({ responded: true, returnCode: 0 }))
    .catch((err) => {
      if (err.signal !== null) {
        throw err;
      }

      return { responded: false, returnCode: err.code };
    });

};
