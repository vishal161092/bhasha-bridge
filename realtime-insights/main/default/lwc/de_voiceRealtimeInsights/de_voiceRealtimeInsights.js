import { LightningElement, track, api } from 'lwc';
import getPipelineConfig from '@salesforce/apex/de_BhashiniService.getPipelineConfig';
import transcribeAudio from '@salesforce/apex/de_BhashiniService.transcribeAudio';
import translateText from '@salesforce/apex/de_BhashiniService.translateText';
import getASFStreamConfig from '@salesforce/apex/de_BhashiniService.getASFStreamConfig';
import getPDQuestions from '@salesforce/apex/de_InsightService.getPDQuestions';
import createSession from '@salesforce/apex/de_AgentService.createSession';
import sendMessage from '@salesforce/apex/de_AgentService.sendMessage';
import endSession from '@salesforce/apex/de_AgentService.endSession';

const OCCUPATION_FIELDS = {
    'Dairy Farmer': [
        'farmer_animals_count__c', 'farmer_experience_years__c', 'farmer_milk_peak_lpd__c',
        'farmer_sales_channel__c', 'farmer_monthly_income__c', 'farmer_monthly_costs__c',
        'farmer_land_ownership__c', 'farmer_agri_loan_emi__c', 'farmer_animal_insurance__c',
        'farmer_property_distance_km__c'
    ],
    'Dairy Farming': [
        'farmer_animals_count__c', 'farmer_experience_years__c', 'farmer_milk_peak_lpd__c',
        'farmer_sales_channel__c', 'farmer_monthly_income__c', 'farmer_monthly_costs__c',
        'farmer_land_ownership__c', 'farmer_agri_loan_emi__c', 'farmer_animal_insurance__c',
        'farmer_property_distance_km__c'
    ],
    'Kirana Store': [
        'kirana_vintage_years__c', 'kirana_premises_ownership__c', 'kirana_monthly_turnover__c',
        'kirana_gross_margin_pct__c', 'kirana_net_income__c', 'kirana_udhaar_outstanding__c',
        'kirana_gst_registered__c', 'kirana_revenue_trend__c', 'kirana_bank_account__c',
        'kirana_business_loan_emi__c'
    ],
    'Kirana Owner': [
        'kirana_vintage_years__c', 'kirana_premises_ownership__c', 'kirana_monthly_turnover__c',
        'kirana_gross_margin_pct__c', 'kirana_net_income__c', 'kirana_udhaar_outstanding__c',
        'kirana_gst_registered__c', 'kirana_revenue_trend__c', 'kirana_bank_account__c',
        'kirana_business_loan_emi__c'
    ],
    'IT Consultant': [
        'itc_entity_type__c', 'itc_active_clients__c', 'itc_client_concentration_pct__c',
        'itc_contract_duration_months__c', 'itc_avg_annual_income__c', 'itc_net_take_home__c',
        'itc_total_emi__c', 'itc_liquid_savings__c', 'itc_experience_years__c', 'itc_gst_registered__c'
    ],
    'Software Developer': [
        'swdev_employment_type__c', 'swdev_employer_category__c', 'swdev_current_tenure_years__c',
        'swdev_experience_years__c', 'swdev_variable_pay__c', 'swdev_tech_demand__c',
        'swdev_company_health__c', 'swdev_net_salary__c', 'swdev_total_emi__c',
        'swdev_liquid_investments__c'
    ],
    'Pharmacist': [
        'pharma_role_type__c', 'pharma_qualification__c', 'pharma_license_valid__c',
        'pharma_prescription_pct__c', 'pharma_shop_ownership__c', 'pharma_monthly_turnover__c',
        'pharma_gross_margin_pct__c', 'pharma_gst_turnover__c', 'pharma_monthly_savings__c',
        'pharma_business_loan_emi__c'
    ],
    'Professor': [
        'prof_institution_type__c', 'prof_qualification__c', 'prof_experience_years__c',
        'prof_employment_status__c', 'prof_net_salary__c', 'prof_additional_income__c',
        'prof_retirement_balance__c', 'prof_spouse_working__c', 'prof_total_emi__c',
        'prof_years_to_retirement__c'
    ],
    'Factory Operator': [
        'factop_employment_type__c', 'factop_employer_name__c', 'factop_tenure_years__c',
        'factop_epf_registered__c', 'factop_skill_category__c', 'factop_salary_mode__c',
        'factop_operational_status__c', 'factop_take_home__c', 'factop_loan_emi__c',
        'factop_household_income__c'
    ],
    'Factory / Industrial Operator': [
        'factop_employment_type__c', 'factop_employer_name__c', 'factop_tenure_years__c',
        'factop_epf_registered__c', 'factop_skill_category__c', 'factop_salary_mode__c',
        'factop_operational_status__c', 'factop_take_home__c', 'factop_loan_emi__c',
        'factop_household_income__c'
    ]
};

export default class De_voiceRealtimeInsights extends LightningElement {
    @track transcriptLines = [];
    @track translationLines = [];
    @track pdQuestions = [];
    @track interimText = '';
    @track agentResponse = '';
    @track occupationFields = [];
    @track agentCoveredItems = [];
    @track agentPendingItems = [];
    @track agentOccupation = '';
    @track agentCoveredCount = 0;
    @track agentPendingCount = 0;
    @track agentTotalCount = 0;

    selectedLanguage = 'en';
    selectedEngine = 'native';
    isRecording = false;
    isTranscribing = false;
    isLoadingQuestions = false;
    isAgentExpanded = true;
    isAgentLoading = false;
    pdOccupation = '';
    duration = 0;
    errorMessage = '';
    asrMode = '';

    /** Contact being interviewed. Set in App Builder, or place the component on a Contact record page. */
    @api contactId = '';
    @api recordId;
    formRecordId = null;

    _mediaStream = null;
    _mediaRecorder = null;
    _audioChunks = [];
    _durationInterval = null;
    _chunkInterval = null;
    _lineCounter = 0;
    _fullTranscript = '';
    _pipelineConfig = null;
    _isProcessing = false;
    _recognition = null;
    _watchdogInterval = null;
    _lastResultTime = 0;
    _ws = null;
    _audioWorklet = null;
    _audioContext = null;

    get asrEngineOptions() {
        return [
            { label: 'Native', value: 'native' },
            { label: 'Bhashini', value: 'bhashini' },
            { label: 'Speech Foundations', value: 'speech-foundations' }
        ];
    }

    get languageOptions() {
        return [
            { label: 'English', value: 'en' },
            { label: 'Hindi', value: 'hi' },
            { label: 'Tamil', value: 'ta' },
            { label: 'Telugu', value: 'te' },
            { label: 'Bengali', value: 'bn' },
            { label: 'Marathi', value: 'mr' },
            { label: 'Gujarati', value: 'gu' },
            { label: 'Kannada', value: 'kn' },
            { label: 'Malayalam', value: 'ml' },
            { label: 'Punjabi', value: 'pa' },
            { label: 'Urdu', value: 'ur' }
        ];
    }

    get nativeLanguageCode() {
        const map = {
            'hi': 'hi-IN',
            'en': 'en-IN',
            'ta': 'ta-IN',
            'te': 'te-IN',
            'bn': 'bn-IN',
            'mr': 'mr-IN',
            'gu': 'gu-IN',
            'kn': 'kn-IN',
            'ml': 'ml-IN',
            'pa': 'pa-IN',
            'ur': 'ur-IN'
        };
        return map[this.selectedLanguage] || 'hi-IN';
    }

    connectedCallback() {
        if (!this.contactId && this.recordId) {
            this.contactId = this.recordId;
        }
        if (this.contactId) {
            this._loadPDQuestions();
        }
    }

    async _loadPDQuestions() {
        this.isLoadingQuestions = true;
        try {
            const result = await getPDQuestions({ contactId: this.contactId });
            let jsonStr = (result || '').trim();
            if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
            else if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
            if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);
            jsonStr = jsonStr.trim();

            const parsed = JSON.parse(jsonStr);
            this.pdOccupation = parsed.occupation || '';
            this.pdQuestions = (parsed.questions || []).map((q, i) => ({
                id: `q-${i}`,
                sequence: q.sequence || (i + 1),
                question: q.question,
                status: 'neutral',
                cssClass: 'question-item'
            }));
            this._setOccupationFields();
        } catch (err) {
            console.error('PD Questions load error:', err);
            this.pdQuestions = [];
        } finally {
            this.isLoadingQuestions = false;
        }
    }

    _setOccupationFields() {
        const fields = OCCUPATION_FIELDS[this.pdOccupation] || [];
        this.occupationFields = fields;
    }

    get hasOccupationFields() {
        return this.occupationFields.length > 0;
    }

    _prefillFromAgent(responseText) {
        try {
            let jsonStr = responseText.trim();
            if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
            else if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
            if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);
            jsonStr = jsonStr.trim();

            // Try to extract JSON from mixed text/JSON response
            const jsonMatch = jsonStr.match(/\{[\s\S]*"coveredQuestions"[\s\S]*\}/);
            if (jsonMatch) {
                jsonStr = jsonMatch[0];
            }

            const data = JSON.parse(jsonStr);
            this._applyQuestionColors(data);
            this._buildAgentDisplay(data);
            this._prefillFields(data);
        } catch (e) {
            // JSON parse failed — try text-based parsing as fallback
            this._parseTextResponse(responseText);
        }
    }

    _applyQuestionColors(data) {
        const coveredSet = new Set();
        if (data.coveredQuestions) {
            data.coveredQuestions.forEach(cq => {
                if (cq.sequence) coveredSet.add(cq.sequence);
                if (cq.question) coveredSet.add(cq.question.toLowerCase().trim());
            });
        }
        const pendingSet = new Set();
        if (data.pendingQuestions) {
            data.pendingQuestions.forEach(pq => {
                if (pq.sequence) pendingSet.add(pq.sequence);
                if (pq.question) pendingSet.add(pq.question.toLowerCase().trim());
            });
        }

        if (coveredSet.size > 0 || pendingSet.size > 0) {
            this.pdQuestions = this.pdQuestions.map(q => {
                let status = 'neutral';
                const qLower = q.question.toLowerCase().trim();
                if (coveredSet.has(q.sequence) || coveredSet.has(qLower)) {
                    status = 'covered';
                } else if (pendingSet.has(q.sequence) || pendingSet.has(qLower)) {
                    status = 'pending';
                } else if (coveredSet.size > 0) {
                    status = 'pending';
                }
                return { ...q, status, cssClass: `question-item question-${status}` };
            });
        }
    }

    _prefillFields(data) {
        const fieldValues = data.field_values || data.fieldValues;
        if (!fieldValues || Object.keys(fieldValues).length === 0) {
            console.log('No field_values in agent response');
            return;
        }
        console.log('Prefilling fields:', JSON.stringify(fieldValues));

        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => {
            const inputFields = this.template.querySelectorAll('lightning-input-field');
            console.log('Found input fields:', inputFields.length);
            inputFields.forEach(field => {
                const apiName = field.fieldName;
                console.log('Checking field:', apiName);
                if (apiName && fieldValues[apiName] !== undefined && fieldValues[apiName] !== null) {
                    field.value = fieldValues[apiName];
                    console.log('Set', apiName, '=', fieldValues[apiName]);
                }
            });
        }, 500);
    }

    _parseTextResponse(responseText) {
        const text = responseText.toLowerCase();
        const coveredSection = text.includes('covered questions') || text.includes('covered:');
        if (!coveredSection) return;

        const coveredQuestionNumbers = new Set();
        const coveredMatch = responseText.match(/covered[\s\S]*?(?=pending|uncovered|$)/i);
        if (coveredMatch) {
            const numberMatches = coveredMatch[0].match(/\b(\d{1,2})\./g);
            if (numberMatches) {
                numberMatches.forEach(n => coveredQuestionNumbers.add(parseInt(n)));
            }
            // Also match "Question 1", "Q1", "#1" patterns
            const altMatches = coveredMatch[0].match(/(?:question|q|#)\s*(\d{1,2})/gi);
            if (altMatches) {
                altMatches.forEach(m => {
                    const num = parseInt(m.match(/\d+/)[0]);
                    coveredQuestionNumbers.add(num);
                });
            }
        }

        if (coveredQuestionNumbers.size > 0) {
            this.pdQuestions = this.pdQuestions.map(q => {
                const status = coveredQuestionNumbers.has(q.sequence) ? 'covered' : 'pending';
                return { ...q, status, cssClass: `question-item question-${status}` };
            });

            // Populate structured display from text parsing
            this.agentOccupation = this.pdOccupation || 'Unknown';
            this.agentCoveredItems = this.pdQuestions
                .filter(q => q.status === 'covered')
                .map((q, i) => ({ id: `cov-${i}`, sequence: q.sequence, question: q.question, evidence: '' }));
            this.agentPendingItems = this.pdQuestions
                .filter(q => q.status === 'pending')
                .map((q, i) => ({ id: `pen-${i}`, sequence: q.sequence, question: q.question }));
            this.agentCoveredCount = this.agentCoveredItems.length;
            this.agentPendingCount = this.agentPendingItems.length;
            this.agentTotalCount = this.pdQuestions.length;
        }
    }

    _buildAgentDisplay(data) {
        this.agentOccupation = data.occupation || this.pdOccupation || 'Unknown';

        this.agentCoveredItems = (data.coveredQuestions || []).map((q, i) => ({
            id: `cov-${i}`,
            sequence: q.sequence || (i + 1),
            question: q.question,
            evidence: q.evidence || ''
        }));

        this.agentPendingItems = (data.pendingQuestions || []).map((q, i) => ({
            id: `pen-${i}`,
            sequence: q.sequence || (i + 1),
            question: q.question
        }));

        this.agentCoveredCount = this.agentCoveredItems.length;
        this.agentPendingCount = this.agentPendingItems.length;
        this.agentTotalCount = (data.summary && data.summary.totalQuestions)
            ? data.summary.totalQuestions
            : this.agentCoveredCount + this.agentPendingCount;

        // Keep text fallback populated
        this.agentResponse = `${this.agentOccupation}: ${this.agentCoveredCount} covered, ${this.agentPendingCount} pending`;
    }

    get hasQuestions() {
        return this.pdQuestions.length > 0;
    }

    get hasAgentResult() {
        return this.agentCoveredItems.length > 0 || this.agentPendingItems.length > 0;
    }

    get hasCoveredItems() {
        return this.agentCoveredItems.length > 0;
    }

    get hasPendingItems() {
        return this.agentPendingItems.length > 0;
    }

    get recordButtonVariant() {
        return this.isRecording ? 'destructive' : 'brand';
    }

    get recordButtonLabel() {
        return this.isRecording ? 'Stop Recording' : 'Start Recording';
    }

    get recordButtonIcon() {
        return this.isRecording ? 'utility:stop' : 'utility:record';
    }

    get formattedDuration() {
        const mins = Math.floor(this.duration / 60);
        const secs = this.duration % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    get hasTranscript() {
        return this.transcriptLines.length > 0 || this.interimText;
    }

    get hasTranslation() {
        return this.translationLines.length > 0;
    }

    get hasError() {
        return this.errorMessage !== '';
    }

    get agentChevronIcon() {
        return this.isAgentExpanded ? 'utility:chevrondown' : 'utility:chevronright';
    }

    get asrModeLabel() {
        if (this.asrMode === 'native') return 'Browser Speech API';
        if (this.asrMode === 'bhashini') return 'Bhashini ASR (Chunked)';
        if (this.asrMode === 'speech-foundations') return 'Speech Foundations (WebSocket Stream)';
        return '';
    }

    handleAgentToggle() {
        this.isAgentExpanded = !this.isAgentExpanded;
    }

    async handleRunAgent() {
        const englishTranscript = this.translationLines
            .filter(l => l.text && l.text !== '...')
            .map(l => l.text)
            .join(' ');

        if (!englishTranscript || englishTranscript.trim().length < 10) {
            this.errorMessage = 'Need more English translation before running agent analysis.';
            return;
        }

        this.isAgentExpanded = true;
        this.isAgentLoading = true;
        this.agentResponse = '';
        this.errorMessage = '';

        try {
            const questionListStr = this.pdQuestions.map(q => q.question).join('\n');
            console.log('=== AGENT DEBUG ===');
            console.log('contactId:', this.contactId);
            console.log('questionList:', questionListStr);
            console.log('Transcription:', englishTranscript);
            const sessionId = await createSession({
                contactId: this.contactId,
                questionList: questionListStr,
                realtimeTranscription: englishTranscript
            });
            console.log('sessionId:', sessionId);
            const fieldListStr = this.occupationFields.join(', ');
            const msgText = 'Analyze the transcription against the PD questions using the Speech to Text QA Prompt action. Use these inputs:\nrealtimeTranscription: ' + englishTranscript + '\nquestionList: ' + questionListStr + '\n\nAlso extract values for these underwriting fields from the transcript evidence: ' + fieldListStr + '\n\nIMPORTANT: Return your response as valid JSON with this exact structure: {"occupation":"...","coveredQuestions":[{"sequence":1,"question":"...","evidence":"..."}],"pendingQuestions":[{"sequence":2,"question":"..."}],"summary":{"totalQuestions":20,"coveredQuestions":5,"pendingQuestions":15},"field_values":{"field_api_name__c":"extracted value or null"}}';
            console.log('messageText:', msgText);
            const response = await sendMessage({
                sessionId: sessionId,
                messageText: msgText,
                sequenceId: 1
            });
            console.log('agentResponse:', response);
            this.agentResponse = response;
            this._prefillFromAgent(response);
            endSession({ sessionId: sessionId }).catch(() => {});
        } catch (err) {
            console.error('Agent error:', err);
            this.errorMessage = 'Agent error: ' + (err.body?.message || err.message || 'Unknown error');
        } finally {
            this.isAgentLoading = false;
        }
    }

    handleSaveContact() {
        this.formRecordId = this.contactId;
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => {
            const form = this.template.querySelector('lightning-record-edit-form');
            if (form) {
                form.submit();
            }
        }, 200);
    }

    handleContactSaveSuccess() {
        this.errorMessage = '';
    }

    handleContactSaveError(event) {
        this.errorMessage = 'Save error: ' + (event.detail?.message || 'Unknown');
    }

    handleEngineChange(event) {
        this.selectedEngine = event.detail.value;
    }

    handleLanguageChange(event) {
        this.selectedLanguage = event.detail.value;
    }

    async handleRecordToggle() {
        if (this.isRecording) {
            this.stopRecording();
        } else {
            await this.startRecording();
        }
    }

    async startRecording() {
        this.errorMessage = '';
        this.asrMode = '';

        if (this.selectedEngine === 'bhashini') {
            try {
                this.interimText = 'Connecting to Bhashini ASR...';
                this._pipelineConfig = await getPipelineConfig({ sourceLanguage: this.selectedLanguage });
                this.asrMode = 'bhashini';
                this.interimText = '';
                await this._startBhashiniRecording();
            } catch (err) {
                this.interimText = '';
                this.errorMessage = 'Bhashini error: ' + (err.body?.message || err.message || 'Service unavailable');
            }
        } else if (this.selectedEngine === 'speech-foundations') {
            try {
                this.interimText = 'Connecting to Speech Foundations...';
                this._asfConfig = await getASFStreamConfig({ sourceLanguage: this.selectedLanguage });
                this.asrMode = 'speech-foundations';
                this.interimText = '';
                await this._startSpeechFoundationsStreaming();
            } catch (err) {
                this.interimText = '';
                this.errorMessage = 'Speech Foundations error: ' + (err.body?.message || err.message || 'WebSocket connection failed');
            }
        } else {
            this._startNativeRecording();
        }
    }

    // ═══════════════════════════════════════
    // Native Web Speech API (fallback)
    // ═══════════════════════════════════════

    _startNativeRecording() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            this.errorMessage = 'Speech recognition not supported in this browser. Use Chrome.';
            return;
        }

        this.asrMode = 'native';
        this._lastResultTime = Date.now();
        this._initRecognition();
        this._recognition.start();

        this.isRecording = true;
        this.duration = 0;
        this._durationInterval = setInterval(() => { this.duration++; }, 1000);

        // Watchdog: force-restart recognition if no results for 5 seconds
        this._watchdogInterval = setInterval(() => {
            if (!this.isRecording) return;
            const elapsed = Date.now() - this._lastResultTime;
            if (elapsed > 5000 && this._recognition) {
                console.log('Watchdog: restarting speech recognition');
                try {
                    this._recognition.abort();
                } catch (e) { /* ignore */ }
                setTimeout(() => {
                    if (this.isRecording) {
                        this._initRecognition();
                        try {
                            this._recognition.start();
                        } catch (e) {
                            console.warn('Watchdog restart failed:', e);
                        }
                    }
                }, 200);
            }
        }, 3000);

    }

    _initRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this._recognition = new SpeechRecognition();
        this._recognition.continuous = true;
        this._recognition.interimResults = true;
        this._recognition.lang = this.nativeLanguageCode;
        this._recognition.maxAlternatives = 1;

        this._recognition.onresult = (event) => {
            this._lastResultTime = Date.now();
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    this._addTranscriptLine(transcript.trim());
                    this.interimText = '';
                } else {
                    interim += transcript;
                }
            }
            if (interim) {
                this.interimText = interim;
            }
        };

        this._recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            if (event.error === 'not-allowed') {
                this.errorMessage = 'Microphone access denied. Please allow mic access.';
                this.stopRecording();
            }
            // For network/no-speech/aborted errors, let watchdog handle restart
        };

        this._recognition.onend = () => {
            // Immediately restart if still recording
            if (this.isRecording) {
                setTimeout(() => {
                    if (this.isRecording && this._recognition) {
                        try {
                            this._recognition.start();
                        } catch (e) {
                            // Watchdog will handle it
                        }
                    }
                }, 100);
            }
        };
    }

    // ═══════════════════════════════════════
    // Bhashini Chunked REST (primary)
    // ═══════════════════════════════════════

    async _startBhashiniRecording() {
        this._mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                channelCount: 1,
                sampleRate: 16000,
                echoCancellation: true,
                noiseSuppression: true
            }
        });

        this.isRecording = true;
        this.duration = 0;
        this._durationInterval = setInterval(() => { this.duration++; }, 1000);

        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus' : 'audio/webm';

        this._mediaRecorder = new MediaRecorder(this._mediaStream, { mimeType });
        this._audioChunks = [];

        this._mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                this._audioChunks.push(e.data);
            }
        };

        this._mediaRecorder.onstop = () => {
            this._processAudioChunk();
        };

        // Record in 3-second chunks
        this._chunkInterval = setInterval(() => {
            if (this._mediaRecorder?.state === 'recording') {
                this._mediaRecorder.stop();
                setTimeout(() => {
                    if (this.isRecording && this._mediaStream) {
                        this._mediaRecorder.start();
                    }
                }, 100);
            }
        }, 3000);

        this._mediaRecorder.start();
    }

    async _processAudioChunk() {
        if (this._audioChunks.length === 0 || this._isProcessing) return;

        const chunks = [...this._audioChunks];
        this._audioChunks = [];
        this._isProcessing = true;

        try {
            this.isTranscribing = true;
            this.interimText = 'Transcribing...';

            const blob = new Blob(chunks, { type: 'audio/webm' });
            const wavBase64 = await this._convertToWavBase64(blob);

            const text = await transcribeAudio({
                audioBase64: wavBase64,
                sourceLanguage: this.selectedLanguage
            });

            this.interimText = '';

            if (text && text.trim()) {
                this._addTranscriptLine(text.trim());
            }
        } catch (err) {
            console.error('Transcription error:', err);
            this.interimText = '';
            if (err.body && err.body.message) {
                this.errorMessage = 'Transcription error: ' + err.body.message;
            }
        } finally {
            this.isTranscribing = false;
            this._isProcessing = false;
        }
    }

    async _convertToWavBase64(blob) {
        const arrayBuffer = await blob.arrayBuffer();
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        audioCtx.close();

        const targetRate = 16000;
        let samples;

        if (audioBuffer.sampleRate === targetRate) {
            samples = audioBuffer.getChannelData(0);
        } else {
            const ratio = audioBuffer.sampleRate / targetRate;
            const newLength = Math.floor(audioBuffer.length / ratio);
            samples = new Float32Array(newLength);
            const srcData = audioBuffer.getChannelData(0);
            for (let i = 0; i < newLength; i++) {
                samples[i] = srcData[Math.floor(i * ratio)];
            }
        }

        const pcm16 = new Int16Array(samples.length);
        for (let i = 0; i < samples.length; i++) {
            const s = Math.max(-1, Math.min(1, samples[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        const wavBuffer = new ArrayBuffer(44 + pcm16.length * 2);
        const view = new DataView(wavBuffer);

        const writeString = (offset, str) => {
            for (let i = 0; i < str.length; i++) {
                view.setUint8(offset + i, str.charCodeAt(i));
            }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, 36 + pcm16.length * 2, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, targetRate, true);
        view.setUint32(28, targetRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, pcm16.length * 2, true);

        const pcmBytes = new Uint8Array(pcm16.buffer);
        new Uint8Array(wavBuffer).set(pcmBytes, 44);

        let binary = '';
        const bytes = new Uint8Array(wavBuffer);
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    // ═══════════════════════════════════════
    // Speech Foundations WebSocket Streaming
    // ═══════════════════════════════════════

    async _startSpeechFoundationsStreaming() {
        this._mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                channelCount: 1,
                sampleRate: 16000,
                echoCancellation: true,
                noiseSuppression: true
            }
        });

        const baseUrl = this._asfConfig.wsEndpoint;
        const token = this._asfConfig.token;

        // Match exact params from working test: deepgram_falcon + nova-3, multi-language
        const wsUrl = `${baseUrl}?engine=deepgram_falcon&language-code=multi&model=nova-3&smart-format=true&numerals=true&punctuate=true&profanity-filter=false&media-encoding=pcm&media-sample-rate-hertz=16000&access_token=${token}`;

        console.log('ASF WS connecting to:', wsUrl.replace(token, 'TOKEN_REDACTED'));
        console.log('ASF token length:', token ? token.length : 'NULL');

        this._ws = new WebSocket(wsUrl);

        this._ws.onopen = () => {
            console.log('Speech Foundations WS connected');
            this._startAudioCapture();
        };

        this._ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                // Handle utterance end events
                if (data.isUtteranceEnd) {
                    return;
                }

                // Handle transcription results per ASF response format
                const results = data.transcript?.results;
                if (results && results.length > 0) {
                    for (const result of results) {
                        const alt = result.alternatives?.[0];
                        if (!alt || !alt.transcript) continue;

                        if (result.isPartial) {
                            this.interimText = alt.transcript;
                        } else {
                            this._addTranscriptLine(alt.transcript.trim(), result.languageCode);
                            this.interimText = '';
                        }
                    }
                }
            } catch (e) {
                console.warn('ASF WS message parse error:', e);
            }
        };

        this._ws.onerror = (event) => {
            console.error('Speech Foundations WS error:', event);
            this.errorMessage = 'WebSocket error — check CSP settings or network connectivity.';
        };

        this._ws.onclose = (event) => {
            console.log('Speech Foundations WS closed:', event.code, event.reason);
            if (this.isRecording && event.code !== 1000) {
                this.errorMessage = `WebSocket closed (${event.code}). ${event.reason || 'Connection lost.'}`;
            }
        };

        this.isRecording = true;
        this.duration = 0;
        this._durationInterval = setInterval(() => { this.duration++; }, 1000);
    }

    _startAudioCapture() {
        this._audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        const source = this._audioContext.createMediaStreamSource(this._mediaStream);

        const bufferSize = 4096;
        const processor = this._audioContext.createScriptProcessor(bufferSize, 1, 1);

        processor.onaudioprocess = (e) => {
            if (!this._ws || this._ws.readyState !== WebSocket.OPEN) return;

            const float32 = e.inputBuffer.getChannelData(0);
            const int16 = new Int16Array(float32.length);
            for (let i = 0; i < float32.length; i++) {
                const s = Math.max(-1, Math.min(1, float32[i]));
                int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            // ASF expects raw PCM binary frames
            this._ws.send(int16.buffer);
        };

        source.connect(processor);
        processor.connect(this._audioContext.destination);
        this._audioWorklet = processor;
    }

    _stopSpeechFoundationsStreaming() {
        if (this._ws) {
            if (this._ws.readyState === WebSocket.OPEN) {
                // Send empty buffer to signal end of stream per ASF spec
                this._ws.send(new ArrayBuffer(0));
                this._ws.close(1000, 'User stopped');
            }
            this._ws = null;
        }

        if (this._audioWorklet) {
            this._audioWorklet.disconnect();
            this._audioWorklet = null;
        }

        if (this._audioContext) {
            this._audioContext.close();
            this._audioContext = null;
        }
    }

    // ═══════════════════════════════════════
    // Common
    // ═══════════════════════════════════════

    _addTranscriptLine(text, detectedLang) {
        if (!text) return;
        const now = new Date();
        const timestamp = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

        this._lineCounter++;
        const lineId = `line-${this._lineCounter}`;
        this.transcriptLines = [
            ...this.transcriptLines,
            {
                id: lineId,
                text: text,
                timestamp: timestamp,
                cssClass: 'transcript-line final'
            }
        ];

        this._fullTranscript += (this._fullTranscript ? ' ' : '') + text;
        this._scrollTranscript();

        // Determine source language: use detected language from ASF, fall back to dropdown
        const sourceLang = this._resolveSourceLang(detectedLang);

        // Always translate to English unless already English
        if (sourceLang !== 'en') {
            this._translateLine(lineId, text, sourceLang);
        } else {
            this.translationLines = [
                ...this.translationLines,
                { id: lineId, text: text, timestamp: timestamp, cssClass: 'transcript-line final' }
            ];
            this._scrollTranslation();
        }
    }

    _resolveSourceLang(detectedLang) {
        if (!detectedLang) return this.selectedLanguage;
        // ASF returns codes like 'hi', 'en', 'ta', etc. or BCP-47 like 'hi-IN'
        const short = detectedLang.split('-')[0].toLowerCase();
        if (short === 'en') return 'en';
        return short || this.selectedLanguage;
    }

    async _translateLine(lineId, text, sourceLang) {
        try {
            // Add a placeholder while translating
            this.translationLines = [
                ...this.translationLines,
                { id: lineId, text: '...', timestamp: '', cssClass: 'transcript-line interim' }
            ];
            this._scrollTranslation();

            const translated = await translateText({ text, sourceLanguage: sourceLang, targetLanguage: 'en' });
            // Replace placeholder with actual translation
            this.translationLines = this.translationLines.map(line =>
                line.id === lineId
                    ? { ...line, text: translated || text, cssClass: 'transcript-line final' }
                    : line
            );
            this._scrollTranslation();
        } catch (err) {
            console.error('Translation error:', err);
            // Replace placeholder with original text on failure
            this.translationLines = this.translationLines.map(line =>
                line.id === lineId
                    ? { ...line, text: `[${text}]`, cssClass: 'transcript-line final' }
                    : line
            );
        }
    }

    _scrollTranslation() {
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => {
            const panel = this.template.querySelector('.translation-body');
            if (panel) {
                panel.scrollTop = panel.scrollHeight;
            }
        }, 100);
    }

    _scrollTranscript() {
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => {
            const panel = this.template.querySelector('.transcript-body');
            if (panel) {
                panel.scrollTop = panel.scrollHeight;
            }
        }, 100);
    }

    stopRecording() {
        this.isRecording = false;

        if (this._durationInterval) {
            clearInterval(this._durationInterval);
            this._durationInterval = null;
        }

        if (this._chunkInterval) {
            clearInterval(this._chunkInterval);
            this._chunkInterval = null;
        }

        if (this._watchdogInterval) {
            clearInterval(this._watchdogInterval);
            this._watchdogInterval = null;
        }

        // Stop native speech recognition
        if (this._recognition) {
            this._recognition.onend = null;
            this._recognition.onresult = null;
            this._recognition.onerror = null;
            try { this._recognition.abort(); } catch (e) { /* ignore */ }
            this._recognition = null;
        }

        // Stop Speech Foundations WebSocket streaming
        this._stopSpeechFoundationsStreaming();

        // Stop media recorder
        if (this._mediaRecorder && this._mediaRecorder.state === 'recording') {
            this._mediaRecorder.stop();
        }

        if (this._mediaStream) {
            this._mediaStream.getTracks().forEach(track => track.stop());
            this._mediaStream = null;
        }

        this.interimText = '';
    }

    handleClear() {
        this.transcriptLines = [];
        this.translationLines = [];
        this.interimText = '';
        this._fullTranscript = '';
        this._lineCounter = 0;
        this.errorMessage = '';
        this.asrMode = '';
        this.agentResponse = '';
        this.agentCoveredItems = [];
        this.agentPendingItems = [];
        this.agentOccupation = '';
        this.agentCoveredCount = 0;
        this.agentPendingCount = 0;
        this.agentTotalCount = 0;
    }

    _blobToBase64(blob) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.readAsDataURL(blob);
        });
    }

    disconnectedCallback() {
        if (this.isRecording) {
            this.stopRecording();
        }
    }
}
