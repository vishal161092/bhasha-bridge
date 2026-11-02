import { LightningElement, api } from 'lwc';
import transcribeAudio from '@salesforce/apex/BhashiniService.transcribeAudio';

/**
 * Records microphone audio and transcribes it via Bhashini (server-side, through Apex).
 * Set `language` to one of: en, hi, bn, gu, mr, ta, te.
 */
export default class BhashiniVoiceToText extends LightningElement {
    @api language = 'hi';
    @api labelName;
    @api textBox = false;
    @api transcriptionText;

    mediaRecorder;
    audioChunks = [];
    isRecording = false;

    startRecording() {
        navigator.mediaDevices
            .getUserMedia({ audio: true })
            .then((stream) => {
                this.audioChunks = [];
                this.mediaRecorder = new MediaRecorder(stream);
                this.mediaRecorder.ondataavailable = (event) => {
                    this.audioChunks.push(event.data);
                };
                this.mediaRecorder.onstop = () => {
                    stream.getTracks().forEach((track) => track.stop());
                    const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
                    this.convertToBase64(audioBlob);
                };
                this.mediaRecorder.start();
                this.isRecording = true;
            })
            .catch((err) => {
                console.error('Error accessing audio devices:', err);
            });
    }

    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
            this.isRecording = false;
        }
    }

    convertToBase64(audioBlob) {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64Data = reader.result.split(',')[1];
            this.callASRService(base64Data);
        };
        reader.readAsDataURL(audioBlob);
    }

    callASRService(base64Audio) {
        transcribeAudio({ languageCode: this.language, base64Audio })
            .then((result) => {
                this.transcriptionText = result;
                this.dispatchEvent(new CustomEvent('transcription', { detail: { text: result } }));
            })
            .catch((error) => {
                console.error('Error calling ASR service:', error);
            });
    }
}
