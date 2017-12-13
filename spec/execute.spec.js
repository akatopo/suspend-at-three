/* eslint-env jasmine */

const lolex = require('lolex');
const later = require('later');
const execute = require('../src/execute');

describe('execute', () => {
  let clock;

  beforeEach(() => {
    clock = lolex.install({ now: new Date(2016, 1, 29, 0, 0, 0, 0) }); // 12am Feb 29, 2016
  });

  afterEach(() => clock && clock.uninstall());

  it('should execute a recipe once every time it\'s scheduled', (done) => {
    const spyContainer = {
      testTask: idTask,
    };

    spyOn(spyContainer, 'testTask').and.callThrough();

    const recipe = {
      tasks: [spyContainer.testTask],
      schedule: later.parse.recur()
        .every(30)
        .minute(),
    };

    const onRecipeStartGen = (function* () {
      let times = 0;
      while (true) {
        expect(spyContainer.testTask).toHaveBeenCalledTimes(times);
        times = times + 1;
        if (times === 5) {
          yield done();
        }
        yield clock.tick('30:00');
      }
    }());

    execute(recipe, {
      onRecipeStart: () => onRecipeStartGen.next(),
    });
  });

  it('should detect skews within a 10 minute window', (done) => {
    const spyContainer = {
      testTask: idTask,
      onSkewDetected() {},
    };

    spyOn(spyContainer, 'onSkewDetected');
    spyOn(spyContainer, 'testTask').and.callThrough();

    const recipe = {
      tasks: [spyContainer.testTask],
      schedule: later.parse.recur()
        .every(30)
        .minute(),
    };

    const recipeStartGen = (function* () {
      clock.tick('05:00'); // 12:05am Feb 29, 2016
      clock.setSystemTime(new Date(2016, 1, 29, 0, 20, 0, 0)); // 12:20am Feb 29, 2016
      yield clock.tick('05:00'); // 12:25am Feb 29, 2016, skew detected

      expect(spyContainer.onSkewDetected).toHaveBeenCalledTimes(1);
      expect(spyContainer.testTask).toHaveBeenCalledTimes(0);
      yield clock.tick('30:00'); // 12:55am Feb 29, 2016, recipe done

      expect(spyContainer.onSkewDetected).toHaveBeenCalledTimes(1);
      expect(spyContainer.testTask).toHaveBeenCalledTimes(1);
      yield done();
    }());

    execute(recipe, {
      onRecipeStart: () => recipeStartGen.next(),
      onSkewDetected: spyContainer.onSkewDetected,
    });
  });
});

async function idTask(x) {
  return x;
}
