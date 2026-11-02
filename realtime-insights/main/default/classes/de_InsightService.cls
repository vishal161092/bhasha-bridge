public with sharing class de_InsightService {

    private static final String PROMPT_TEMPLATE_API = 'DE_Realtime_Voice_Insights';

    @AuraEnabled
    public static Map<String, Object> generateInsights(String transcript, String insightType) {
        if (String.isBlank(transcript) || transcript.length() < 20) {
            return new Map<String, Object>{
                'summary' => 'Not enough conversation yet...',
                'actionItems' => new List<String>(),
                'sentiment' => 'neutral',
                'topics' => new List<String>()
            };
        }

        String responseText = invokePromptTemplate(transcript);
        return parseInsightResponse(responseText);
    }

    private static String invokePromptTemplate(String transcript) {
        try {
            // Dynamic invocation to avoid compile-time dependency on ConnectApi.EinsteinLLM
            Type llmType = Type.forName('ConnectApi', 'EinsteinLlm');
            if (llmType == null) {
                return buildFallbackInsight(transcript);
            }

            Type inputType = Type.forName('ConnectApi', 'EinsteinPromptTemplateGenerationsInput');
            Object input = inputType.newInstance();

            // Set isPreview = false
            Map<String, Object> inputMap = (Map<String, Object>) JSON.deserializeUntyped(JSON.serialize(input));
            inputMap.put('isPreview', false);

            // Build input params
            Map<String, Object> wrappedVal = new Map<String, Object>{ 'value' => transcript };
            Map<String, Object> inputParams = new Map<String, Object>{
                'Input:transcription' => wrappedVal
            };
            inputMap.put('inputParams', inputParams);

            Map<String, Object> addlConfig = new Map<String, Object>{
                'applicationName' => 'PromptTemplateGenerationsInvocable'
            };
            inputMap.put('additionalConfig', addlConfig);

            // Use HTTP callout to Connect REST API instead
            HttpRequest req = new HttpRequest();
            req.setEndpoint(URL.getOrgDomainUrl().toExternalForm() +
                '/services/data/v60.0/einstein/prompt-templates/' + PROMPT_TEMPLATE_API + '/generations');
            req.setMethod('POST');
            req.setHeader('Content-Type', 'application/json');
            req.setHeader('Authorization', 'Bearer ' + UserInfo.getSessionId());
            req.setBody(JSON.serialize(new Map<String, Object>{
                'isPreview' => false,
                'inputParams' => new Map<String, Object>{
                    'Input:transcription' => new Map<String, Object>{ 'value' => transcript }
                },
                'additionalConfig' => new Map<String, Object>{
                    'applicationName' => 'PromptTemplateGenerationsInvocable'
                }
            }));
            req.setTimeout(30000);

            Http http = new Http();
            HttpResponse res = http.send(req);

            if (res.getStatusCode() == 200) {
                Map<String, Object> body = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
                List<Object> generations = (List<Object>) body.get('generations');
                if (generations != null && !generations.isEmpty()) {
                    Map<String, Object> gen = (Map<String, Object>) generations[0];
                    return (String) gen.get('text');
                }
            }

            return buildFallbackInsight(transcript);
        } catch (Exception e) {
            return buildFallbackInsight(transcript);
        }
    }

    private static String buildFallbackInsight(String transcript) {
        List<String> words = transcript.split('\\s+');
        Integer wordCount = words.size();
        String sentiment = 'neutral';

        for (String word : words) {
            String lower = word.toLowerCase();
            if (lower.contains('good') || lower.contains('great') || lower.contains('happy') || lower.contains('agree')) {
                sentiment = 'positive';
            } else if (lower.contains('bad') || lower.contains('issue') || lower.contains('problem') || lower.contains('disagree')) {
                sentiment = 'negative';
            }
        }

        return JSON.serialize(new Map<String, Object>{
            'summary' => 'Conversation contains ' + wordCount + ' words. Prompt template invocation failed — showing basic analysis.',
            'actionItems' => new List<String>(),
            'sentiment' => sentiment,
            'topics' => new List<String>{ 'Voice Transcription' },
            'coachingTips' => new List<String>{ 'Ensure DE_Realtime_Voice_Insights prompt template is active in Prompt Builder' }
        });
    }

    private static Map<String, Object> parseInsightResponse(String responseText) {
        try {
            responseText = responseText.trim();
            if (responseText.startsWith('```json')) {
                responseText = responseText.substringAfter('```json').substringBefore('```');
            } else if (responseText.startsWith('```')) {
                responseText = responseText.substringAfter('```').substringBefore('```');
            }
            return (Map<String, Object>) JSON.deserializeUntyped(responseText.trim());
        } catch (Exception e) {
            return new Map<String, Object>{
                'summary' => responseText,
                'actionItems' => new List<String>(),
                'sentiment' => 'neutral',
                'topics' => new List<String>(),
                'coachingTips' => new List<String>()
            };
        }
    }

    @AuraEnabled(cacheable=true)
    public static String getPDQuestions(String contactId) {
        ConnectApi.EinsteinPromptTemplateGenerationsInput input = new ConnectApi.EinsteinPromptTemplateGenerationsInput();
        input.isPreview = false;

        Map<String, ConnectApi.WrappedValue> valueMap = new Map<String, ConnectApi.WrappedValue>();
        ConnectApi.WrappedValue contactVal = new ConnectApi.WrappedValue();
        contactVal.value = new Map<String, Object>{ 'Id' => contactId };
        valueMap.put('Input:contact', contactVal);
        input.inputParams = valueMap;

        input.additionalConfig = new ConnectApi.EinsteinLlmAdditionalConfigInput();
        input.additionalConfig.applicationName = 'PromptTemplateGenerationsInvocable';

        ConnectApi.EinsteinPromptTemplateGenerationsRepresentation result =
            ConnectApi.EinsteinLlm.generateMessagesForPromptTemplate('PD_Questions_Prompt', input);

        if (result.generations != null && !result.generations.isEmpty()) {
            ConnectApi.EinsteinLlmGenerationItemOutput gen = result.generations[0];
            return gen.text;
        }

        return '{}';
    }
}
