public with sharing class de_BhashiniService {

    // Named Credential 'Bhashini' injects the API key; nothing secret lives in code or CMDT.
    private static final String BHASHINI_URL = 'callout:Bhashini/services/inference/pipeline';

    @AuraEnabled
    public static Map<String, Object> getPipelineConfig(String sourceLanguage) {
        return new Map<String, Object>{ 'language' => sourceLanguage };
    }

    @AuraEnabled
    public static String transcribeAudio(String audioBase64, String sourceLanguage) {
        Map<String, Object> langConfig = new Map<String, Object>{ 'sourceLanguage' => sourceLanguage };
        Map<String, Object> config = new Map<String, Object>{ 'language' => langConfig };
        Map<String, Object> task = new Map<String, Object>{ 'taskType' => 'asr', 'config' => config };

        Map<String, Object> audioItem = new Map<String, Object>{ 'audioContent' => audioBase64 };
        List<Object> audioList = new List<Object>{ audioItem };
        Map<String, Object> inputData = new Map<String, Object>{ 'audio' => audioList };

        Map<String, Object> requestBody = new Map<String, Object>{
            'pipelineTasks' => new List<Object>{ task },
            'inputData' => inputData
        };

        HttpRequest req = new HttpRequest();
        req.setEndpoint(BHASHINI_URL);
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/json');
        req.setBody(JSON.serialize(requestBody));
        req.setTimeout(30000);

        Http http = new Http();
        HttpResponse res = http.send(req);

        if (res.getStatusCode() != 200) {
            throw new AuraHandledException('Transcription failed (' + res.getStatusCode() + '): ' + res.getBody());
        }

        Map<String, Object> responseBody = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
        List<Object> pipelineResponse = (List<Object>) responseBody.get('pipelineResponse');

        if (pipelineResponse != null && !pipelineResponse.isEmpty()) {
            Map<String, Object> firstResponse = (Map<String, Object>) pipelineResponse[0];
            List<Object> outputList = (List<Object>) firstResponse.get('output');
            if (outputList != null && !outputList.isEmpty()) {
                Map<String, Object> outputItem = (Map<String, Object>) outputList[0];
                return (String) outputItem.get('source');
            }
        }

        return '';
    }

    @AuraEnabled
    public static Map<String, Object> getASFStreamConfig(String sourceLanguage) {
        de_Voice_Config__mdt config = de_Voice_Config__mdt.getInstance('Default');
        return new Map<String, Object>{
            'wsEndpoint' => config.ASF_Endpoint__c,
            'token' => UserInfo.getSessionId(),
            'language' => sourceLanguage
        };
    }

    @AuraEnabled
    public static String translateText(String text, String sourceLanguage, String targetLanguage) {
        Map<String, Object> langConfig = new Map<String, Object>{
            'sourceLanguage' => sourceLanguage,
            'targetLanguage' => targetLanguage
        };
        Map<String, Object> taskConfig = new Map<String, Object>{ 'language' => langConfig };
        Map<String, Object> task = new Map<String, Object>{ 'taskType' => 'translation', 'config' => taskConfig };

        Map<String, Object> inputItem = new Map<String, Object>{ 'source' => text };
        List<Object> inputList = new List<Object>{ inputItem };
        Map<String, Object> inputData = new Map<String, Object>{ 'input' => inputList };

        Map<String, Object> requestBody = new Map<String, Object>{
            'pipelineTasks' => new List<Object>{ task },
            'inputData' => inputData
        };

        HttpRequest req = new HttpRequest();
        req.setEndpoint(BHASHINI_URL);
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/json');
        req.setBody(JSON.serialize(requestBody));
        req.setTimeout(30000);

        Http http = new Http();
        HttpResponse res = http.send(req);

        if (res.getStatusCode() != 200) {
            throw new AuraHandledException('Translation failed (' + res.getStatusCode() + '): ' + res.getBody());
        }

        Map<String, Object> responseBody = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
        List<Object> pipelineResponse = (List<Object>) responseBody.get('pipelineResponse');

        if (pipelineResponse != null && !pipelineResponse.isEmpty()) {
            Map<String, Object> firstResponse = (Map<String, Object>) pipelineResponse[0];
            List<Object> outputList = (List<Object>) firstResponse.get('output');
            if (outputList != null && !outputList.isEmpty()) {
                Map<String, Object> outputItem = (Map<String, Object>) outputList[0];
                return (String) outputItem.get('target');
            }
        }

        return text;
    }
}
