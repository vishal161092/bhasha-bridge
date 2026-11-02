const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const BHASHINI_URL = 'https://dhruva-api.bhashini.gov.in/services/inference/pipeline';
const BHASHINI_KEY = process.env.BHASHINI_API_KEY || '';

const SF_ORG_DOMAIN = process.env.SF_ORG_DOMAIN || ''; // e.g. https://your-domain.my.salesforce.com
const SF_CLIENT_ID = process.env.SF_CLIENT_ID || '';
const SF_CLIENT_SECRET = process.env.SF_CLIENT_SECRET || '';
const SF_AGENT_ID = process.env.SF_AGENT_ID || '';
const SF_CONTACT_ID = process.env.SF_CONTACT_ID || '';
const AGENT_API_BASE = 'https://api.salesforce.com/einstein/ai-agent/v1';

let cachedToken = null;
let tokenExpiry = 0;

async function getSFAccessToken() {
    if (cachedToken && Date.now() < tokenExpiry) {
        return cachedToken;
    }

    const tokenUrl = `${SF_ORG_DOMAIN}/services/oauth2/token`;
    const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: SF_CLIENT_ID,
        client_secret: SF_CLIENT_SECRET
    });

    const resp = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
    });

    if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`OAuth failed: ${resp.status} ${err}`);
    }

    const data = await resp.json();
    cachedToken = data.access_token;
    tokenExpiry = Date.now() + 3500 * 1000;
    return cachedToken;
}

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Fetch Contact record from Salesforce
app.get('/api/contact', async (req, res) => {
    try {
        const token = await getSFAccessToken();
        const contactId = req.query.id || SF_CONTACT_ID;
        const query = `SELECT Id, Name, FirstName, LastName, Email, Phone, Title, Department, Occupation__c, MailingStreet, MailingCity, MailingState, MailingPostalCode, Account.Name FROM Contact WHERE Id = '${contactId}' LIMIT 1`;

        const resp = await fetch(`${SF_ORG_DOMAIN}/services/data/v60.0/query?q=${encodeURIComponent(query)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!resp.ok) {
            const err = await resp.text();
            return res.status(resp.status).json({ error: err });
        }

        const data = await resp.json();
        if (data.records && data.records.length > 0) {
            return res.json(data.records[0]);
        }
        res.status(404).json({ error: 'Contact not found' });
    } catch (err) {
        console.error('Contact fetch error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Fetch PD Questions via Apex REST endpoint (SSE to avoid 30s timeout)
app.get('/api/questions', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const heartbeat = setInterval(() => {
        res.write('event: heartbeat\ndata: {}\n\n');
    }, 5000);

    try {
        const token = await getSFAccessToken();
        const contactId = req.query.id || SF_CONTACT_ID;

        const resp = await fetch(`${SF_ORG_DOMAIN}/services/apexrest/pd-questions?contactId=${contactId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        clearInterval(heartbeat);

        if (!resp.ok) {
            const err = await resp.text();
            console.error('PD Questions REST error:', resp.status, err);
            res.write(`event: error\ndata: ${JSON.stringify({ error: err })}\n\n`);
            res.end();
            return;
        }

        const raw = await resp.json();
        let data = raw;
        if (typeof raw === 'string') {
            try { data = JSON.parse(raw); } catch (e) { data = { raw }; }
        }

        if (data.questions && data.questions.length > 0 && typeof data.questions[0] === 'object') {
            data.questions = data.questions.map(q => q.question || q.text || JSON.stringify(q));
        }

        res.write(`event: result\ndata: ${JSON.stringify(data)}\n\n`);
        res.end();
    } catch (err) {
        clearInterval(heartbeat);
        console.error('Questions fetch error:', err.message);
        res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
    }
});

// Fetch field labels from Contact describe
app.get('/api/field-labels', async (req, res) => {
    try {
        const token = await getSFAccessToken();
        const resp = await fetch(`${SF_ORG_DOMAIN}/services/data/v60.0/sobjects/Contact/describe`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!resp.ok) {
            return res.status(resp.status).json({ error: 'Describe failed' });
        }

        const data = await resp.json();
        const labels = {};
        for (const f of data.fields) {
            if (f.name.match(/^(swdev_|farmer_|kirana_|itc_|pharma_|prof_|factop_)/)) {
                labels[f.name] = f.label;
            }
        }
        res.json(labels);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Bhashini ASR — transcribe audio
app.post('/api/transcribe', async (req, res) => {
    const { audioBase64, sourceLanguage, audio, language } = req.body;
    const audioData = audioBase64 || audio;
    const lang = sourceLanguage || language;

    if (!audioData || !lang) {
        return res.status(400).json({ error: 'Missing audio or language' });
    }

    const body = {
        pipelineTasks: [{
            taskType: 'asr',
            config: { language: { sourceLanguage: lang } }
        }],
        inputData: { audio: [{ audioContent: audioData }] }
    };

    try {
        const resp = await fetch(BHASHINI_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': BHASHINI_KEY
            },
            body: JSON.stringify(body)
        });

        if (!resp.ok) {
            const errText = await resp.text();
            return res.status(resp.status).json({ error: errText });
        }

        const data = await resp.json();
        const pipelineResponse = data.pipelineResponse;
        if (pipelineResponse && pipelineResponse.length > 0) {
            const output = pipelineResponse[0].output;
            if (output && output.length > 0) {
                return res.json({ text: output[0].source || '' });
            }
        }
        res.json({ text: '' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Bhashini NMT — translate text
app.post('/api/translate', async (req, res) => {
    const { text, sourceLanguage, targetLanguage } = req.body;
    if (!text || !sourceLanguage || !targetLanguage) {
        return res.status(400).json({ error: 'Missing text, sourceLanguage, or targetLanguage' });
    }

    const body = {
        pipelineTasks: [{
            taskType: 'translation',
            config: { language: { sourceLanguage, targetLanguage } }
        }],
        inputData: { input: [{ source: text }] }
    };

    try {
        const resp = await fetch(BHASHINI_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': BHASHINI_KEY
            },
            body: JSON.stringify(body)
        });

        if (!resp.ok) {
            const errText = await resp.text();
            return res.status(resp.status).json({ error: errText });
        }

        const data = await resp.json();
        const pipelineResponse = data.pipelineResponse;
        if (pipelineResponse && pipelineResponse.length > 0) {
            const output = pipelineResponse[0].output;
            if (output && output.length > 0) {
                return res.json({ text: output[0].target || text });
            }
        }
        res.json({ text });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Agent Analysis — real SF Agent API (SSE polling pattern to avoid 30s timeout)
app.post('/api/agent/start', async (req, res) => {
    const { transcript, questions, fields, contactName, occupation } = req.body;
    if (!transcript || !questions) {
        return res.status(400).json({ error: 'Missing transcript or questions' });
    }

    try {
        const token = await getSFAccessToken();
        const contactId = SF_CONTACT_ID;
        const questionList = Array.isArray(questions) ? questions.join('\n') : questions;

        const sessionBody = {
            externalSessionKey: `${contactId}-${Date.now()}`,
            instanceConfig: { endpoint: SF_ORG_DOMAIN },
            streamingCapabilities: { chunkTypes: ['Text'] },
            variables: [
                { name: 'conId', type: 'Text', value: contactId },
                { name: 'questList', type: 'Text', value: questionList },
                { name: 'Transcription', type: 'Text', value: transcript }
            ]
        };

        const sessionResp = await fetch(`${AGENT_API_BASE}/agents/${SF_AGENT_ID}/sessions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(sessionBody)
        });

        if (!sessionResp.ok) {
            const err = await sessionResp.text();
            cachedToken = null;
            return res.status(sessionResp.status).json({ error: `Session failed: ${err}` });
        }

        const sessionData = await sessionResp.json();
        res.json({ sessionId: sessionData.sessionId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Agent message — uses SSE to keep connection alive past 30s
app.post('/api/agent/message', async (req, res) => {
    const { sessionId, transcript, questions, fields, contactName, occupation } = req.body;
    if (!sessionId) {
        return res.status(400).json({ error: 'Missing sessionId' });
    }

    // Set SSE headers to keep the connection alive
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Send heartbeat every 5s to prevent Heroku H12 timeout
    const heartbeat = setInterval(() => {
        res.write('event: heartbeat\ndata: {}\n\n');
    }, 5000);

    try {
        const token = await getSFAccessToken();
        const questionList = Array.isArray(questions) ? questions.join('\n') : questions;
        const fieldList = fields || '';

        const messageText = `Analyze this transcript against the PD questions. Respond directly with your analysis.\n\nCUSTOMER: ${contactName || 'Unknown'} (Occupation: ${occupation || 'Unknown'})\n\nPD QUESTIONS:\n${questionList}\n\nTRANSCRIPT:\n${transcript}\n\nINSTRUCTIONS: Compare the transcript against each PD question. For each question, mark as COVERED (quote evidence from transcript) or PENDING (not discussed).\n${fieldList ? `\nAlso extract values for these fields from the transcript: ${fieldList}\n` : ''}\nReturn ONLY valid JSON with this structure:\n{"occupation":"...","coveredQuestions":[{"sequence":1,"question":"...","evidence":"relevant quote"}],"pendingQuestions":[{"sequence":2,"question":"..."}],"summary":{"totalQuestions":N,"coveredQuestions":N,"pendingQuestions":N},"field_values":{"field_api_name":"extracted value or null"}}`;

        const msgBody = {
            message: {
                sequenceId: '1',
                type: 'Text',
                text: messageText
            }
        };

        res.write('event: status\ndata: {"status":"Sending to agent..."}\n\n');

        const msgResp = await fetch(`${AGENT_API_BASE}/sessions/${sessionId}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(msgBody)
        });

        clearInterval(heartbeat);

        if (!msgResp.ok) {
            const err = await msgResp.text();
            console.error('Agent message error:', msgResp.status, err);
            res.write(`event: error\ndata: ${JSON.stringify({ error: `Message failed: ${err}` })}\n\n`);
            res.end();
            return;
        }

        const msgData = await msgResp.json();

        // End session (best effort)
        fetch(`${AGENT_API_BASE}/sessions/${sessionId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        }).catch(() => {});

        // Extract text from response
        let responseText = '';
        const messages = msgData.messages;
        if (messages && messages.length > 0) {
            for (const m of messages) {
                const msgType = m.type;
                if (msgType === 'Text' || msgType === 'Inform' || msgType === 'text' || msgType === 'inform') {
                    const text = m.message || m.text;
                    if (text) responseText += text + '\n';
                }
            }
        }

        if (!responseText) {
            responseText = JSON.stringify(msgData);
        }

        // Parse JSON from response
        let parsed;
        try {
            let jsonStr = responseText.trim();
            if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
            else if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
            if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);

            const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                parsed = JSON.parse(jsonMatch[0]);
            } else {
                parsed = JSON.parse(jsonStr.trim());
            }
        } catch (e) {
            parsed = {
                occupation: occupation || 'Unknown',
                coveredQuestions: [],
                pendingQuestions: [],
                summary: { totalQuestions: 0, coveredQuestions: 0, pendingQuestions: 0 },
                field_values: {},
                rawResponse: responseText
            };
        }

        res.write(`event: result\ndata: ${JSON.stringify(parsed)}\n\n`);
        res.end();
    } catch (err) {
        clearInterval(heartbeat);
        console.error('Agent analysis error:', err.message);
        res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
    }
});

// Save contact fields back to Salesforce
app.post('/api/contact/save', async (req, res) => {
    const { fields } = req.body;
    if (!fields || Object.keys(fields).length === 0) {
        return res.status(400).json({ error: 'No fields to save' });
    }

    try {
        const token = await getSFAccessToken();
        const contactId = SF_CONTACT_ID;

        const resp = await fetch(`${SF_ORG_DOMAIN}/services/data/v60.0/sobjects/Contact/${contactId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(fields)
        });

        if (resp.status === 204) {
            return res.json({ success: true });
        }

        const err = await resp.text();
        res.status(resp.status).json({ error: err });
    } catch (err) {
        console.error('Contact save error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Voice Realtime Insights running on port ${PORT}`);
});
