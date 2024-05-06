const recorder = require('node-record-lpcm16');
const WebSocket = require('ws');
const dotenv = require('dotenv');
dotenv.config();

class DeepgramVoiceRecognition {

    constructor(options) {
        this.connection = null;
        this.callback = null;
        this.options = options;
        this.recording = false;
        this.connect();
    }

    isRecording() {
        return this.recording;
    }

    setupListeners() {

        this.connection.on('open', () => {
            console.info("Deepgram speech recognition connection opened.");
        });

        this.connection.on('message', (data) => {
            const message = JSON.parse(data);
            if (message.channel.alternatives && message.channel.alternatives.length > 0) {
                if (this.options.interimResults) {
                    
                    let dataResult = ""
                    message.channel.alternatives.forEach(result => {
                        dataResult += result.transcript;
                    });

                    if (dataResult.trim() != '') {
                        this.callback(dataResult, message.is_final, message.speech_final);
                    }
                    
                } else {
                    if (message.channel.alternatives[0].transcript.trim() != '') {
                        this.callback(message.channel.alternatives[0].transcript, message.is_final, message.speech_final);
                    }
                }
            }
        });

        this.connection.on('close', (code, reason) => {
            console.info(`Deepgram speech recognition connection closed, Code: ${code}, Reason: ${reason}`);
        });

        this.connection.on('error', (error) => {
            console.error("WebSocket Error:", error);
        });
    }

    connect() {
        const wsUrl = `wss://api.deepgram.com/v1/listen?model=nova-2&encoding=linear16&channels=1&sample_rate=${this.options.sampleRateHertz || 16000}&language=${this.options.languageCode || 'en_US'}&punctuate=true&interim_results=true&vad_events=true&utterance_end_ms=1500`;
        this.connection = new WebSocket(wsUrl, {
            headers: { 'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}` }
        });
        this.setupListeners();
    }

    startRecognition(callback) {
        
        this.callback = callback;

        const audioStream = recorder.record({
            sampleRateHertz: this.options.sampleRateHertz || 16000,
            channels: 1,
            threshold: 0,
            verbose: false,
            // Ensure 'sox' or 'rec' is installed and configured.
            // AUDIODRIVE=waveaudio must be in system environment variables
            // for a valid default audio driver configuration
            recordProgram: 'sox',
            silence: '10.0',
            format: 'S16_LE'
        }).stream();

        audioStream.on('error', (error) => {
            this.recording = false;
            console.error('Audio recording error:', error);
        });

        audioStream.on('data', (data) => {
            if (this.connection.readyState === WebSocket.OPEN) {
                this.recording = true;
                this.connection.send(data);
            }
        });

        audioStream.on('end', () => {
            this.recording = false;
            console.info("Deepgram microphone audio stream ended.");
            this.connection.close();
        });
    }
}

module.exports = DeepgramVoiceRecognition;
