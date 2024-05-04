# LLM Experiments CLI

Command-line chat interface to ollama, Groq, OpenAI, and Anthropic models with audio and function calling tools (games, data management, code runner, etc.)

## Description

LLM Experiments CLI is a command-line interface designed to interact with various large language models (LLMs) such as OpenAI's GPT, Anthropic's Claude, and Ollama. This tool integrates multiple functionalities including chat, model interaction, logging, and additional utilities like text-to-speech and game simulations.

## Features

- **Model Interaction**: Communicate with different LLMs using specified models with streamed text generation option.
- **Text-to-Speech**: Convert text output from models into spoken audio using ElevenLabs and Deepgram SDKs.
- **Logging**: Detailed logs for errors, information, debugging, and tracing.
- **Games**: Built-in games like Hangman, Number Guessing, Heads or Tails, and Fire Water Grass (Rock Paper Scissors).
- **Function Calling Tools**: Execute tools dynamically based on JSON configuration embedded in model responses.

## Prerequisites

Before running the application, ensure you have Node.js and npm installed.

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/markomanninen/llm-experiments.git
cd llm-experiments
npm install
```

## Usage

To start the application, run:

```bash
node .\index.js --no-deprecation llama3-70b-8192 groq -p random -t games --stream
```

This command includes several options and flags that modify the behavior of the script:

- `--no-deprecation`: Node.js flag to suppress deprecation warnings.
- `llama3-70b-8192`: Specifies the Groq LLM model to be used.
- `groq`: Specifies the LLM client to be used.
- `-p random`: Sets the assistant persona to a randomly selected one from available personas.
- `-t games`: Indicates that the script should include function calling tools related to games. 
- `--stream`: Enables streaming of LLM outputs to the console as they are generated.

### Explanation of Script Arguments

- `-t, --tool`: Allows specifying tools to be used during the session. Tools could be additional functionalities or features like games, analytics, etc. Notation supports inclusion of sub-schemas, for instance `games.number_guessing` includes only specified tool schema for the chat session. Further, you may exclude certain sub-schemas, for instance: `-t games -t ^games.number_guessing` excludes number guessing schema and includes all other schemas available in games section.
- `-p, --persona`: Sets the assistant persona. If set to "random," a random persona from a predefined list is used. Personas can influence how responses are formatted or the tone of the interactions.
- `-a, --audio`: Enables text-to-speech functionality, specifying which service to use (Deepgram or Elevenlabs). If not set, text-to-speech is disabled.
- `-v, --voice`: Specifies the voice ID for the chosen text-to-speech service, allowing customization of the speech output to match specific voice profiles.
- `-s, --summary`: If provided, includes a summary of a specific chat session. The value can be a directory name under a `summaries` or `chats` folder or 'recent' to use the most recent summary.
- `-sm, --stream`: Controls whether the output from the LLM should be streamed (displayed in real-time) or shown after the process completes. The default is false, meaning streaming is off unless explicitly enabled.

### Additional Options

- `--help, -h`: Displays help information about the command usage and options.


## Commands in CLI

These commands are available when the script is running:

- `\\exit`: Exit the chat (`ctrl+c` works as well).
- `\\info`: Display help information.
- `\\set <key> <value>`: Set a global variable.
- `\\get [<key>]`: Retrieve global variables.
- `\\model <model>`: Switch to a different LLM model. The model must be supported by the selected LLM client.
- `\\stream <true|false>`: Toggle stream mode.
- `\\chat <true|false>`: Toggle between chat and prompt mode in Ollama client. Not applicable in other clients.
- `\\audio <service>`: Activate text-to-speech service. Options are Elevenlabs for a state-of-art voice models and Deepgram for ultrafast response times.
- `\\window_size <size>`: Set the number of the most recent messages included on LLM text completition calls. This gives context for the LLM inference in addition to system message, which may contain summary of the previpus discussion.
- `\\summarize [<int>]`: Manually activate the summarization of the conversation.

### Configuration

Configure environment variables and other settings in `.env` and other configuration files as necessary.

 The application requires several environment variables to be set for API keys:

- `GROQ_API_KEY`: API key for GROQ LLM service.
- `ELEVENLABS_API_KEY`: API key for ElevenLabs TTS client.
- `DEEPGRAM_API_KEY`: API key for Deepgram (TTS/STT).
- `ANTHROPIC_API_KEY`: API key for Anthropic LLM service.
- `OPENAI_API_KEY`: API key for OpenAI LLM service.

These are commercial API's, except for Groq, which is free to use at the moment (05/2024) with some rate limitations. If you install ollama to your local computer, you can use its models with the application for free.

## Contribution

Contributions are welcome. Please fork the repository, make your changes, and submit a pull request.

## ISC License

Copyright (c) 2024 Marko Manninen

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
