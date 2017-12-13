const R = require('ramda');
const later = require('later');
const Promise = require('bluebird');

module.exports = execute;

/////////////////////////////////////////////////////////////

const defaultHooks = {
  onRecipeDone(/* state, schedule */) {},
  onRecipeStart(/* state, schedule */) {},
  onTaskStart(/* state, name */) {},
  onTaskDone(/* state, name */) {},
  onSkewDetected() {},
};

function onInterval({ recipe, state, hooks }) {
  const { tasks, schedule } = recipe;
  const {
    onTaskStart,
    onTaskDone,
    onRecipeDone,
  } = hooks;
  const tasksWithHooks = tasks
    .map((task) => (statePromise) => statePromise
      .tap((s) => onTaskStart(s, task.taskName || task.name || task.toString()))
      .then((s) => task(Promise.resolve(s)))
      .tap((s) => onTaskDone(s, task.taskName || task.name || task.toString())));

  return () => R.compose(...tasksWithHooks)(Promise.resolve(state))
    .tap((newState) => onRecipeDone(newState, later.schedule(schedule)))
    .then((newState) => ({ recipe, state: newState, hooks }));
}

function execute(recipe, providedHooks) {
  const hooks = Object.assign({}, defaultHooks, providedHooks);
  const state = {};
  later.date.localTime();

  executeHelper({ recipe, state, hooks });
}

function executeHelper({ recipe, state, hooks }) {
  const { onRecipeStart, onSkewDetected } = hooks;
  const run = scheduleNextRun({ recipe, state, hooks });
  const fiveMin = 5 * 60 * 1000;
  const skewDetection = detectSkew(fiveMin);
  skewDetection.skewDetected.tap(onSkewDetected);

  Promise.any([run.runStarted, skewDetection.skewDetected])
    .then((res) => {
      skewDetection.cancel();
      if (res.runCompleted) {
        return res.runCompleted;
      }
      run.cancel();
      return { recipe, state, hooks };
    })
    .then(executeHelper);
  onRecipeStart(state, later.schedule(recipe.schedule));
}

function scheduleNextRun({ recipe, state, hooks }) {
  let t;

  const runStarted = new Promise((resolve) => {
    const cb = onInterval({ recipe, state, hooks });

    t = later.setTimeout(
      () => {
        const runCompleted = cb();
        resolve({ runCompleted });
      },
      recipe.schedule
    );
  });

  return { cancel() { t.clear(); }, runStarted };
}

function detectSkew(interval) {
  let timeout;
  const skewDetected = new Promise((resolve) => {
    let prevDate = Date.now();
    const cb = () => {
      const curDate = Date.now();
      if (curDate - prevDate >= 2 * interval) {
        resolve(curDate - prevDate);
      }
      prevDate = curDate;
    };
    timeout = setInterval(cb, interval);
  });
  return { cancel() { clearInterval(timeout); }, skewDetected };
}
