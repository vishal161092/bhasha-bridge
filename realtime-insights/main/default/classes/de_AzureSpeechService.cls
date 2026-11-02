/**
 * Issues a short-lived (~10 min) Azure Speech authorization token so the browser SDK never sees
 * the subscription key. The key and region live in the de_Voice_Config__mdt.Default record.
 */
public with sharing class de_AzureSpeechService {

    @AuraEnabled
    public static Map<String, String> getAzureConfig() {
        de_Voice_Config__mdt config = de_Voice_Config__mdt.getInstance('Default');

        if (config == null || String.isBlank(config.Azure_Key__c) || config.Azure_Key__c == 'REPLACE_ME'
            || String.isBlank(config.Azure_Region__c)) {
            throw new AuraHandledException('Azure Speech credentials not configured in de_Voice_Config__mdt.');
        }

        HttpRequest req = new HttpRequest();
        req.setEndpoint('https://' + config.Azure_Region__c + '.api.cognitive.microsoft.com/sts/v1.0/issueToken');
        req.setMethod('POST');
        req.setHeader('Ocp-Apim-Subscription-Key', config.Azure_Key__c);
        req.setHeader('Content-Length', '0');
        req.setTimeout(15000);

        HttpResponse res = new Http().send(req);
        if (res.getStatusCode() != 200) {
            throw new AuraHandledException('Azure token request failed (' + res.getStatusCode() + ').');
        }

        return new Map<String, String>{
            'token' => res.getBody(),
            'region' => config.Azure_Region__c
        };
    }
}
