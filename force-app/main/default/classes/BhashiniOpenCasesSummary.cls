/**
 * Flow / Agentforce invocable action: summarises a contact's open Cases in the requested
 * Indian language using the platform LLM, ready to be spoken with bhashiniTextToVoice.
 */
public with sharing class BhashiniOpenCasesSummary {

    @InvocableMethod(label='Summarise Open Cases in Indic Language' description='Summarise the three most recent open cases for a contact in the requested language (default Hindi)')
    public static List<InvocableResponse> getSummary(List<InvocableRequest> requests) {
        List<InvocableResponse> responses = new List<InvocableResponse>();
        for (InvocableRequest request : requests) {
            InvocableResponse response = new InvocableResponse();
            try {
                String language = String.isBlank(request.language) ? 'Hindi' : request.language;

                aiplatform.ModelsAPI.createGenerations_Request apiRequest = new aiplatform.ModelsAPI.createGenerations_Request();
                apiRequest.modelName = 'sfdc_ai__DefaultOpenAIGPT4Turbo';
                aiplatform.ModelsAPI_GenerationRequest requestBody = new aiplatform.ModelsAPI_GenerationRequest();
                apiRequest.body = requestBody;

                List<Case> cases = [
                    SELECT Id, Subject, CaseNumber, Status
                    FROM Case
                    WHERE ContactId = :request.contactId AND Status != 'Closed'
                    ORDER BY CreatedDate DESC
                    LIMIT 3
                ];

                requestBody.prompt = 'You are a Service Rep who will be giving details to the Customer on the Open Cases that they have. Refer the data from '
                    + cases + ' and build a bulleted response. Do not add any special characters to it. Give the Output in '
                    + language + ' Language wherever applicable. Keep the output short.';

                aiplatform.ModelsAPI modelsAPI = new aiplatform.ModelsAPI();
                aiplatform.ModelsAPI.createGenerations_Response apiResponse = modelsAPI.createGenerations(apiRequest);
                response.generatedText = apiResponse.Code200.generation.generatedText;
            } catch (aiplatform.ModelsAPI.createGenerations_ResponseException e) {
                response.errorMessage = 'Error: ' + e.getMessage();
            } catch (Exception ex) {
                response.errorMessage = 'Unexpected error: ' + ex.getMessage();
            }
            responses.add(response);
        }
        return responses;
    }

    public class InvocableRequest {
        @InvocableVariable(required=true description='Contact ID for which to fetch open cases')
        public String contactId;

        @InvocableVariable(description='Output language name, e.g. Hindi, Bangla, Gujarati, Marathi, Tamil, Telugu. Defaults to Hindi.')
        public String language;
    }

    public class InvocableResponse {
        @InvocableVariable(description='Generated summary in the requested language')
        public String generatedText;

        @InvocableVariable(description='Error message if any')
        public String errorMessage;
    }
}
