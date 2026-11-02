@IsTest
private class BhashiniServiceTest {

    private class Mock implements HttpCalloutMock {
        String body;
        Integer status;
        Mock(Integer status, String body) {
            this.status = status;
            this.body = body;
        }
        public HttpResponse respond(HttpRequest req) {
            System.assertEquals('POST', req.getMethod());
            System.assert(req.getEndpoint().startsWith('callout:Bhashini'));
            HttpResponse res = new HttpResponse();
            res.setStatusCode(status);
            res.setBody(body);
            return res;
        }
    }

    @IsTest
    static void transcribeReturnsSourceText() {
        Test.setMock(HttpCalloutMock.class, new Mock(200, '{"pipelineResponse":[{"output":[{"source":"namaste"}]}]}'));
        Test.startTest();
        String text = BhashiniService.transcribeAudio('hi', 'dGVzdA==');
        Test.stopTest();
        System.assertEquals('namaste', text);
    }

    @IsTest
    static void translateReturnsTarget() {
        Test.setMock(HttpCalloutMock.class, new Mock(200, '{"pipelineResponse":[{"output":[{"target":"hello"}]}]}'));
        System.assertEquals('hello', BhashiniService.translateText('namaste', 'hi', 'en'));
    }

    @IsTest
    static void generateVoiceStoresFile() {
        Test.setMock(HttpCalloutMock.class, new Mock(200, '{"pipelineResponse":[{"audio":[{"audioContent":"dGVzdA=="}]}]}'));
        String url = BhashiniService.generateVoice('ta', 'vanakkam');
        System.assert(url.startsWith('/sfc/servlet.shepherd/document/download/'));
    }

    @IsTest
    static void unsupportedLanguageThrows() {
        try {
            BhashiniService.transcribeAudio('xx', 'dGVzdA==');
            System.assert(false, 'expected exception');
        } catch (AuraHandledException e) {
            System.assert(true);
        }
    }

    @IsTest
    static void errorStatusThrows() {
        Test.setMock(HttpCalloutMock.class, new Mock(500, 'boom'));
        try {
            BhashiniService.translateText('x', '', 'en');
            System.assert(false, 'expected exception');
        } catch (AuraHandledException e) {
            System.assert(true);
        }
    }
}
