#!/usr/bin/env node

const fs = require('fs');
const log = require('nlogn');
const program = require('commander');
const recipe = require('../src/recipe');
const execute = require('../src/execute');
const { version } = require('../package.json');

program
  .version(version)
  .option('-c --configuration <file>', 'JSON configuration file')
  .parse(process.argv);

if (
  !program.configuration
) {
  throw new Error('not enough arguments provided');
}

const configuration = JSON.parse(fs.readFileSync(program.configuration));

execute(recipe(configuration), {
  onRecipeStart,
  onRecipeDone,
  onTaskDone,
  onTaskStart,
  onSkewDetected,
});

function onRecipeStart(state, sched) {
  const nextRun = sched.next(1);
  log.info(`Next recipe run will be @ ${nextRun}`);
}

function onTaskDone(state, name) {
  log.info(`task ${name} done, state is: ${JSON.stringify(state)}`);
}

function onTaskStart(state, name) {
  log.info(`task ${name} start, state is: ${JSON.stringify(state)}`);
}

function onRecipeDone(state/* , sched */) {
  log.info(`Recipe done, state is: ${JSON.stringify(state)}`);
}

function onSkewDetected(skew) {
  log.warn(`Skew detected (${skew}ms), resetting next recipe run`);
}
