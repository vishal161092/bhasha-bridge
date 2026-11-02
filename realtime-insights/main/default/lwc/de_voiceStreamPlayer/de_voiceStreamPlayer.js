import { LightningElement, track } from 'lwc';
import getAzureConfig from '@salesforce/apex/de_AzureSpeechService.getAzureConfig';

export default class De_voiceStreamPlayer extends LightningElement {
    @track sourceLines = [];
    @track translatedLines = [];
    @track interimSource = '';
    @track interimTranslated = '';

    isStreaming = false;
    isSpeaking = false;
    ttsEnabled = true;
    errorMessage = '';
    duration = 0;
    selectedLanguage = 'hi-IN';
    detectedLanguage = '';

    _durationInterval = null;
    _tokenRefreshInterval = null;
    _lineCounter = 0;
    _boundMessageHandler = null;

    get languageOptions() {
        return [
            { label: 'Hindi', value: 'hi-IN' },
            { label: 'English (India)', value: 'en-IN' },
            { label: 'Tamil', value: 'ta-IN' },
            { label: 'Telugu', value: 'te-IN' },
            { label: 'Bengali', value: 'bn-IN' },
            { label: 'Marathi', value: 'mr-IN' },
            { label: 'Gujarati', value: 'gu-IN' },
            { label: 'Kannada', value: 'kn-IN' },
            { label: 'Malayalam', value: 'ml-IN' },
            { label: 'Punjabi', value: 'pa-IN' },
            { label: 'Urdu', value: 'ur-IN' },
            { label: 'Odia', value: 'or-IN' },
            { label: 'Assamese', value: 'as-IN' }
        ];
    }

    get vfPageUrl() {
        const baseUrl = window.location.origin.replace('.lightning.force.com', '--c.vf.force.com');
        return baseUrl + '/apex/de_BhashiniStreamPage';
    }

    get recordButtonVariant() {
        return this.isStreaming ? 'destructive' : 'brand';
    }

    get recordButtonLabel() {
        return this.isStreaming ? 'Stop Translation' : 'Start Translation';
    }

    get recordButtonIcon() {
        return this.isStreaming ? 'utility:stop' : 'utility:microphone';
    }

    get formattedDuration() {
        const mins = Math.floor(this.duration / 60);
        const secs = this.duration % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    get hasTranscript() {
        return this.sourceLines.length > 0 || this.interimSource;
    }

    get noTranscript() {
        return !this.hasTranscript;
    }

    get hasError() {
        return this.errorMessage !== '';
    }

    get ttsButtonVariant() {
        return this.ttsEnabled ? 'brand' : 'neutral';
    }

    get ttsButtonLabel() {
        if (this.isSpeaking) return 'Speaking...';
        return this.ttsEnabled ? 'Audio On' : 'Audio Off';
    }

    get ttsButtonIcon() {
        return this.ttsEnabled ? 'utility:volume_high' : 'utility:volume_off';
    }

    get selectedLanguageLabel() {
        const opt = this.languageOptions.find(o => o.value === this.selectedLanguage);
        return opt ? opt.label : this.selectedLanguage;
    }

    get sourcePanelTitle() {
        if (this.detectedLanguage) {
            return `${this.detectedLanguage} (Detected)`;
        }
        return `${this.selectedLanguageLabel} (Source)`;
    }

    connectedCallback() {
        this._boundMessageHandler = this._handleMessage.bind(this);
        window.addEventListener('message', this._boundMessageHandler);
    }

    disconnectedCallback() {
        if (this._boundMessageHandler) {
            window.removeEventListener('message', this._boundMessageHandler);
        }
        this._cleanup();
    }

    handleLanguageChange(event) {
        this.selectedLanguage = event.detail.value;
    }

    handleToggleTts() {
        this.ttsEnabled = !this.ttsEnabled;
        const iframe = this.template.querySelector('iframe');
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({
                type: 'azure-tts-toggle',
                enabled: this.ttsEnabled
            }, '*');
        }
    }

    async handleToggleStream() {
        if (this.isStreaming) {
            this._stopStream();
        } else {
            await this._startStream();
        }
    }

    async _startStream() {
        this.errorMessage = '';

        const iframe = this.template.querySelector('iframe');
        if (!iframe || !iframe.contentWindow) {
            this.errorMessage = 'VF iframe not ready. Please wait and try again.';
            return;
        }

        try {
            const config = await getAzureConfig();

            iframe.contentWindow.postMessage({
                type: 'azure-stream-start',
                language: this.selectedLanguage,
                targetLanguage: 'en',
                azureToken: config.token,
                azureRegion: config.region,
                ttsEnabled: this.ttsEnabled,
                useAutoDetect: false
            }, '*');

            // Azure authorization tokens expire after ~10 minutes; refresh before that.
            this._tokenRefreshInterval = setInterval(async () => {
                try {
                    const fresh = await getAzureConfig();
                    iframe.contentWindow.postMessage({ type: 'azure-token-refresh', azureToken: fresh.token }, '*');
                } catch (e) {
                    console.warn('Azure token refresh failed', e);
                }
            }, 8 * 60 * 1000);

            this.isStreaming = true;
            this.duration = 0;
            this.detectedLanguage = '';
            this._durationInterval = setInterval(() => { this.duration++; }, 1000);
        } catch (err) {
            this.errorMessage = 'Failed to get Azure config: ' + (err.body?.message || err.message);
        }
    }

    _stopStream() {
        const iframe = this.template.querySelector('iframe');
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({ type: 'azure-stream-stop' }, '*');
        }
        this._cleanup();
    }

    _handleMessage(event) {
        const data = event.data;
        if (!data || !data.type) return;

        if (data.type === 'azure-stream-transcript') {
            if (data.isFinal) {
                this._addTranscriptLine(data.sourceText, data.translatedText, data.detectedLanguageName);
                this.interimSource = '';
                this.interimTranslated = '';
            } else {
                this.interimSource = data.sourceText || '';
                this.interimTranslated = data.translatedText || '';
            }
        } else if (data.type === 'azure-language-detected') {
            this.detectedLanguage = data.languageName || data.language || '';
        } else if (data.type === 'azure-stream-stopped') {
            this._cleanup();
        } else if (data.type === 'azure-stream-error') {
            this.errorMessage = data.error || 'Stream error';
            this._cleanup();
        } else if (data.type === 'azure-tts-status') {
            this.isSpeaking = data.speaking || false;
        }
    }

    _addTranscriptLine(sourceText, translatedText, langName) {
        if (!sourceText || !sourceText.trim()) return;
        const now = new Date();
        const timestamp = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

        this._lineCounter++;
        const lineId = `line-${this._lineCounter}`;

        this.sourceLines = [
            ...this.sourceLines,
            { id: lineId, text: sourceText.trim(), timestamp, lang: langName || '' }
        ];

        this.translatedLines = [
            ...this.translatedLines,
            { id: lineId, text: (translatedText || '').trim(), timestamp }
        ];

        setTimeout(() => {
            const panels = this.template.querySelectorAll('.transcript-body');
            panels.forEach(p => { p.scrollTop = p.scrollHeight; });
        }, 100);
    }

    handleClear() {
        this.sourceLines = [];
        this.translatedLines = [];
        this.interimSource = '';
        this.interimTranslated = '';
        this._lineCounter = 0;
        this.errorMessage = '';
        this.detectedLanguage = '';
    }

    _cleanup() {
        this.isStreaming = false;
        if (this._tokenRefreshInterval) {
            clearInterval(this._tokenRefreshInterval);
            this._tokenRefreshInterval = null;
        }
        if (this._durationInterval) {
            clearInterval(this._durationInterval);
            this._durationInterval = null;
        }
    }
}
