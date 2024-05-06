
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
        describe: 'Assistant persona. "random" keyword which picks a random persona, which is default.',
        type: 'string'
    })
    .option('a', {
        alias: 'audio',
        describe: 'Text-to-speech (tts) service. Deepgram and Elevenlabs are supported. Default is none.',
        type: 'string',
        choices: ['deepgram', 'elevenlabs']
    })
    .option('v', {
        alias: 'voice',
        describe: 'Text-to-speech (tts) service voice id. See service documentation (Deepgram and Elevenlabs) for available voice ids.',
        type: 'string'
    })
    .option('r', {
        alias: 'recorder',
        describe: `Speech-to-text (stt) service. Google Cloud Speech and Deepgram Websockets are supported. Default is none.`,
        type: 'string',
        choices: ['deepgram', 'google']
    })
    .option('e', {
        alias: 'stream',
        describe: `Stream LLM text output. If set to true, the output will be streamed to the console as it is generated. If set to false, the output will be displayed after the completion of the generation process.`,
        type: 'boolean',
        default: false
    })
    .option('s', {
        alias: 'summary',
        describe: `Include summary of the given chat session to the system prompt. Must be a correct name of the directory in the summaries folder (chats), or 'recent' keyword which picks the latest summary.`,
        type: 'string'
    })
    .option('w', {
        alias: 'word',
        describe: `Voice recognition stop word that ends the prompt and sends prompt to the LLM for inference. Stop word is removed from the final prompt.`,
        type: 'string',
        default: 'okay'
    })
    .help()
    .alias('help', 'h')
    .argv;

module.exports = {
    argv
};