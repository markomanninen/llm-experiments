
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// Argument parsing
const argv = yargs(hideBin(process.argv))
    .option('t', {
        alias: 'tool',
        describe: 'Specify tools',
        type: 'array'
    })
    .option('p', {
        alias: 'persona',
        describe: 'Assistant persona',
        type: 'string'
    })
    .option('a', {
        alias: 'audio',
        describe: 'Text-to-speech (tts) service',
        type: 'string'
    })
    .option('v', {
        alias: 'voice',
        describe: 'Text-to-speech (tts) service voice id',
        type: 'string'
    })
    .option('s', {
        alias: 'summary',
        describe: `Include summary of the given chat session to the system prompt. Must be a correct name of the directory in the summaries folder (chats), or 'recent' keyword which picks the latest summary.`,
        type: 'string'
    })
    .help()
    .alias('help', 'h')
    .argv;

module.exports = {
    argv
};