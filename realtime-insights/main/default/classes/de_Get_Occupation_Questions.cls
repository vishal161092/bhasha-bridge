public with sharing class de_Get_Occupation_Questions {

    @InvocableMethod(label='Get Occupation Questions')
    public static List<Response> getOccupationQuestions(List<Request> requests) {

        Request input = requests[0];

        String context = '';

        // Convert "Software Developer" -> "Software_Developer"
        String occupation =
            input.occupation == null
            ? ''
            : input.occupation.trim().replace(' ', '_');

        ConnectApi.CdpQueryInput queryInput =
            new ConnectApi.CdpQueryInput();

        queryInput.sql =
            'SELECT "Chunk__c" ' +
            'FROM "ADL_PDF_Resources_chunk__dlm" ' +
            'WHERE "SourceRecordId__c" LIKE \'%' +
            String.escapeSingleQuotes(occupation) +
            '%\' ' +
            'ORDER BY "ChunkSequenceNumber__c" ASC';

        System.debug('Query ==> ' + queryInput.sql);

        ConnectApi.CdpQueryOutput response =
            ConnectApi.CdpQuery.queryAnsiSql(queryInput);

        System.debug('Response ==> ' + response);
        System.debug('Rows ==> ' + response.data.size());

        List<Object> data = response.data;

        for(Object record : data){

            context += '\n' + record;

        }

        List<Response> responses = new List<Response>();

        Response res = new Response();
        res.questions = context.trim();

        responses.add(res);

        return responses;
    }

    public class Request{

        @InvocableVariable(required=true)
        public String occupation;

    }

    public class Response{

        @InvocableVariable
        public String questions;

    }

}