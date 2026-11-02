/**
 * Server-side client for the Government of India Bhashini (Dhruva) inference pipeline.
 *
 * All callouts go through the `Bhashini` Named Credential (callout:Bhashini), which injects the
 * API key from the `Bhashini_EC` External Credential. No key ever reaches the browser.
 *
 * Supported language codes: en, hi, bn, gu, mr, ta, te (see LANGUAGES).
 */
public with sharing class BhashiniService {
    private static final String PIPELINE_PATH = 'callout:Bhashini/services/inference/pipeline';

    /** Per-language model configuration. */
    private class LangConfig {
        String asrServiceId;
        String asrModelId;
        String ttsServiceId;
        LangConfig(String asrServiceId, String asrModelId, String ttsServiceId) {
            this.asrServiceId = asrServiceId;
            this.asrModelId = asrModelId;
            this.ttsServiceId = ttsServiceId;
        }
    }

    private static final String ASR_INDIC = 'ai4bharat/conformer-hi-gpu--t4';
    private static final String TTS_INDO_ARYAN = 'ai4bharat/indic-tts-coqui-indo_aryan-gpu--t4';
    private static final String TTS_DRAVIDIAN = 'ai4bharat/indic-tts-coqui-dravidian-gpu--t4';

    private static final Map<String, LangConfig> LANGUAGES = new Map<String, LangConfig>{
        'en' => new LangConfig('ai4bharat/whisper-medium-en--gpu--t4', '641c0be440abd176d64c3f92', null),
        'hi' => new LangConfig(ASR_INDIC, null, TTS_INDO_ARYAN),
        'bn' => new LangConfig(ASR_INDIC, null, TTS_INDO_ARYAN),
        'gu' => new LangConfig(ASR_INDIC, null, TTS_INDO_ARYAN),
        'mr' => new LangConfig(ASR_INDIC, null, TTS_INDO_ARYAN),
        'ta' => new LangConfig(ASR_INDIC, null, TTS_DRAVIDIAN),
        'te' => new LangConfig(ASR_INDIC, null, TTS_INDO_ARYAN)
    };

    /** Speech-to-text. Audio is base64 webm @ 16 kHz as captured by MediaRecorder. */
    @AuraEnabled
    public static String transcribeAudio(String languageCode, String base64Audio) {
        LangConfig cfg = config(languageCode);
        if (String.isBlank(base64Audio)) {
            throw new AuraHandledException('No audio supplied.');
        }
        Map<String, Object> asrConfig = new Map<String, Object>{
            'language' => new Map<String, String>{ 'sourceLanguage' => languageCode },
            'serviceId' => cfg.asrServiceId,
            'audioFormat' => 'webm',
            'samplingRate' => 16000
        };
        if (cfg.asrModelId != null) {
            asrConfig.put('modelId', cfg.asrModelId);
        }
        Map<String, Object> body = new Map<String, Object>{
            'pipelineTasks' => new List<Object>{
                new Map<String, Object>{ 'taskType' => 'asr', 'config' => asrConfig }
            },
            'inputData' => new Map<String, Object>{
                'audio' => new List<Object>{ new Map<String, String>{ 'audioContent' => base64Audio } }
            }
        };
        Map<String, Object> first = firstPipelineResponse(send(body, 120000));
        List<Object> output = (List<Object>) first.get('output');
        return (String) ((Map<String, Object>) output[0]).get('source');
    }

    /**
     * Text-to-speech. Stores the generated WAV as a File and returns a relative
     * download URL usable as an <audio> src from within Salesforce.
     */
    @AuraEnabled
    public static String generateVoice(String languageCode, String inputText) {
        if (String.isBlank(inputText)) {
            throw new AuraHandledException('Input text cannot be empty.');
        }
        LangConfig cfg = config(languageCode);
        if (cfg.ttsServiceId == null) {
            throw new AuraHandledException('Text-to-speech is not configured for language: ' + languageCode);
        }
        Map<String, Object> body = new Map<String, Object>{
            'pipelineTasks' => new List<Object>{
                new Map<String, Object>{
                    'taskType' => 'tts',
                    'config' => new Map<String, Object>{
                        'language' => new Map<String, Object>{ 'sourceLanguage' => languageCode },
                        'serviceId' => cfg.ttsServiceId,
                        'gender' => 'female',
                        'samplingRate' => 8000
                    }
                }
            },
            'inputData' => new Map<String, Object>{
                'input' => new List<Object>{ new Map<String, Object>{ 'source' => inputText } }
            }
        };
        Map<String, Object> first = firstPipelineResponse(send(body, 120000));
        List<Object> audio = (List<Object>) first.get('audio');
        String audioContent = (String) ((Map<String, Object>) audio[0]).get('audioContent');

        ContentVersion cv = new ContentVersion(
            Title = 'Generated Audio',
            PathOnClient = 'generated_audio.wav',
            VersionData = EncodingUtil.base64Decode(audioContent)
        );
        insert cv;
        Id docId = [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :cv.Id LIMIT 1].ContentDocumentId;
        return '/sfc/servlet.shepherd/document/download/' + docId;
    }

    /**
     * Text translation. Pass sourceLangCode = '' to let Bhashini auto-detect the source language.
     */
    @AuraEnabled
    public static String translateText(String text, String sourceLangCode, String targetLangCode) {
        if (String.isBlank(text)) {
            return '';
        }
        Map<String, Object> body = new Map<String, Object>{
            'pipelineTasks' => new List<Object>{
                new Map<String, Object>{
                    'taskType' => 'translation',
                    'config' => new Map<String, Object>{
                        'language' => new Map<String, String>{
                            'sourceLanguage' => (sourceLangCode == null ? '' : sourceLangCode),
                            'targetLanguage' => targetLangCode
                        }
                    }
                }
            },
            'inputData' => new Map<String, Object>{
                'input' => new List<Object>{ new Map<String, String>{ 'source' => text } },
                'audio' => new List<Object>()
            }
        };
        HttpResponse res = send(body, 60000);
        Map<String, Object> first = firstPipelineResponse(res);
        List<Object> output = (List<Object>) first.get('output');
        return (String) ((Map<String, Object>) output[0]).get('target');
    }

    // ---- helpers -------------------------------------------------------------------------

    private static LangConfig config(String languageCode) {
        if (String.isBlank(languageCode) || !LANGUAGES.containsKey(languageCode)) {
            throw new AuraHandledException('Unsupported language code: ' + languageCode);
        }
        return LANGUAGES.get(languageCode);
    }

    private static HttpResponse send(Map<String, Object> body, Integer timeoutMs) {
        HttpRequest req = new HttpRequest();
        req.setEndpoint(PIPELINE_PATH);
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/json');
        req.setTimeout(timeoutMs);
        req.setBody(JSON.serialize(body));
        HttpResponse res;
        try {
            res = new Http().send(req);
        } catch (Exception ex) {
            throw new AuraHandledException('Bhashini callout failed: ' + ex.getMessage());
        }
        if (res.getStatusCode() != 200) {
            throw new AuraHandledException('Bhashini error (HTTP ' + res.getStatusCode() + '): ' + res.getBody());
        }
        return res;
    }

    private static Map<String, Object> firstPipelineResponse(HttpResponse res) {
        Map<String, Object> parsed = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
        List<Object> pipelineResponse = (List<Object>) parsed.get('pipelineResponse');
        if (pipelineResponse == null || pipelineResponse.isEmpty()) {
            throw new AuraHandledException('Bhashini returned an empty pipeline response.');
        }
        return (Map<String, Object>) pipelineResponse[0];
    }
}
