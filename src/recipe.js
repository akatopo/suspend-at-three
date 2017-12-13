const later = require('later');
const { pushNotification, closeJob } = require('notification-proxy/notification-proxy-sdk');

const notificationData = require('../notification-data.json');
const ping = require('./ping');
const suspend = require('./suspend-dbus');

const thirtyMinMillis = 30 * 60 * 1000;

const mergeState = (oldState, newState) => Object.assign({}, oldState, newState);

const schedule = later.parse.recur()
  .every(30)
    .minute()
  .after('2:30')
    .time()
  .before('8:00')
    .time();

module.exports = ({
  env,
  deviceId,
  privateKeyPath,
  ip,
}) => {
  const boundNotify = notifyTask.bind(undefined, { deviceId, privateKeyPath, env });
  boundNotify.taskName = 'notifyTask';

  const boundPing = pingTask.bind(undefined, ip);
  boundPing.taskName = 'pingTask';

  const tasks = [
    suspendTask,
    boundNotify,
    boundPing,
  ];

  return {
    tasks,
    schedule,
  };
};

suspendTask.taskName = 'suspendTask';
function suspendTask(statePromise) {
  return statePromise
    .then((state) => {
      if (state.pendingAction) {
        return state;
      }
      if (state.action === 'snooze') {
        return mergeState(state, { action: undefined });
      }
      return suspend()
        .then(() => ({}));
    });
}

notifyTask.taskName = 'notifyTask';
function notifyTask({ deviceId, privateKeyPath, env }, statePromise) {
  return statePromise
    .then((state) => {
      if (state.action) {
        return mergeState(state, { pendingAction: false });
      }

      if (state.pendingAction) {
        return closeJob({
          jobId: state.jobId,
          deviceId,
          privateKeyPath,
        }, env)
        .then((action) => mergeState(state, { pendingAction: false, action }))
        .catch(() => mergeState(state, { pendingAction: false }));
      }

      const timestamp = Date.now();
      notificationData.timestamp = timestamp;
      notificationData.data.expiresAt = (new Date(timestamp + thirtyMinMillis)).toUTCString();
      return pushNotification({
        deviceId,
        payload: JSON.stringify(notificationData),
        privateKeyPath,
      }, env)
      .then((jobId) => mergeState(state, { pendingAction: true, jobId }))
      .catch(() => mergeState(state, { pendingAction: false }));
    });
}

pingTask.taskName = 'pingTask';
function pingTask(ip, statePromise) {
  return statePromise
    .then((state) => ping(ip)
      .then((res) => mergeState(state, {
        ping: res.responded,
        action: res.responded ? 'snooze' : state.action,
        pendingAction: res.responded ? false : state.pendingAction,
      })));
}
