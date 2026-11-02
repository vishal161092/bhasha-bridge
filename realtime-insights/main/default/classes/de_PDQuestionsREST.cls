@RestResource(urlMapping='/pd-questions/*')
global with sharing class de_PDQuestionsREST {

    @HttpGet
    global static String doGet() {
        RestRequest req = RestContext.request;
        String contactId = req.params.get('contactId');
        if (String.isBlank(contactId)) {
            RestContext.response.statusCode = 400;
            return '{"error":"Missing contactId parameter"}';
        }
        return de_InsightService.getPDQuestions(contactId);
    }
}
