public with sharing class de_TranscriptAnalysisAction {

    public class ActionInput {
        @InvocableVariable(required=true description='The Contact record ID')
        public String contactId;

        @InvocableVariable(required=true description='Newline-separated list of PD questions')
        public String questionList;

        @InvocableVariable(required=true description='Real-time conversation transcription in English')
        public String realtimeTranscription;
    }

    public class ActionOutput {
        @InvocableVariable(description='Analysis result with covered and pending questions')
        public String analysisResult;
    }

    @InvocableMethod(label='Analyze Transcript Against PD Questions' description='Analyzes real-time transcription against PD questions for a contact. Returns customer context, questions, and transcript for the agent to analyze.' category='PD Agent')
    public static List<ActionOutput> analyzeTranscript(List<ActionInput> inputs) {
        List<ActionOutput> outputs = new List<ActionOutput>();

        for (ActionInput input : inputs) {
            ActionOutput output = new ActionOutput();
            try {
                Contact con = [SELECT Id, Name, Occupation__c, Phone, Email
                    FROM Contact WHERE Id = :input.contactId LIMIT 1];

                Map<String, Object> result = new Map<String, Object>();
                result.put('contact', new Map<String, Object>{
                    'id' => con.Id,
                    'name' => con.Name,
                    'occupation' => con.Occupation__c,
                    'phone' => con.Phone,
                    'email' => con.Email
                });
                result.put('questionList', input.questionList);
                result.put('transcript', input.realtimeTranscription);
                result.put('instructions', 'Compare the transcript against the PD questions. ' +
                    'A question is Covered if its intent was addressed (even with different wording). ' +
                    'A question is Pending if not discussed. Ignore greetings and small talk. ' +
                    'Return JSON with: occupation, summary (totalQuestions, coveredQuestions, pendingQuestions), ' +
                    'coveredQuestions array (sequence, question, status, evidence), ' +
                    'pendingQuestions array (sequence, question).');

                output.analysisResult = JSON.serialize(result);
            } catch (Exception e) {
                output.analysisResult = '{"error": "' + e.getMessage().escapeJava() + '"}';
            }
            outputs.add(output);
        }
        return outputs;
    }
}
