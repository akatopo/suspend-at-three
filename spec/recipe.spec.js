/* eslint-env jasmine */

const lolex = require('lolex');
const proxyquire = require('proxyquire');
const execute = require('../src/execute');
const Promise = require('bluebird');

let pingMock;
let suspendMock;
let pushNotificationMock;
let closeJobMock;

const recipeMocks = {
  './ping': (...args) => pingMock(...args),
  './suspend-dbus': (...args) => suspendMock(...args),
  'notification-proxy/notification-proxy-sdk': {
    pushNotification: (...args) => pushNotificationMock(...args),
    closeJob: (...args) => closeJobMock(...args),
  },
};
const recipe = proxyquire('../src/recipe', recipeMocks)({
  env: 'local',
  deviceId: 'xxx',
  ip: '1.1.1.1',
  privateKeyPath: 'xxx',
});

describe('recipe', () => {
  let clock;

  beforeEach(() => {
    resetMocks();
    clock = lolex.install({ now: new Date(2016, 1, 29, 0, 0, 0, 0) }); // 12am Feb 29, 2016
  });

  afterEach(() => {
    if (clock) {
      clock.uninstall();
    }
  });

  it('should notify about suspend when ping failed and suspend on next run if no action is provided', (done) => {
    pingMock = () => Promise.resolve({ responded: false });

    const onRecipeDone = doneAfterRuns(2, done);

    const onRecipeStart = clockTicks([
      '02:30:00', // 2:30am
      '30:00', // 3am
    ], clock);

    const stateDescription = [
      [jasmine.objectContaining({ ping: false }), 'pingTask'],
      [jasmine.objectContaining({
        ping: false,
        pendingAction: true,
        jobId: jasmine.anything(),
      }), 'notifyTask'],
      [jasmine.objectContaining({
        ping: false,
        pendingAction: true,
        jobId: jasmine.anything(),
      }), 'suspendTask'],
      [jasmine.objectContaining({ ping: false }), 'pingTask'],
      [jasmine.objectContaining({
        ping: false,
        pendingAction: false,
        action: null,
        jobId: jasmine.anything(),
      }), 'notifyTask'],
      [{}, 'suspendTask'],
    ];

    const onTaskDone = statesEqual(stateDescription);

    execute(recipe, {
      onRecipeDone: () => onRecipeDone(),
      onRecipeStart: () => onRecipeStart(),
      onTaskDone,
    });

  });

  it('should not notify and add a snooze action for this run if ping succeeds', (done) => {
    pingMock = () => Promise.resolve({ responded: true });

    const onRecipeDone = doneAfterRuns(3, done);

    const onRecipeStart = clockTicks([
      '02:30:00', // 2:30am
      '30:00', // 3am
      '30:00', // 3:30am
    ], clock);

    const stateDescription = [
      [jasmine.objectContaining({ ping: true }), 'pingTask'],
      [jasmine.objectContaining({
        ping: true,
        action: 'snooze',
        pendingAction: false,
      }), 'notifyTask'],
      [jasmine.objectContaining({
        ping: true,
        action: undefined,
        pendingAction: false,
      }), 'suspendTask', () => { pingMock = () => Promise.resolve({ responded: false }); }],
      [jasmine.objectContaining({ ping: false }), 'pingTask'],
      [jasmine.objectContaining({
        ping: false,
        pendingAction: true,
        action: undefined,
      }), 'notifyTask'],
      [jasmine.objectContaining({
        ping: false,
        action: undefined,
        pendingAction: true,
      }), 'suspendTask'],
      [jasmine.objectContaining({ ping: false }), 'pingTask'],
      [jasmine.objectContaining({
        ping: false,
        pendingAction: false,
        action: null,
      }), 'notifyTask'],
      [{}, 'suspendTask'],
    ];

    const onTaskDone = statesEqual(stateDescription);

    execute(recipe, {
      onRecipeDone: () => onRecipeDone(),
      onRecipeStart: () => onRecipeStart(),
      onTaskDone,
    });
  });
});

async function defaultPingMock(/* ipOrDomainName */) {
  return { responded: true };
}

async function defaultPushNotificationMock() {
  return 'sampleJobId';
}

async function defaultSuspendMock() {
  return undefined;
}

async function defaultCloseJobMock() {
  return null;
}

function xxx(generator) {
  let firstRun = true;

  return (...args) => {
    if (firstRun && args.length) {
      firstRun = false;
      generator.next();
    }
    args.forEach((arg) => {
      generator.next(arg);
    });
    return generator.next();
  };
}

function resetMocks() {
  pingMock = defaultPingMock;
  suspendMock = defaultSuspendMock;
  pushNotificationMock = defaultPushNotificationMock;
  closeJobMock = defaultCloseJobMock;
}

function clockTicks(ticks, clock) {
  return xxx(function* () {
    // eslint-disable-next-line no-restricted-syntax
    for (const tick of ticks) {
      yield clock.tick(tick);
    }
  }());
}

function doneAfterRuns(count, done) {
  return xxx(function* () {
    while (count > 1) {
      yield;
      count = count - 1;
    }
    yield done();
  }());
}

function statesEqual(stateDescription) {
  return xxx(function* () {
    let state;
    let name;
    // eslint-disable-next-line no-restricted-syntax
    for (const [stateToEqual, taskName, cb] of stateDescription) {
      state = yield;
      name = yield;

      expect(state).toEqual(stateToEqual);
      expect(name).toEqual(taskName);
      yield (cb && cb(state, name));
    }
  }());
}
