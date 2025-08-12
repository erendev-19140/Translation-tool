//install dependencies 
//npm init -y
//npm i express node-fetch multer

// server.js - simple proxy for Bhashini
const express = require('express');
const fetch = (...args) => import('node-fetch').then(m => m.default(...args));
const multer = require('multer');
const upload = multer();
const app = express();
app.use(express.json());

// Put your Bhashini API key in an env var: BHASHINI_API_KEY
const BHASHINI_KEY = process.env.BHASHINI_API_KEY;
if(!BHASHINI_KEY) console.warn('Warning: Set BHASHINI_API_KEY env var.');

// optional mapping from client codes to Bhashini language names/voice ids:
const LANG_MAP = {
  "hi":"Hindi", "en":"English", "bn":"Bengali", "mr":"Marathi", "ta":"Tamil",
  "te":"Telugu", "kn":"Kannada", "ml":"Malayalam", "or":"Odia", "pa":"Punjabi",
  "gu":"Gujarati", "as":"Assamese", "brx":"Bodo", "doi":"Dogri", "kok":"Konkani",
  "mai":"Maithili", "mni":"Manipuri", "ne":"Nepali", "sa":"Sanskrit", "sat":"Santali",
  "sd":"Sindhi", "ur":"Urdu"
};

// TRANSLATE proxy
app.post('/api/bhashini/translate', async (req, res) => {
  try {
    const { q, from='auto', to='hi' } = req.body;
    // Map to Bhashini expected names or service ids. Bhashini docs show translation endpoints in OpenAPI.
    const payload = {
      inputText: q,
      inputLanguage: LANG_MAP[from] || (from==='auto' ? 'Auto' : LANG_MAP[to] || from),
      outputLanguage: LANG_MAP[to] || to
    };
    const resp = await fetch('https://bhashini.ai/v1/translate', { // placeholder; adjust to exact endpoint per Bhashini docs
      method:'POST',
      headers: {
        'Content-Type':'application/json',
        'X-API-KEY': BHASHINI_KEY
      },
      body: JSON.stringify(payload)
    });
    if(!resp.ok) {
      const t = await resp.text(); return res.status(resp.status).send(t);
    }
    const j = await resp.json();
    // Adapt the shape to client: { translatedText, transliteration?, detectedSource }
    return res.json({
      translatedText: j.outputText || j.translatedText || j.translation || '',
      transliteration: j.transliteration || null,
      detectedSource: j.detectedSource || null
    });
  } catch(err){
    console.error(err); res.status(500).send(String(err));
  }
});

// TTS proxy: forwards to Bhashini TTS synth endpoint and streams back audio/mpeg
app.post('/api/bhashini/tts', async (req, res) => {
  try {
    const { text, lang='Hindi', options={} } = req.body;
    const payload = {
      text,
      language: LANG_MAP[lang] || lang || 'Hindi',
      voiceName: options.voice || 'Female1'
    };
    // Bhashini TTS endpoint (example)
    const resp = await fetch('https://tts.bhashini.ai/v1/synthesize', {
      method:'POST',
      headers: {
        'Content-Type':'application/json',
        'accept': 'audio/mpeg',
        'X-API-KEY': BHASHINI_KEY
      },
      body: JSON.stringify(payload)
    });
    if(!resp.ok) {
      const t = await resp.text(); return res.status(resp.status).send(t);
    }
    // stream audio back
    res.setHeader('Content-Type','audio/mpeg');
    resp.body.pipe(res);
  } catch(err){
    console.error(err); res.status(500).send(String(err));
  }
});

// ASR proxy: accept file upload from client, forward to Bhashini ASR service
app.post('/api/bhashini/asr', upload.single('audio'), async (req, res) => {
  try {
    const lang = req.body.lang || 'Hindi';
    if(!req.file) return res.status(400).send('No audio uploaded');
    // Bhashini ASR endpoint - sample
    const form = new FormData();
    form.append('file', req.file.buffer, { filename: 'speech.wav' });
    form.append('language', LANG_MAP[lang] || lang);
    const resp = await fetch('https://asr.bhashini.ai/v1/recognize', {
      method:'POST',
      headers: {
        'X-API-KEY': BHASHINI_KEY,
        // note: with form-data, do NOT set Content-Type manually
      },
      body: form
    });
    if(!resp.ok) return res.status(resp.status).send(await resp.text());
    const j = await resp.json();
    // Example return: { text: 'recognized text' }
    res.json({ text: j.text || j.transcript || '' });
  } catch(err){
    console.error(err); res.status(500).send(String(err));
  }
});

app.use(express.static('public')); // serve your index.html + assets

const port = process.env.PORT || 3000;
app.listen(port, ()=>console.log('Server listening', port));
