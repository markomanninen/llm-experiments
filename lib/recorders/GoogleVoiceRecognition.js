const recorder = require('node-record-lpcm16');
const speech = require('@google-cloud/speech');

class GoogleVoiceRecognition {

    constructor(options) {
        // Google speech creadential file must be set on environment:
        // $env:GOOGLE_APPLICATION_CREDENTIALS=C:\...\google-credentials.json
        this.client = new speech.SpeechClient();
        this.request = {
            config: {
                encoding: 'LINEAR16',
                sampleRateHertz: options.sampleRateHertz || 16000,
                languageCode: options.languageCode || 'en-US',
            },
            interimResults: options.interimResults || false
        };
        this.recording = false;
    }

    isRecording() {
        return this.recording;
    }

    startRecognition(callback) {
        const recognizeStream = this.client.streamingRecognize(this.request)
            // Silenty log errors and continue app because each new prompt will open
            // a new recognition stream, if the former was closed by an error.
            .on('error', error => {
                console.error('Error:', error);
                this.recording = false;
            })
            .on('data', data => {
                /*
                [
                    {
                        alternatives: [ [Object] ],
                        isFinal: true,
                        stability: 0,
                        resultEndTime: { seconds: '2', nanos: 130000000 },
                        channelTag: 0,
                        languageCode: 'en-us'
                    }
                ]
                */
                if (data.results[0] && data.results[0].alternatives[0] 
                    && data.results[0].alternatives[0].transcript.trim() !== '') {
                    callback(data.results[0].alternatives[0].transcript, data.results[0].isFinal);
                }
            });

        this.recording = true;

        recorder.record({
            sampleRateHertz: this.request.config.sampleRateHertz,
            threshold: 0,
            verbose: false,
            recordProgram: 'sox',
            silence: '10.0',
            format: 'S16_LE'
        }).stream()
          .on('error', error => {
            console.error('Error:', error)
            this.recording = false;
           })
          .pipe(recognizeStream);
    }
}

module.exports = GoogleVoiceRecognition;
