public with sharing class de_AgentService {

    private static final String AGENT_ID = Label.PD_Agent_Id;
    // Named Credential 'Agent_API' (https://api.salesforce.com) with an OAuth client-credentials
    // External Credential handles authentication; no client id/secret lives in code or labels.
    private static final String API_BASE = 'callout:Agent_API/einstein/ai-agent/v1';

    @AuraEnabled
    public static String createSession(String contactId, String questionList, String realtimeTranscription) {
        String externalKey = contactId + '-' + String.valueOf(Datetime.now().getTime());

        Map<String, Object> requestBody = new Map<String, Object>{
            'externalSessionKey' => externalKey,
            'instanceConfig' => new Map<String, Object>{
                'endpoint' => URL.getOrgDomainURL().toExternalForm()
            },
            'streamingCapabilities' => new Map<String, Object>{
                'chunkTypes' => new List<String>{ 'Text' }
            },
            'variables' => new List<Object>{
                new Map<String, Object>{ 'name' => 'conId', 'type' => 'Text', 'value' => contactId },
                new Map<String, Object>{ 'name' => 'questList', 'type' => 'Text', 'value' => questionList != null ? questionList : '' },
                new Map<String, Object>{ 'name' => 'Transcription', 'type' => 'Text', 'value' => realtimeTranscription != null ? realtimeTranscription : '' }
            }
        };

        String sessionEndpoint = API_BASE + '/agents/' + AGENT_ID + '/sessions';

        HttpRequest req = new HttpRequest();
        req.setEndpoint(sessionEndpoint);
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/json');
        req.setBody(JSON.serialize(requestBody));
        req.setTimeout(30000);

        Http http = new Http();
        HttpResponse res = http.send(req);

        if (res.getStatusCode() != 200 && res.getStatusCode() != 201) {
            throw new AuraHandledException('Create session failed: ' + res.getStatusCode() + ' ' + res.getBody());
        }

        Map<String, Object> body = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
        String sessionId = (String) body.get('sessionId');
        return sessionId;
    }

    @AuraEnabled
    public static String analyzeTranscript(String contactId, String questionList, String realtimeTranscription) {
        Contact con = [SELECT Id, Name, Occupation__c FROM Contact WHERE Id = :contactId LIMIT 1];

        String sessionId = createSession(contactId, questionList, realtimeTranscription);

        String message = 'Analyze this transcript against the PD questions. Respond directly with your analysis.\n\n' +
            'CUSTOMER: ' + con.Name + ' (Occupation: ' + (con.Occupation__c != null ? con.Occupation__c : 'Unknown') + ')\n\n' +
            'PD QUESTIONS:\n' + questionList + '\n\n' +
            'TRANSCRIPT:\n' + realtimeTranscription + '\n\n' +
            'INSTRUCTIONS: Compare the transcript against each PD question. For each question, mark as COVERED (quote evidence from transcript) or PENDING (not discussed). ' +
            'Return a structured JSON with: {"coveredQuestions": [{"question": "...", "evidence": "..."}], "pendingQuestions": [{"question": "..."}]}';

        String response = sendMessage(sessionId, message, 1);

        try { endSession(sessionId); } catch (Exception e) { /* best effort */ }

        return response;
    }

    @AuraEnabled
    public static String sendMessage(String sessionId, String messageText, Integer sequenceId) {
        Map<String, Object> requestBody = new Map<String, Object>{
            'message' => new Map<String, Object>{
                'sequenceId' => String.valueOf(sequenceId),
                'type' => 'Text',
                'text' => messageText
            }
        };

        HttpRequest req = new HttpRequest();
        req.setEndpoint(API_BASE + '/sessions/' + sessionId + '/messages');
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/json');
        req.setBody(JSON.serialize(requestBody));
        req.setTimeout(120000);

        Http http = new Http();
        HttpResponse res = http.send(req);

        System.debug('=== SEND MESSAGE RESPONSE ===');
        System.debug('Status: ' + res.getStatusCode());
        System.debug('Raw Body: ' + res.getBody());

        if (res.getStatusCode() != 200 && res.getStatusCode() != 201) {
            throw new AuraHandledException('Send message failed: ' + res.getStatusCode() + ' ' + res.getBody());
        }

        Map<String, Object> body = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
        System.debug('Parsed keys: ' + body.keySet());

        List<Object> messages = (List<Object>) body.get('messages');
        String responseText = '';
        if (messages != null) {
            System.debug('Messages count: ' + messages.size());
            for (Object msg : messages) {
                Map<String, Object> m = (Map<String, Object>) msg;
                System.debug('Message entry: ' + JSON.serialize(m));
                String msgType = (String) m.get('type');
                if (msgType == 'Text' || msgType == 'Inform' || msgType == 'text' || msgType == 'inform') {
                    String text = (String) m.get('message');
                    if (text == null) text = (String) m.get('text');
                    if (String.isNotBlank(text)) {
                        responseText += text + '\n';
                    }
                }
            }
        } else {
            System.debug('No messages key found. Trying alternate structures...');
            // Try response.messages or data.messages
            Object respObj = body.get('response');
            if (respObj != null) {
                System.debug('Found response key: ' + JSON.serialize(respObj));
            }
            // Fall back to returning raw body for debugging
            responseText = res.getBody();
        }
        System.debug('Final responseText: ' + responseText);
        return responseText.trim();
    }

    @AuraEnabled
    public static void endSession(String sessionId) {
        HttpRequest req = new HttpRequest();
        req.setEndpoint(API_BASE + '/sessions/' + sessionId);
        req.setMethod('DELETE');
        req.setTimeout(10000);

        Http http = new Http();
        http.send(req);
    }
}
