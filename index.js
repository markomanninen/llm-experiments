// iOllama.js - A custom chatbot for the a local ollama LLM platform
// Requires: npm install axios, yargs, groq-sdk, and ollama to serve LLM models locally at the port 11434
// See: https://ollama.com, https://ollama.com/library, and
// https://github.com/ollama/ollama?tab=readme-ov-file#quickstart
// https://www.npmjs.com/package/groq-sdk
// https://www.npmjs.com/package/openai
// https://www.npmjs.com/package/@anthropic-ai/sdk
// https://www.npmjs.com/package/axios
// https://www.npmjs.com/package/yargs
// For text to speech audio:
// https://www.npmjs.com/package/elevenlabs
// https://www.npmjs.com/package/@deepgram/sdk
const fs = require('fs');
const path = require('path');
const util = require('util');
const readline = require('readline');
const axios = require('axios');
const Groq = require('groq-sdk');
const { performance, PerformanceObserver } = require('perf_hooks');
const { ElevenLabsClient, play, stream: playStream } = require("elevenlabs");
const { createClient: createDeepgramClient } = require("@deepgram/sdk");
const Anthropic = require("@anthropic-ai/sdk");
const OpenAI = require('openai');
require('dotenv').config();

const applicationName = "llm-experiments";

// Set the path for the log file
const logFilePath = path.join(__dirname, `${applicationName}.errors.log`);

// Create a writable stream to the log file
const errorLogStream = fs.createWriteStream(logFilePath, { flags: 'a' });

// Redirect console.error to write to the errorLogStream
console.error = function (message, ...optionalParams) {
    errorLogStream.write(`${new Date().toISOString()} - ${util.format(message, ...optionalParams)}\n`);
};

const { 
    prompts, 
    getPrompt,
    randomPersona,
    assistantPersonas,
    system_message_metadata_tools_epilogue, 
    system_message_metadata_schema_tools_part 
} = require('./prompts');

let { 
    system_message_metadata, 
    system_message_metadata_schema
} = require('./prompts');

const { JsonStorage, RuntimeMemoryStorage, nodeCodeRunner, extractAndParseJsonBlock } = require('./utils');

const jsonStorage = new JsonStorage("persistent.json");

const runtimeMemoryStorage = new RuntimeMemoryStorage();

const {
    createPingPongGame,
    createHangmanGame,
    createFireWaterGrassGame,
    createRockPaperScissorsGame,
    createNumberGuessingGame
} = require('./games');

const hangmanGame = createHangmanGame();
const pingPongGame = createPingPongGame();
const fireWaterGrassGame = createFireWaterGrassGame();
const rockPaperScissorsGame = createRockPaperScissorsGame();
let numberGuessingGame = null; //createNumberGuessingGame();

const { argv } = require('./args');

const { renderSelectedSchemas } = require('./tools');

// Initialize the GROQ SDK with the API key
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

// Global constants
const groqModelNames = [
    "llama3-70b-8192",
    "llama3-8b-8192",
    "llama2-70b-4096",
    "gemma-7b-it",
    "mixtral-8x7b-32768"
];

const anthropicModelNames = [
    "claude-3-haiku-20240307",
    "claude-3-sonnet-20240229",
    "claude-3-opus-20240229"
]

const openAIModelNames = [
    "gpt-4-turbo-2024-04-09",
    "gpt-4-turbo",
    "gpt-3.5-turbo-0125",
    "gpt-3.5-turbo"
]

const ttsServices = ["elevenlabs", "deepgram"];

// Eleven Labs voice ID: '29vD33N1CtxCmqQRPOHJ' -> Male voice (Drew)
// Deepgram voice ID: 'aura-asteria-en' -> Aura Asteria English
const defaultVoices = {
    "elevenlabs": "29vD33N1CtxCmqQRPOHJ",
    "deepgram": "aura-asteria-en"
};

// Console input/output handler
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '➤  '
});

// Ollama server base URL
const baseUrl = 'http://localhost:11434';
// Async request performance log file
const performanceLogFilepath = 'performance_logs.csv';
// Default temperature for LLM generated text
const temperature = 0.0;

// Activity indicator with spinner on command line interface
const stopSpinner = { isStopped: true };

// Create a session directory
const sessionStart = getCurrentTimestamp();
const sessionDir = path.join(__dirname, 'chats', sessionStart);
const sessionFile = path.join(sessionDir, 'session.jsonl');

const elevenlabs = new ElevenLabsClient({
    apiKey: process.env.ELEVENLABS_API_KEY
})

const deepgram = createDeepgramClient(
    process.env.DEEPGRAM_API_KEY
);

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

/****************************************************
** Global variables
****************************************************/

// LLM client: ollama or groq
// TODO: openai, anthropic, huggingface, etc.
let llmClient = "ollama";
// How many messages should fit on history. odd number it must be!
let messageLimit = 11;
// After which amount of new messages should the summary be generated
let summarizeInterval = 10;
let variables = {};
let model = "";
// Stream mode does not suite with well with non-tool games, because the logic
// is based on the response text, which should be all available before
// doing conjectures from the input.
let stream = false;
// Applicable with ollama client only. Other clients are always in chat mode
let chat = true;
let summary = "";
let messages = [];
let contextIds = [];
let modelNames = [];
let tools = "";
let assistantPersona = "Snarky Assistant";

// Eleven Labs voice ID: '29vD33N1CtxCmqQRPOHJ' -> Male voice (Drew)
// Deepgram voice ID: 'aura-asteria-en' -> Aura Asteria English
let voiceId = "aura-asteria-en"
// Text to speech service: elevenlabs, deepgram
let textToSpeechService = '';
//let speechToTextService = 'deepgram';

/****************************************************
** Generators
****************************************************/

// Generate a summary of the user's message
const summaryGenerators = {
    "groq": (userMessage, model = "llama3-70b-8192") => {
        return generateSummary(userMessage, model, groqPromptRequest);
    },
    "ollama": (userMessage, model = "llama3") => {
        return generateSummary(userMessage, model, ollamaPromptRequest);
    },
    "anthropic": (userMessage, model = "claude-3-haiku-20240307") => {
        return generateSummary(userMessage, model, claudePromptRequest);
    },
    "openai": (userMessage, model = "gpt-3.5-turbo-0125") => {
        return generateSummary(userMessage, model, gPTPromptRequest);
    }
}

// Generate a response to the user's prompt
const responseGenerators = {
    "groq": sendRequestAndRetrieveResponseGroq,
    "ollama": sendRequestAndRetrieveResponse,
    "anthropic": sendRequestAndRetrieveResponseClaude,
    "openai": sendRequestAndRetrieveResponseGPT
}

// Generate a tool metadata for the prompt
const toolGenerators = {
    "groq": sendRequestAndRetrieveResponseGroq,
    "ollama": sendRequestAndRetrieveResponse,
    "anthropic": sendRequestAndRetrieveResponseClaude,
    "openai": sendRequestAndRetrieveResponseGPT
}

/****************************************************
** Functions
****************************************************/

// Text to speech related

async function tts(text) {

    // tts service not set.
    if (textToSpeechService == '') {
        return;
    }
    // Check if text to speech service exists
    if (!textToSpeechInterfaces[textToSpeechService]) {
        console.warn(`Text to speech service '${textToSpeechService}' is not supported.`);
        return;
    }
    // Check if voice exists
    if (!textToSpeechVoices[textToSpeechService][voiceId]) {
        console.warn(`Voice ID '${voiceId}' is not available for the service '${textToSpeechService}'.`);
        return;
    }
    // Play the text as speech
    try {
        await textToSpeechInterfaces[textToSpeechService](text).catch(error => {
            console.warn(`Error calling ${textToSpeechService}:`, error);
        });
        // Wait for 500ms after the speech function call
        //await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
        console.warn(`Text to speech failed: ${error.message}`);
    }
}

const textToSpeechInterfaces = {
    "elevenlabs": textToSpeechElevenLabs,
    "deepgram": textToSpeechDeepGram
}

const speechToTextInterfaces = {
    "deepgram": speechToTextDeepgram
}

const textToSpeechVoices = {
    "elevenlabs": {
        "29vD33N1CtxCmqQRPOHJ": {
            "name": "Drew",
            "settings": {
                stability: 0.95,
                similarity_boost: 0.75,
                style: 0.06,
                use_speaker_boost: true
            }
        },
    },
    "deepgram": {
        "aura-asteria-en": {
            "name": "Aura Asteria English",
            "settings": {}
        },
    }
}

function speechToTextDeepgram() {
    console.log("Speech to text with Deepgram is not implemented yet.");
}

async function textToSpeechDeepGram(text) {
    try {
        const response = await deepgram.speak.request({ text: text }, { model: voiceId });
        const stream = await response.getStream();
        if (stream) {
            // Using elevenlabs stream player!
            await playStream(stream);
        } else {
            throw new Error("Failed to obtain audio stream.");
        }
    } catch (error) {
        console.warn("An error occurred in textToSpeechDeepGram:", error);
    }
}

/*
async function textToSpeechElevenLabs_(text) {
    elevenLabs.textToSpeech(voiceId, text, "elevenlabs_multilingual_v2", 
        textToSpeechVoices[textToSpeechService][voiceId]["settings"]).then(async (res) => {
            const pipe = await res.pipe;
            pipe(fs.createWriteStream("test-with-pipe.mp3"));
        }
    );
}
*/

async function textToSpeechElevenLabs(text) {
    try {
        const data = {
            text: text,
            model_id: "eleven_multilingual_v2"
        };
        // Ensure voiceId is defined before this call, or pass it as a parameter
        const audio = await elevenlabs.textToSpeech.convertAsStream(voiceId, data);
        await playStream(audio);
        // await play(audio); // Uncomment if this is needed and correct
    } catch (error) {
        console.warn("An error occurred in textToSpeechElevenLabs:", error);
        // Handle or log the error appropriately here
    }
}

/****************************************************
** Tools
****************************************************/

const numberGuessing = (kwargs) => {
    try {
        if (kwargs.init_game) {
            // Initialize a new game and sanitize the arguments
            const min = parseInt(kwargs.init_game.min);
            const max = parseInt(kwargs.init_game.max);
            const guesses = parseInt(kwargs.init_game.guesses);
            // Validate the input
            if (min >= max) {
                return { success: false, message: "Invalid range. The minimum value must be less than the maximum value." };
            }
            if (guesses <= 1) {
                return { success: false, message: "Invalid number of guesses. The number of guesses must be greater than one." };
            }
            numberGuessingGame = createNumberGuessingGame(min, max, guesses);
            return { success: true, message: `New number guessing game initialized with range ${min}-${max} and ${guesses} guesses allowed.` };
        } else if (kwargs.guess_number) {
            // Make a guess
            const number = parseInt(kwargs.guess_number);
            return numberGuessingGame(number);
        } else {
            return { success: false, message: "No valid arguments provided for the game." };
        }
    } catch (error) {
        console.error("Error in number guessing game:", error);
        return { success: false, message: "An error occurred while executing the number guessing game." };
    }
};

const pingPong = (kwargs) => {
    try {
        if (kwargs.user_input) {
            return pingPongGame(kwargs.user_input.trim());
        } else {
            return { success: false, message: "No valid arguments provided for the game." };
        }
    } catch (error) {
        console.error("Error in ping pong game:", error);
        return { success: false, message: "An error occurred while executing the ping-pong game." };
    }
};

const hangman = (kwargs) => {
    try {
        if (kwargs.init_word) {
            // Initialize the game
            const word = kwargs.init_word.trim().toLowerCase();
            return hangmanGame.init(word);
        }
        else if (kwargs.guess_letter) {
            // Play the game, guess a letter
            const letter = kwargs.guess_letter.trim().toLowerCase();
            return hangmanGame.play(letter);
        } else if (kwargs.guess_word) {
            // Guess the word, makes sense to guess the word before all letters are guessed
            const word = kwargs.guess_word.trim().toLowerCase();
            return hangmanGame.guess(word);
        } else {
            return { success: false, message: `No valid arguments ${JSON.stringify(kwargs)} provided for the game.` };
        }
    } catch (error) {
        console.error("Error in hangman game:", error);
        console.log(JSON.stringify({ success: false, message: "An error occurred while executing the hangman game." }));
    }
};

const gameDispatcher = (game, kwargs) => {
    try {
        if (kwargs.init_game) {
            // Initializes a new game
            return game.init();
        } else if (kwargs.player_move) {
            // Player makes a move
            const move = kwargs.player_move.trim().toLowerCase();
            if (!game.elements.includes(move)) {
                return { success: false, message: `Invalid move. Please choose one of ${game.elements.join(', ')}.` };
            }
            return game.playRound(move);
        } else if (kwargs.get_score) {
            // Retrieves the current score
            return game.getScore();
        } else {
            return { success: false, message: `No valid arguments ${JSON.stringify(kwargs)} provided for the game.` };
        }
    } catch (error) {
        console.error(`Error in ${game.name}Game:`, error);
        return { success: false, message: `An error occurred while executing the ${game.name} game.` };
    }
};

function upsertDataEntry({ key, value, key_group = "default" }) {
    if (!key || !value || !key_group) {
        return { success: false, message: "Missing required arguments. Please provide key, value, and key_group." };
    }
    try {
        jsonStorage.upsert(key, value, key_group);
        return { success: true, message: `Data entry with key '${key}' and value '${value}' stored in group '${key_group}'.` };
    } catch (error) {
        return { success: false, message: `Error storing data: ${error.message}` };
    }
}

function retrieveDataEntry({ field, value }) {
    if (!field || !value) {
        return { success: false, message: "Missing required arguments. Please provide field and value." };
    }
    try {
        const result = jsonStorage.retrieve(field, value);
        if (result) {
            return { success: true, message: `Data entry with ${field} '${value}' retrieved successfully.`, data: result };
        } else {
            return { success: false, message: `No data found for ${field} '${value}'.` };
        }
    } catch (error) {
        return { success: false, message: `Error retrieving data: ${error.message}` };
    }
}

function runtimeMemoryDispatcher({ operation, key, value }) {

    if (!key) {
        return { success: false, message: "Missing key argument." };
    }

    switch (operation) {
        case 'set':
            if (value === undefined) {
                return { success: false, message: "Missing value for 'set' operation." };
            }
            return runtimeMemoryStorage.set(key, value);

        case 'get':
            return runtimeMemoryStorage.get(key);

        case 'del':
            return runtimeMemoryStorage.del(key);

        default:
            return { success: false, message: "Invalid operation specified." };
    }
}

async function dynamicContentDispatcher(operationData) {
    const endpoint = 'http://localhost:3000'; // Base URL of your server
    const headers = { 'Content-Type': 'application/json' };

    // Validate operationData
    if (!operationData || !Object.keys(operationData).length) {
        return { success: false, message: "No operation specified." };
    }

    const operation = Object.keys(operationData)[0];
    const params = operationData[operation];

    try {
        let response;
        switch (operation) {
            case 'add_element':
            case 'update_element':
                if (!params.id || params.content === undefined) {
                    return { success: false, message: "Missing 'id' or 'content' required for operation." };
                }
                response = await fetch(`${endpoint}/element`, {
                    method: operation == 'add_element' ? 'POST' : 'PUT',
                    headers: headers,
                    body: JSON.stringify({ id: params.id, content: params.content })
                });
                break;

            case 'delete_element':
                if (!params.id) {
                    return { success: false, message: "Missing 'id' required for deletion." };
                }
                response = await fetch(`${endpoint}/element`, {
                    method: 'DELETE',
                    headers: headers,
                    body: JSON.stringify({ id: params.id })
                });
                break;

            case 'update_js':
            case 'update_css':
                if (params.content === undefined) {
                    return { success: false, message: "Missing 'content' required for updating JS or CSS." };
                }
                response = await fetch(`${endpoint}/${operation}`, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({ content: params.content })
                });
                break;

            case 'revert_changes':
                if (!params.commitHash) {
                    return { success: false, message: "Missing 'commitHash' required for reverting changes." };
                }
                response = await fetch(`${endpoint}/revert`, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({ commitHash: params.commitHash })
                });
                break;
            
            case 'commits':
                const queryParams = new URLSearchParams();
                Object.entries(params.filters).forEach(([key, value]) => {
                    if (value) queryParams.append(key, value);
                });
                response = await fetch(`${endpoint}/commits?${queryParams.toString()}`, {
                    method: 'GET',
                    headers: headers
                });
                break;

            default:
                return { success: false, message: "Invalid operation specified." };
        }
        // Check response status and parse JSON
        if (response.ok) {
            const data = await response.json();
            return { success: true, data };
        } else {
            return { success: false, message: `Server responded with status: ${response.status}  ${response.message}` };
        }
    } catch (error) {
        console.error('Error with API request:', error);
        return { success: false, message: "Failed to execute API request.", error };
    }
}

const functionToolCallbacks = {
    "hangman": hangman,
    "nodejs_code_runner": nodeCodeRunner,
    "number_guessing_game": numberGuessing,
    "ping_pong_game": pingPong,
    "fire_water_grass": (kwargs) => gameDispatcher(fireWaterGrassGame, kwargs),
    "rock_paper_scissors": (kwargs) => gameDispatcher(rockPaperScissorsGame, kwargs),
    "upsert_data_entry": upsertDataEntry,
    "retrieve_data_entry": retrieveDataEntry,
    "dynamic_content_management": dynamicContentDispatcher,
    "runtime_memory_storage": runtimeMemoryDispatcher
};

/****************************************************
** Other functions
****************************************************/

/**
 * Get the current timestamp in the format 'YYYY-MM-DD_HH-MM-SS'
 * 
 * @returns {string} - Current timestamp in the format 'YYYY-MM-DD_HH-MM-SS'
 */
function getCurrentTimestamp() {
    const date = new Date();
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0'); // months are 0-indexed
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}

function extractTextByLimiters(inputText) {
    // Define the regular expression to capture text between ===START=== and ===END===
    const regex = /===START===(.*?)===END===/s;
    // Use the regular expression to find matches
    const match = inputText.match(regex);
    // Check if we found a match
    if (match && match[1]) {
        // Return the trimmed text captured between the delimiters
        return match[1].trim();
    } else {
        // Return a default value or handle the absence of a match
        throw `Unable to extract summary from the input text: ${inputText}.`;
    }
}

async function getOllamaModelNames() {
    try {
        // Send a GET request to the API
        const response = await axios.get(`${baseUrl}/api/tags`);
        // Assuming the response data structure is as described
        const models = response.data.models;
        // Extract model names
        return models.map(model => model.name.replace(":latest", ""));
    } catch (error) {
        console.warn('Error fetching model names:', error);
        return [];
    }
}

function getGroqModelNames() {
    return groqModelNames;
}

function getAnthropicModelNames() {
    return anthropicModelNames;
}

function getOpenAIModelNames() {
    return openAIModelNames;
}

async function groqChatRequest(chat_messages, model, temperature = 0.0, max_tokens = 1024, top_p = 1, stop = null, stream = false, json = false) {
    let options = {
        "messages": chat_messages,
        "model": model,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "top_p": top_p,
        "stream": stream,
        "stop": stop
    };
    if (json) {
        options.response_format = { "type": "json_object" };
    }
    const chatCompletion = await groq.chat.completions.create(options);
    if (stream) {
        return chatCompletion;
    }
    return { text: chatCompletion.choices[0].message.content.trim() };
}

async function gPTChatRequest(chat_messages, model, temperature = 0.0, max_tokens = 1024, top_p = 1, stop = null, stream = false, json = false) {
    let options = {
        "messages": chat_messages,
        "model": model,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "top_p": top_p,
        "stream": stream,
        "stop": stop,
        //"frequency_penalty": 0,
        //"presence_penalty": 0
    };
    if (json) {
        options.response_format = { "type": "json_object" };
    }
    const chatCompletion = await openai.chat.completions.create(options);
    if (stream) {
        return chatCompletion;
    }
    return { text: chatCompletion.choices[0].message.content.trim() };
}

async function claudeChatRequest(chat_messages, model, temperature = 0.0, max_tokens = 1024, top_p = 1, stop = null, stream = false, json = false) {
    let options = {
        // Get all the rest except the first item in the chat messages array
        "messages": chat_messages.slice(1),
        "model": model,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "top_p": top_p,
        //"metadata": { user_id: '13803d75-b4b5-4c3e-b2a2-6f21399b021b' },
        //"top_k": 0.7,
        "stream": stream,
        // Get the first item content for system message
        "system": chat_messages[0].content,
        "stop_sequences": stop ? [stop] : []
    };
    /*
    if (json) {
        options.response_format = {"type": "json_object"};
    }
    */
    const chatCompletion = await anthropic.messages.create(options);
    if (stream) {
        return chatCompletion;
    }
    // Anthropic is cool to provide the usage information as well:
    // chatCompletion.usage: { input_tokens: 174, output_tokens: 27 }
    return { text: chatCompletion.content[0].text.trim() };
}

async function promptRequest(chatRequest, prompt, model, system = "", temperature = 0.0, max_tokens = 1024, top_p = 1, stop = null, stream = false) {

    let chatMessages = []
    if (system) {
        chatMessages.push({ role: "system", content: system });
    }
    chatMessages.push({ role: "user", content: prompt });

    return chatRequest(chatMessages, model, temperature, max_tokens, top_p, stop, stream);
}

async function groqPromptRequest(prompt, model, system = "", temperature = 0.0, max_tokens = 1024, top_p = 1, stop = null, stream = false) {
    return promptRequest(groqChatRequest, prompt, model, system, temperature, max_tokens, top_p, stop, stream);
}

async function gPTPromptRequest(prompt, model, system = "", temperature = 0.0, max_tokens = 1024, top_p = 1, stop = null, stream = false) {
    return promptRequest(gPTChatRequest, prompt, model, system, temperature, max_tokens, top_p, stop, stream);
}

async function claudePromptRequest(prompt, model, system = "", temperature = 0.0, max_tokens = 1024, top_p = 1, stop = null, stream = false) {
    return promptRequest(claudeChatRequest, prompt, model, system, temperature, max_tokens, top_p, stop, stream);
}

async function ollamaChatRequest(chatMessages, model, temperature = 0.0, max_tokens = 1024, top_p = 1, stop = null, stream = false) {
    const data = {
        model: model,
        stream: stream,
        options: {
            temperature: temperature,
            num_predict: max_tokens,
            top_p: top_p,
            //top_k: top_k,
            stop: stop
        },
        messages: chatMessages
    };

    // TODO: json format?

    const config = {
        method: 'post',
        url: `${baseUrl}/api/chat`,
        data: data,
        timeout: 30000
    };

    try {
        if (stream) {
            config.responseType = 'stream';
        }
        const response = await axios(config);
        if (stream) {
            // If streaming, handle the response as a stream
            return response.data;
        } else {
            // If not streaming, parse and return the response text
            return {
                text: response.data.message.content.trim(),
                // In chat mode context is not given
                context: []
            };
        }
    } catch (error) {
        console.error("Chat request failed:", error);
        return { error: error.message };
    }
}

async function ollamaPromptRequest(prompt, model, system = "", temperature = 0.0, max_tokens = 1024, top_p = 1, stop = null, context = [], stream = false) {

    const data = {
        model: model,
        stream: stream,
        options: {
            temperature: temperature,
            num_predict: max_tokens,
            top_p: top_p,
            //top_k: top_k,
            stop: stop ? (Array.isArray(stop) ? stop : [stop]) : null
        },
        prompt: prompt,
        context: context,
        system: system
        // format does not work, produces timeout
        //format: "json"
    };

    const config = {
        method: 'post',
        url: `${baseUrl}/api/generate`,
        data: data,
        timeout: 30000
    };

    if (stream) {
        config.responseType = 'stream';
    }
    const response = await axios(config);
    if (stream) {
        return response.data;
    }
    return {
        text: response.data.response.trim(),
        context: response.data?.context || []
    };
}

async function generateSummary(userMessage, model, callback) {
    try {
        const system = getPrompt("summarySystemPrompt", llmClient, model).replace("<<previous_summary>>", (messages.length > messageLimit ? summary : 'n/a'))
        return callback(userMessage, model, system, 0.0, 1024, 1);
    } catch (error) {
        return { error: `An error occurred in generate summary: ${error.message}`, text: "" };
    }
}

function saveMessageToFile(message) {
    message['created'] = getCurrentTimestamp();
    fs.appendFileSync(sessionFile, JSON.stringify(message) + "\n");
}

function appendAndGetMessages(text, role = 'user', count = 49, slice = false) {

    if (slice) {
        let localMessages = messages.slice();
        if (localMessages.length > 0 && localMessages[localMessages.length - 1].role === role) {
            localMessages[localMessages.length - 1].content = ` ${text}`;
        } else {
            localMessages.push({ role, content: text });
        }
        return localMessages.slice(Math.max(localMessages.length - count, 0));
    }

    if (messages.length > 0 && messages[messages.length - 1].role === role) {
        messages[messages.length - 1].content += ` ${text}`;
    } else {
        messages.push({ role, content: text });
    }
    return messages.slice(Math.max(messages.length - count, 0));
}

// Function to measure execution time of async functions and log to file
async function profileAsyncOperation(operation, functionName, ...args) {
    const logFile = path.join(__dirname, performanceLogFilepath);
    // console.log(`\x1B[33m✍  Writing performance log to: ${logFile}\x1B[0m`);
    const obs = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const measure = entries[0];
        // Log entry format: client;model;function;duration
        const logEntry = `${llmClient};${model};${measure.name};${measure.duration.toFixed(2)}\n`;
        //console.log(`\x1B[33m✍  ${logEntry}\x1B[0m`);
        // Append the log entry to the file
        fs.appendFile(logFile, logEntry, (err) => {
            if (err) {
                console.error('Failed to write to log file:', err);
            }
        });
        obs.disconnect();
    });
    // Start observing performance entry types "measure"
    obs.observe({ entryTypes: ['measure'], buffered: true });
    performance.mark('start-operation');
    // Execute the async operation
    const result = await operation(...args);
    performance.mark('end-operation');
    // Measure the duration between marks
    performance.measure(functionName, 'start-operation', 'end-operation');
    //console.log(`\x1B[33m✍  Profiled operation completed.\x1B[0m`);
    return result;
}

async function summarizeMessages(userMessages) {

    // Generate summary
    const summaryInputText = userMessages.map((msg, index) =>
        `${index % 2 === 0 ? 'User:' : 'Assistant:'} ${msg.content}`).join('\n');

    if (summaryInputText.length == 0) {
        console.log(`\x1B[33m✍  Nothing to summarize.\x1B[0m`);
        return;
    }
    console.log(`\x1B[33m✍  Summarizing...\x1B[0m`);
    try {
        //console.log(`\x1B[33m✍  Summary data: ${summaryInputText}\x1B[0m`);
        const summaryResult = await profileAsyncOperation(summaryGenerators[llmClient], "summarizeMessages", summaryInputText);
        //console.log(`\x1B[33m✍  Summary: ${summaryResult.text}\x1B[0m`);
        if (summaryResult.error) {
            console.warn(`Error generating summary: ${summaryResult.error}`);
        } else if (summaryResult.text) {
            summaryTemp = extractTextByLimiters(summaryResult.text);
            if (summaryTemp) {
                summary = summaryTemp;
                saveMessageToFile({ summary: summary });
            }
        } else {
            throw "Empty summary received from API.";
        }
    } catch (error) {
        console.error(error.message);
    }
}

function checkForSummarization() {
    // Every 10 user messages
    const user_messages = messages.filter(msg => msg.role == "user" || msg.role == "assistant");
    const messageCount = user_messages.length;
    if (summarizeInterval > 0 && messageCount % summarizeInterval === 0 && messageCount !== 0) {
        // This gets the last ten messages
        let messagesToSummarize = user_messages.slice(-summarizeInterval);
        summarizeMessages(messagesToSummarize);
    }
}

async function sendRequestAndRetrieveResponseGPT(prompt, systemPrompt = "", temperature = 1.0, json = false, slice = false) {

    saveMessageToFile({ role: "user", content: prompt, system: systemPrompt })
    checkForSummarization();

    try {

        if (stream) {
            return gPTChatRequest([{ role: "system", content: systemPrompt }, ...appendAndGetMessages(prompt, role = 'user', count = messageLimit, slice = slice)], model, temperature, max_tokens = 1024, top_p = 1, stop = null, stream = true, json = JsonStorage);
        } else {
            const chatCompletion = await gPTChatRequest([{ role: "system", content: systemPrompt }, ...appendAndGetMessages(prompt, role = 'user', count = messageLimit, slice = slice)], model, temperature, max_tokens = 1024, top_p = 1, stop = null, stream = false, json = json);
            return { text: chatCompletion.text, context: [] };
        }
    } catch (error) {
        return { error: `An error occurred in GPT response: ${error.message}` };
    }
}

async function sendRequestAndRetrieveResponseClaude(prompt, systemPrompt = "", temperature = 1.0, json = false, slice = false) {

    saveMessageToFile({ role: "user", content: prompt, system: systemPrompt })
    checkForSummarization();

    try {

        if (stream) {
            return claudeChatRequest([{ role: "system", content: systemPrompt }, ...appendAndGetMessages(prompt, role = 'user', count = messageLimit, slice = slice)], model, temperature, max_tokens = 1024, top_p = 1, stop = null, stream = true, json = json);
        } else {
            const chatCompletion = await claudeChatRequest([{ role: "system", content: systemPrompt }, ...appendAndGetMessages(prompt, role = 'user', count = messageLimit, slice = slice)], model, temperature, max_tokens = 1024, top_p = 1, stop = null, stream = false, json = json);
            return { text: chatCompletion.text, context: [] };
        }
    } catch (error) {
        return { error: `An error occurred in Claude response: ${error.message}` };
    }
}

async function sendRequestAndRetrieveResponseGroq(prompt, systemPrompt = "", temperature = 1.0, json = false, slice = false) {

    saveMessageToFile({ role: "user", content: prompt, system: systemPrompt })
    checkForSummarization();

    try {

        if (stream) {
            return groqChatRequest([{ role: "system", content: systemPrompt }, ...appendAndGetMessages(prompt, role = 'user', count = messageLimit, slice = slice)], model, temperature, max_tokens = 1024, top_p = 1, stop = null, stream = true, json = json);
        } else {
            const chatCompletion = await groqChatRequest([{ role: "system", content: systemPrompt }, ...appendAndGetMessages(prompt, role = 'user', count = messageLimit, slice = slice)], model, temperature, max_tokens = 1024, top_p = 1, stop = null, stream = false, json = json);
            return { text: chatCompletion.text, context: [] };
        }
    } catch (error) {
        return { error: `An error occurred in groq response: ${error.message}` };
    }
}

async function sendRequestAndRetrieveResponse(prompt, systemPrompt = "", temperature = 1.0, json = false, slice = false) {

    // Define the base data object
    let messageData = {
        role: "user",
        content: prompt,
        system: systemPrompt
    };

    // Conditionally add context only if not in chat mode
    if (!chat) {
        messageData.context = contextIds;
    }

    saveMessageToFile(messageData);
    checkForSummarization();

    try {
        if (chat) {
            return ollamaChatRequest([{ role: "system", content: systemPrompt }, ...appendAndGetMessages(prompt, role = 'user', count = messageLimit, slice = slice)], model, temperature, 1024, 1, null, stream);
        } else {
            return ollamaPromptRequest(prompt, model, systemPrompt, temperature, 1024, 1, null, contextIds, stream);
        }
    } catch (error) {
        return { error: `An error occurred in ollama response: ${error.message}` };
    }
}

/****************************************************
** Spinner
****************************************************/

function hideCursor() {
    process.stdout.write('\x1B[?25l');
}

function showCursor() {
    process.stdout.write('\x1B[?25h');
}

function spinner() {
    const spinnerChars = ['\x1b[31m⬤\x1b[0m', '\x1b[31m◯\x1b[0m'];
    let i = 0;
    hideCursor();
    const interval = setInterval(() => {
        if (stopSpinner.isStopped) {
            clearInterval(interval);
            showCursor();
            process.stdout.write('\r' + ' '.repeat(40) + '\r');
            return;
        }
        const chars = spinnerChars[i++ % spinnerChars.length];
        if (chars) {
            process.stdout.write(`\r${chars}`);
        }
    }, 500);
    return interval;
}

async function spinRequest(prompt, slice = false) {

    if (prompt == "") {
        return { error: "An error occurred: Empty prompt." };
    }

    stopSpinner.isStopped = false;
    const spinnerThread = spinner(stopSpinner);
    const system_prompt = getPrompt("systemPrompt", llmClient, model).
        replace("<<assistant_persona>>", assistantPersonas[assistantPersona]).
        replace(/<<model>>/g, `${assistantPersona} (${model})`).
        replace("<<function_calling_tools>>", tools ? JSON.stringify(tools) : 'n/a').
        // Secret vault can be used in non-streaming mode only
        // It is hard to detect code block and remove them from the streaming output
        //replace("<<miscallaneous_tools>>", (stream ? "n/a" : getPrompt("secretVaultPrompt", llmClient, model).
        //replace("<<vault>>", JSON.stringify(secretVault)))).
        // Start keeping the latest cumulative summary on the system prompt when message limit has been exceeded
        replace("<<summary>>", (summary ? summary : 'n/a')).
        replace("<<global_variables>>", JSON.stringify(variables));

    // responseGenerators could provide the rest of the llm request parameters?
    const response = await profileAsyncOperation(responseGenerators[llmClient], "spinRequest", prompt, system_prompt, temperature, json = false, slice = slice);
    stopSpinner.isStopped = true;
    clearInterval(spinnerThread);
    console.log(`spinRequest response: ${response}`);
    return response;
}

async function toolRequest(prompt) {

    if (prompt == "") {
        return { error: "An error occurred: Empty prompt." };
    }

    stopSpinner.isStopped = false;
    const spinnerThread = spinner(stopSpinner);
    const system_prompt = system_message_metadata;

    // responseGenerators could provide the rest of the llm request parameters?
    const response = await profileAsyncOperation(toolGenerators[llmClient], "toolRequest", prompt, system_prompt, 0.0, json = true);
    stopSpinner.isStopped = true;
    clearInterval(spinnerThread);
    console.log(`toolRequest response: ${response}`);
    return response;
}

/****************************************************
** In-app commands
****************************************************/

async function processUserInput(input, withToolRequest = true) {

    const prompt = input.trim();

    if (prompt.toLowerCase() === '\\exit') {
        await onExit();
        return;
    }

    if (prompt.toLowerCase() === '\\info') {
        printInfo();
        return;
    }

    if (prompt.toLowerCase() === '\\histogram') {
        const logFile = path.join(__dirname, performanceLogFilepath);
        console.log(`\n\x1B[33m✍  Generating histogram from: ${logFile}\x1B[0m\n`);
        generateHistogram(logFile);
        return;
    }

    if (prompt.startsWith("\\set ")) {
        handleSetCommand(prompt);
        rl.prompt();
        return;
    }


    if (prompt.startsWith("\\messages")) {
        handleMessageCommand(prompt);
        rl.prompt();
        return;
    }

    if (prompt.startsWith("\\get")) {
        handleGetCommand(prompt);
        rl.prompt();
        return;
    }

    if (prompt.startsWith("\\stream")) {
        stream = toggler(prompt, stream);
        console.log(`Stream is ${stream ? "on" : "off"}`);
        rl.prompt();
        return;
    }

    if (prompt.startsWith("\\chat")) {
        if (llmClient !== "ollama") {
            console.warn("Chat mode is variable only in ollama client.");
        } else {
            chat = toggler(prompt, chat);
            console.log(`Chat mode is ${chat ? "on" : "off"}`);
        }
        rl.prompt();
        return;
    }

    if (prompt.startsWith("\\audio ")) {
        try {
            textToSpeechService = switchTTSService(prompt);
        } catch (error) {
            console.warn(error);
        }
        rl.prompt();
        return;
    }

    if (prompt.startsWith("\\model ")) {
        try {
            model = switchModel(prompt);
        } catch (error) {
            console.warn(error);
        }
        rl.prompt();
        return;
    }

    if (prompt.startsWith("\\window_size ")) {
        const parts = prompt.split(" ");
        try {
            const size = parseInt(parts[1]);
            if (size > 2) {
                messageLimit = size;
            } else {
                throw "Given window size is not acceptable. It must be integer and bigger than 2."
            }
        } catch (error) {
            console.warn(error);
        }
        rl.prompt();
        return;
    }

    if (prompt.startsWith("\\summarize")) {
        const parts = prompt.split(" ");
        try {
            if (parts.length == 2 && parts[1].trim() != "") {
                const value = parseInt(parts[1]);
                if (value == 0 || value > 2) {
                    summarizeInterval = value;
                } else {
                    throw "Given interval is not acceptable. It must be zero or bigger than two."
                }
            } else {
                summarizeMessages(messages.filter(msg => msg.role == "user" || msg.role == "assistant"));
            }
        } catch (error) {
            console.warn(error);
        }
        rl.prompt();
        return;
    }

    if (prompt === "") {
        // Create a newline with the arrow
        rl.prompt();
        return;
    }

    if (prompt.startsWith("\\secret")) {
        if (stream) {
            console.warn("Secret vault tools are not supported in streaming mode. Use \\stream to switch off.");
        } else {
            revealSecretKey(prompt);
        }
        rl.prompt();
        return;
    }

    //console.log(`\x1B[38;5;45m${prompt}\x1B[0m`);
    let toolRequestResult = withToolRequest && tools ? await toolRequest(prompt) : null;
    await handleToolsResponse(toolRequestResult, prompt);
    showCursor();
}

// Function to process the CSV file and display histogram
function generateHistogram(filePath) {
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    const performanceData = {};

    rl.on('line', (line) => {
        const parts = line.split(';');
        if (parts.length >= 4) {
            const client = parts[0];
            const category = parts[1];
            const time = parseFloat(parts[3]);

            if (!performanceData[client]) {
                performanceData[client] = {};
            }
            if (!performanceData[client][category]) {
                performanceData[client][category] = [];
            }

            performanceData[client][category].push(time);
        }
    });

    rl.on('close', () => {
        const averagePerformance = {};
        let maxAverage = 0;

        // Calculating average times for each category within each client
        for (const client in performanceData) {
            averagePerformance[client] = {};
            for (const category in performanceData[client]) {
                const times = performanceData[client][category];
                const average = times.reduce((acc, curr) => acc + curr, 0) / times.length;
                averagePerformance[client][category] = average;
                if (average > maxAverage) {
                    maxAverage = average;
                }
            }
        }

        // Display histogram
        for (const client in averagePerformance) {
            console.log(`${client}`);
            for (const category in averagePerformance[client]) {
                const average = averagePerformance[client][category];
                // Scale bar to max 50 characters
                const barLength = Math.floor((average / maxAverage) * 50);
                console.log(`  ${category.padEnd(20, ' ')} [${'='.repeat(barLength)}>${'.'.repeat(50 - barLength)}] ${average.toFixed(2)}`);
            }
            // Add a blank line for better separation
            console.log();
        }
    });
}

// Secret vault key names: \x1B[38;5;45m[${secretVault ? Object.keys(secretVault).join(', ') : 'n/a'}]\x1B[0m
function printInfo() {

    console.log(`

   Commands
   --------
   \x1B[38;5;45m\\exit\x1B[0m                - exit the chat
   \x1B[38;5;45m\\info\x1B[0m                - print this help
   \x1B[38;5;45m\\set <key> <value>\x1B[0m   - set a global variable into a system prompt
   \x1B[38;5;45m\\get [<key>]\x1B[0m         - get global variable(s)
   \x1B[38;5;45m\\window_size <value>\x1B[0m - set a context message window size to limit the message count
                          to send context for LLM inference.
   \x1B[38;5;45m\\stream <true|false>\x1B[0m - toggle stream mode
   \x1B[38;5;45m\\messages <int>\x1B[0m      - get the prompt message from the list by index, or all messages
   \x1B[38;5;45m\\secret <key>\x1B[0m        - retrieve value from vault, functional only in non-streaming mode
   \x1B[38;5;45m\\chat <true|false>\x1B[0m   - toggle between chat and prompt mode (internally different behaviour)
   \x1B[38;5;45m\\model <model>\x1B[0m       - switch to a different model. 'ollama run <model>' first to download the model
   \x1B[38;5;45m\\summarize [<int>]\x1B[0m   - summarize the current discussion. Optional number argument to set
                          the message interval (0 = never) for automatic conversation summarization
   \x1B[38;5;45m\\audio\x1B[0m               -  activate text-to-speech audio service (${ttsServices.join(", ")})

   Current settings
   ----------------
   - LLM client:        \x1B[38;5;45m${llmClient}\x1B[0m
   - Model:             \x1B[38;5;45m${model}\x1B[0m
   - Stream mode:       \x1B[38;5;45m${stream}\x1B[0m
   - Chat mode:         \x1B[38;5;45m${chat}\x1B[0m (variable only in ollama client)
   - Window size:       Last \x1B[38;5;45m${messageLimit}\x1B[0m messages
   - Summary interval   Every \x1B[38;5;45m${summarizeInterval}\x1B[0m messages
   - Text-to-speech     '\x1B[38;5;45m${textToSpeechService}\x1B[0m'
   
   Assistant persona (${assistantPersona}): \x1B[38;5;45m${assistantPersonas[assistantPersona]}\x1B[0m

   Global variables: \x1B[38;5;45m${JSON.stringify(variables, null, 2)}\x1B[0m
   
   System prompt: \x1B[38;5;45m${getPrompt("systemPrompt", llmClient, model)}\x1B[0m
    
   Summary: \x1B[38;5;45m${summary ? summary : "n/a"}\x1B[0m
    
   [PICK COMMAND OR HIT ENTER TO CONTINUE]`);
}

function toggler(command, currentValue) {
    // Split the command and check if there's more than one part.
    const parts = command.trim().split(" ");
    // If only the command is present without specific instructions, toggle the current state
    if (parts.length === 1) {
        return !currentValue;
    }
    // If additional argument is provided, determine the new state based on the argument
    const arg = parts[1].toLowerCase();
    return arg === "true" || arg === "on" || arg === "1" || arg === "t";
}

function handleSetCommand(command) {
    // command = 'set key_word "value can be anything"'
    const key = command.split(" ")[1];
    // Initialize a variable for the value
    let value;
    // Finds the start of the potential quoted value
    const firstQuoteIndex = command.indexOf('"');
    if (firstQuoteIndex !== -1) {
        // There's a starting quote, find the closing quote
        const lastQuoteIndex = command.lastIndexOf('"');
        // Extract the value inside the quotes
        value = command.substring(firstQuoteIndex + 1, lastQuoteIndex);
    } else {
        // No quotes, take the entire string after the key
        value = command.substring(command.indexOf(key) + key.length).trim();
    }
    let data = {}
    data[key] = value;
    Object.assign(variables, data);
}

function handleGetCommand(command) {
    const parts = command.split(" ");

    if (parts.length === 1) {
        // If the command is just "get", print all variables
        console.log(variables);
    } else if (parts.length > 1) {
        // Assume the second part is the key
        const key = parts[1];

        // Check if the key exists in the variables
        if (variables.hasOwnProperty(key)) {
            // Output the value associated with the key
            console.log(variables[key]);
        } else {
            // Key not found, output a default message or handle the error
            console.log('Key not found');
        }
    }
}

function handleMessageCommand(command) {
    const parts = command.split(" ");

    if (parts.length === 1) {
        // If the command is just "get", print all variables
        console.log(messages);
    } else if (parts.length > 1) {
        // Assume the second part is the key
        const index = parseInt(parts[1]);

        // Check if the key exists in the variables
        if (index < messages.length && index >= 0) {
            // Output the value associated with the key
            console.log(messages[index]);
        } else {
            // Key not found, output a default message or handle the error
            console.log('Index not found');
        }
    }
}

function switchModel(command) {
    // Placeholder to switch between models
    const model = command.split(" ")[1];
    if (modelNames.includes(model)) {
        return model;
    } else {
        throw new Error(`Invalid model name. Use one of the following: ${modelNames.join(", ")}`);
    }
}

function switchTTSService(command) {
    // Placeholder to switch between tts services
    const service = command.split(" ")[1];
    if (ttsServices.includes(service)) {
        return service;
    } else {
        throw new Error(`Invalid model name. Use one of the following: ${ttsServices.join(", ")}`);
    }
}

async function splitAndPlayTextToSpeech(text) {
    // Remove any text between asterisks
    const cleanText = text.replace(/\*.*?\*/g, '');

    // Split the cleaned text into lines
    const lines = cleanText.split('\n');
    const parts = [];

    // Further process each line
    for (let line of lines) {
        line = line.trim();
        if (!line) continue;  // Skip empty lines

        // Check if the line starts with a list item or is a standalone sentence
        if (/^\d+\.\s|^\w+\)\s|^[•a-zA-Z]\.\s/.test(line)) {
            // Directly treat this as a part if it's clearly a list item
            parts.push(line);
        } else {
            // Further split non-list lines by sentence delimiters
            const subParts = line.split(/(?<=[.!?])\s+(?=[A-Z])/);
            parts.push(...subParts.map(subPart => subPart.trim()));
        }
    }

    // Play each sentence using text-to-speech if it is not an empty string
    let countParts = 0;
    let sentences = "";
    for (let part of parts) {
        if (part !== "") {
            // If part does not end with any of the punctuation marks, add a period
            if (!part.endsWith(".") && !part.endsWith("!") && !part.endsWith("?") && !part.endsWith(":") && !part.endsWith(";")) {
                part += ".";
            }
            countParts++;
            sentences += part + " ";
            // Play three parts at once
            if (countParts > 2) {
                await tts(sentences);
                sentences = "";
                countParts = 0;
            }
        }
    }

    if (sentences !== "") {
        await tts(sentences);
    }
}

function getBaseDir() {
    const chatsFolderName = 'chats';
    const pathSegments = __dirname.split(path.sep);
    const chatsFolderIndex = pathSegments.lastIndexOf(chatsFolderName);

    if (chatsFolderIndex !== -1 && chatsFolderIndex === pathSegments.length - 1) {
        return path.join(...pathSegments.slice(0, -1));
    } else {
        return __dirname;
    }
}

async function fetchSummaryAndMessages(dirName = null) {
    const baseDir = getBaseDir();
    let dirPath;

    console.log(`Base directory: ${baseDir} ${dirName}`);

    if (!dirName || dirName === "recent") {
        try {
            const dirs = await fs.promises.readdir(baseDir + path.sep + "chats", { withFileTypes: true });
            const sortedDirs = dirs.filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name)
                .sort((a, b) => {
                    const formatDateString = dateString => dateString.replace(/(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})/, '$1T$2').replace(/-/g, ':');
                    return new Date(formatDateString(b)) - new Date(formatDateString(a));
                });
            if (sortedDirs.length > 0) {
                for (let i = 1; i < sortedDirs.length; i++) {
                    if (fs.existsSync(path.join(baseDir, "chats", sortedDirs[sortedDirs.length - i], 'session.jsonl'))) {
                        dirPath = path.join(baseDir, "chats", sortedDirs[sortedDirs.length - i]);
                        break;
                    }
                }
            } else {
                console.log("No directories found.");
                return "No directories found in the base folder.";
            }
        } catch (error) {
            console.error(`Error reading directory: ${error.message}`);
            return `Error reading directory: ${error.message}`;
        }
    } else {
        dirPath = path.join(baseDir, dirName);
    }

    const filePath = path.join(dirPath, 'session.jsonl');

    try {
        const data = await fs.promises.readFile(filePath, 'utf8');
        const lines = data.split('\n').filter(line => line.trim());
        let messages = [];
        let lastSummary = null;

        lines.forEach(line => {
            const jsonData = JSON.parse(line);
            if (jsonData.summary) {
                lastSummary = jsonData.summary;
            } else if (["user", "assistant"].includes(jsonData.role) && jsonData.content) {
                messages.push(`---\n${jsonData.role}: ${jsonData.content.trim()}`);
            }
        });

        if (lastSummary) {
            messages.push(`---\n${lastSummary}`);
        }
        return "[" + path.basename(dirPath) + "]\n" + messages.join('\n');
    } catch (error) {
        console.error(`Error reading file: ${error.message}`);
        return `Error reading file: ${error.message}`;
    }
}


/****************************************************
** Main response handler and bootstrap functions
****************************************************/

async function handleToolsResponse(response, prompt) {
    //console.log(response);
    // There is the previous response available
    if (response) {

        if (response.error) {
            console.error(response.error.message);
            await handleResponse(await spinRequest(prompt, true));
            return;
        }

        let extractedMetadata = extractAndParseJsonBlock(response.text, tools);

        console.log("extractedMetadata.result.tools", extractedMetadata.result.tools);

        if (extractedMetadata.success) {

            async function handleTools() {
                //const metadataTopics = extractedMetadata.result.topics || [];
                //const metadataIntent = extractedMetadata.result.intent || "";
                const functionCallingTools = extractedMetadata.result.tools || [];
                let userMessages = [];
                // If tools enumerate them and callback with arguments
                if (functionCallingTools.length) {

                    //userMessages.push("Role: system.");
                    const metadataMessage = `Function calling tools set in queue: ${JSON.stringify({ tools: functionCallingTools })}. Do not repeat or use the JSON code in the response.`;
                    appendAndGetMessages(metadataMessage, 'assistant');
                    saveMessageToFile({ role: "system", content: metadataMessage });

                    let i = 0;
                    for (let item of functionCallingTools) {
                        console.log(item);
                        let toolName = item.tool;
                        let toolArguments = item.arguments;
                        //let detailsAreMissing = item.details_are_missing;
                        //let runToolInChain = item.arguments_can_be_initialized_only_after_retrieving_previous_tool_results;
                        /*if (detailsAreMissing) {
                            console.warn(`Details are missing for the tool: ${toolName}`);
                            prompt = `Role: system. Details are missing for the tool: ${toolName}.`;
                        } else if (runToolInChain) {
                            // Set tool call and response to messages
                            console.log("Run tool in chain");
                            //let  response = await toolRequest(toolName);
                            //handleToolsResponse(response);
                        } else */if (toolName in functionToolCallbacks) {
                            // Check arguments against schema
                            //console.log("Tool arguments:", toolArguments);
                            let functionCallResult = await functionToolCallbacks[toolName](toolArguments);
                            //console.log(functionCallResult);
                            //const systemMessage = `Role: system. Called tool ${i} with given arguments. Waiting for output...`;
                            const userMessage = `Tool ${i} executed with results: ${JSON.stringify(functionCallResult)}.`;
                            //appendAndGetMessages(systemMessage, 'assistant');
                            //saveMessageToFile({role: "system", content: systemMessage});
                            //appendAndGetMessages(userMessage, 'user');
                            // Return result / consoleOutput
                            // What to do now because message is already in the
                            //console.log(userMessage);
                            userMessages.push(userMessage);
                        }
                        i++;
                    }
                }
                if (userMessages.length > 0) {

                    await handleResponse(await spinRequest(userMessages.join('\n')));

                    /*
                    const response2 = await spinRequest(userMessages.join('\n'));
                    if (response2.text) {
                        extractedMetadata = extractAndParseJsonBlock(response2.text);
                        if (extractedMetadata.success) {
                            await handleTools();
                        }
                    } else {
                        await handleResponse(response);
                    }
                    */

                } else {
                    console.log("No user messages generated.");
                    await handleResponse(await spinRequest(prompt, true));
                }
            }
            await handleTools();

        } else {
            console.log("No tools found in the response.");
            await handleResponse(await spinRequest(prompt, true));
        }
        // Previous response has not been provided
    } else {
        await handleResponse(await spinRequest(prompt));
    }
}

async function handleResponse(response) {
    // This checks if the response object is from Axios
    let assistantMessage = "";
    if (response.on) {
        let audioTextSteamBuffer = "";
        process.stdout.write("\r\x1B[32m⬤\x1B[0m  ");
        response.on('data', async (chunk) => {
            try {
                const textChunkDict = JSON.parse(chunk.toString());
                if (!textChunkDict.done) {
                    const content = chat ? textChunkDict.message?.content : textChunkDict.response;
                    if (content !== "") {
                        audioTextSteamBuffer += content;
                        // If the content ends with a sentence delimiter, play the audio
                        // Lenghth of the buffer is checked to avoid chopping sentences too short for fluid playing
                        if (/(?<![a-zA-Z0-9]\.)[.!?;:]/.test(content) && audioTextSteamBuffer.length > 15) {
                            await tts(audioTextSteamBuffer);
                            audioTextSteamBuffer = "";
                        }
                        assistantMessage += content;
                        if (content.trim() !== "") {
                            process.stdout.write(content);
                        }
                    }
                } else {
                    // Update the contextIds if the response has context
                    // This is used in ollama prompt request mode
                    if (!chat && llmClient == "ollama") {
                        contextIds = textChunkDict.context;
                    }
                    process.stdout.write("\n");
                }
            } catch (error) {
                console.error("Error decoding JSON and writing text chunks to stdout:", error);
            }
        });
        // Play the remaining audio text buffer
        if (audioTextSteamBuffer !== "") {
            await tts(audioTextSteamBuffer);
            audioTextSteamBuffer = "";
        }
        response.on('end', () => {
            appendAndGetMessages(assistantMessage.trim(), "assistant");
            saveMessageToFile({ role: "assistant", content: assistantMessage.trim() });
            rl.prompt();
        });
        // This checks if the response is a Groq/OpenAI stream
        // NOTE: we also have stream and llmClient data that could be checked here
    } else if (typeof response[Symbol.asyncIterator] === 'function') {
        process.stdout.write("\r\x1B[32m⬤\x1B[0m  ");
        try {
            let audioTextSteamBuffer = "";
            for await (const chunk of response) {
                const content = chunk.choices[0]?.delta?.content;
                if (content) {
                    audioTextSteamBuffer += content;
                    if (/(?<![a-zA-Z0-9]\.)[.!?;:]/.test(content) && audioTextSteamBuffer.length > 15) {
                        await tts(audioTextSteamBuffer);
                        audioTextSteamBuffer = "";
                    }
                    assistantMessage += content;
                    process.stdout.write(content);
                }
            }
            // Play the remaining audio text buffer
            if (audioTextSteamBuffer !== "") {
                await tts(audioTextSteamBuffer);
            }
        } catch (error) {
            console.error("Error while streaming:", error);
        }
        process.stdout.write("\n");
        appendAndGetMessages(assistantMessage.trim(), "assistant");
        saveMessageToFile({ role: "assistant", content: assistantMessage.trim() });
        rl.prompt();
        // Non-streaming response
    } else if (response.text) {
        assistantMessage = `${response.text}`;
        // Clean the text from secret vault commands
        // handleSecretVault(assistantMessage);
        const cleanedText = assistantMessage;
        // Is text to speech service defined?
        if (textToSpeechService !== "") {
            splitAndPlayTextToSpeech(cleanedText);
        }
        // Print the assistant message in cleaned form
        console.log("\r\x1B[32m⬤\x1B[0m  " + cleanedText);
        // Append the original uncleaned message to the messages array
        // In this way the secret vault commands are accessible for the system, but not visible in the chat
        // Of course, user can find these from log file
        appendAndGetMessages(assistantMessage, "assistant");
        // Save oringinal uncleaned message to the file
        saveMessageToFile({ role: "assistant", content: assistantMessage });
        rl.prompt();
        // Update the contextIds if the response has context
        // This is used in ollama prompt request mode
        if (!chat && llmClient == "ollama") {
            contextIds = response.context;
        }
    } else {
        console.warn('\r\x1b[31mFailed to retrieve response.\x1b[0m');
        if (response.error) {
            console.warn(`\x1b[31m${response.error}\x1b[0m`);
        }
        rl.prompt();
    }
}

async function interactiveChatSession(modelName, llmClientName) {
    // Handle LLM client and model names
    if (llmClientName && Object.keys(prompts).includes(llmClientName)) {
        llmClient = llmClientName;
    } else if (llmClientName && !Object.keys(prompts).includes(llmClientName)) {
        console.warn(`Invalid client name. Use one of the following: ${Object.keys(prompts)}`);
    }
    let default_str = "";
    if (llmClient == "ollama") {
        modelNames = await getOllamaModelNames();
    } else if (llmClient == "groq") {
        modelNames = getGroqModelNames();
        chat = true;
    } else if (llmClient == "openai") {
        modelNames = getOpenAIModelNames();
        chat = true;
    } else if (llmClient == "anthropic") {
        modelNames = getAnthropicModelNames();
        chat = true;
    }
    if (modelNames.length === 0) {
        const tip = llmClient == "ollama" ? "Please download a model first with 'ollama run <<model>>'." : "groq run <model>";
        console.warn(`No models found for interaction.${tip}`);
    }
    if (modelName && modelNames.includes(modelName)) {
        model = modelName;
    } else if (modelName && !modelNames.includes(modelName)) {
        console.warn(`Invalid model name. Use one of the following: ${modelNames}`);
    } else {
        default_str = "default ";
        model = modelNames[0];
    }

    console.log(`\n${assistantPersona} interacting with ${default_str}${llmClient} model '${model}'. Enter your prompt (or type '\\info' or '\\exit'). Ping to warm up service...\n`);
    // Warm up the server
    await processUserInput(getPrompt("pingPrompt", llmClient, model), withToolRequest = false);
    // Start the interactive chat session by reading user input
    rl.on('line', async (input) => {
        await processUserInput(input);
    });

    rl.on('close', async () => {
        await onExit();
    });
}

// Handle the application exit event
async function onExit() {
    try {
        // Wait for the async operation to complete
        await summarizeMessages(messages.filter(msg => msg.role == "user" || msg.role == "assistant"));
    } catch (error) {
        console.error('Error during exit:', error);
    } finally {
        setTimeout(() => {
            process.exit(0);
            // unref ensures that the timer does not require the Node.js event loop to remain active
        }, 1000).unref();
    }
}

// Process.on exit event cannot be async, so it wont wait for summarizeMessages to finish
// readline.on exit and SIGINT/SIGTERM are used instead
/*
process.on('exit', () => {
    onExit();
});
*/

// Handle SIGINT and SIGTERM signals
// SIGINT is usually generated by pressing ctrl+c
// but when in readline input, it does not trigger
// so it is handled by the readline.on exit
process.on('SIGINT', async () => {
    await onExit();
});

// SIGTERM is generated by process manager
// It shoud happen when the process is killed
process.on('SIGTERM', async () => {
    await onExit();
});

// Handle unhandled rejections like promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

async function main() {
    try {
        // Get the model name from the arguments after the script name
        const modelName = argv._[0] || "";
        const llmClientName = argv._[1] || "";
        const toolArgs = argv.t || [];
        const audio = argv.a && argv.a.trim();
        const summaryDirectory = argv.s && argv.s.trim();
        const voice = argv.v && argv.v.trim();
        const persona = argv.p && argv.p.trim();
        const personas = Object.keys(assistantPersonas);

        if (persona == "random") {
            assistantPersona = randomPersona();
        } else if (persona && personas.includes(persona)) {
            assistantPersona = persona;
        } else if (persona && !personas.includes(persona)) {
            console.warn(`Invalid persona name: ${persona}. Use one of the following: ${personas.join(", ")}`);
        } else {
            // Using default persona
        }

        if (audio && ttsServices.includes(audio)) {
            textToSpeechService = audio;
            if (voice) {
                // TODO: There is no check for the voice id in the selected tts service...
                voiceId = voice;
            } else {
                voiceId = defaultVoices[textToSpeechService];
            }
        } else if (audio && !ttsServices.includes(audio)) {
            console.warn(`Invalid text-to-speech service name: ${audio}. Use one of the following: ${ttsServices.join(", ")}`);
        }

        if (summaryDirectory) {
            summary = await fetchSummaryAndMessages(summaryDirectory);
        }

        if (!fs.existsSync(sessionDir)) {
            fs.mkdirSync(sessionDir, { recursive: true });
        }

        if (toolArgs.length > 0) {
            const [jsonFormatTools, humanFormatTools] = renderSelectedSchemas(toolArgs);
            tools = humanFormatTools;
            system_message_metadata_schema = system_message_metadata_schema.replace("<<tools_part>>", jsonFormatTools ? system_message_metadata_schema_tools_part : "");
            system_message_metadata = system_message_metadata.
                replace("<<response_schema>>", system_message_metadata_schema).
                replace("<<tools>>", jsonFormatTools).
                replace("<<tools_epilogue>>", jsonFormatTools ? system_message_metadata_tools_epilogue : "");
        }

        interactiveChatSession(modelName, llmClientName);

    } catch (error) {
        console.error("An error occurred in the main application bootstrap:", error);
    }
}

// Main bootstrap
if (require.main === module) {
    main();
}

// End of file
