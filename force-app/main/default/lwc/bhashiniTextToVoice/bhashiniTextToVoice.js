import { LightningElement, api } from 'lwc';
import generateVoice from '@salesforce/apex/BhashiniService.generateVoice';

/**
 * Speaks `inputText` aloud using Bhashini TTS (server-side, through Apex).
 * Set `language` to one of: hi, bn, gu, mr, ta, te.
 */
export default class BhashiniTextToVoice extends LightningElement {
    @api language = 'hi';
    @api inputText = '';
    @api audioSrc = '';

    connectedCallback() {
        if (this.inputText) {
            this.generateVoice();
        }
    }

    renderedCallback() {
        if (this.audioSrc) {
            this.tryAutoPlay();
        }
    }

    tryAutoPlay() {
        const audioElement = this.template.querySelector('audio');
        if (audioElement) {
            audioElement.play().catch((error) => {
                console.warn('Audio auto-play failed. The user may need to click play manually.', error);
            });
        }
    }

    async generateVoice() {
        if (!this.inputText) {
            return;
        }
        try {
            const url = await generateVoice({ languageCode: this.language, inputText: this.inputText });
            if (url) {
                this.audioSrc = url;
            }
        } catch (error) {
            console.error('Error generating voice:', error);
        }
    }
}
