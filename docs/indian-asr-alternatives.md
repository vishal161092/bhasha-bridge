# Free/Freemium Indian Language ASR APIs with Real-Time Streaming

Research findings for alternatives to Bhashini API (as of June 2026)

---

## 1. Sarvam AI (Saaras) ⭐ RECOMMENDED

**Status:** Production-ready Indian startup with working free tier

### Languages Supported
- **12 Indian languages** (specific list not publicly disclosed in docs)
- Likely includes: Hindi, Tamil, Telugu, Bengali, Marathi, Kannada, Malayalam, Gujarati

### Real-Time Streaming
- ❌ **No WebSocket/streaming mentioned in documentation**
- Appears to be REST-based batch processing only
- May support near-real-time via chunked uploads

### Free Tier
- ✅ **₹1,000 free credits** (~$12 USD) on signup
- **Coverage:** ~33 hours (2,000 minutes) of basic STT
- Credits never expire and roll over
- No credit card required

### Pricing After Free Tier
- ₹30/hour (₹0.50/min) for basic speech-to-text
- ₹45/hour (₹0.75/min) with speaker diarization
- Billed per second, rounded up

### Rate Limits
- Starter: 60 requests/minute
- API key-based authentication

### Integration Complexity
- **Low** - REST API + Python SDK available
- Dashboard at dashboard.sarvam.ai
- Documentation at docs.sarvam.ai
- Browser testing via web playground

### Browser Support
- ✅ REST API can be called from browser with CORS
- Would need to implement chunked audio upload for pseudo-streaming

### Best Use Case
- Best for Indian language ASR with generous free tier
- Ideal for prototyping and low-volume production
- Need to test if streaming is possible via chunked requests

---

## 2. Google Cloud Speech-to-Text

**Status:** Enterprise-grade, production-ready

### Languages Supported
**13 Indian languages:**
- Hindi (`hi-IN`)
- Bengali (`bn-IN`)
- Tamil (`ta-IN`)
- Telugu (`te-IN`)
- Marathi (`mr-IN`)
- Gujarati (`gu-IN`)
- Kannada (`kn-IN`)
- Malayalam (`ml-IN`)
- Punjabi (`pa-IN`)
- Urdu (`ur-IN`)
- Assamese (`as-IN`)
- Odia (`or-IN`)
- Bhojpuri (`bho-IN`)
- English (India) (`en-IN`)

All support fast transcription ✅

### Real-Time Streaming
- ✅ **gRPC bidirectional streaming** for real-time recognition
- ❌ **No WebSocket support** - gRPC only
- ⚠️ **Browser limitation:** Requires gRPC-Web proxy (like Envoy) for browser apps
- Not directly usable from browser without server intermediary

### Free Tier
- **60 minutes per month** of free speech recognition
- Applies to all models and methods (sync, async, streaming)
- Resets monthly

### Pricing After Free Tier
- Standard models: $0.016/min ($0.96/hour)
- Premium models: $0.078/min
- Same price for streaming and batch
- Audio rounded up to nearest 15 seconds

### Integration Complexity
- **Medium-High** for browser apps due to gRPC requirement
- Would need to build backend proxy for browser-based streaming
- Official client libraries for Python, Node.js, Java, Go, C#

### Browser Support
- ❌ Direct browser streaming not supported
- Need gRPC-Web proxy layer or backend service

### Best Use Case
- Backend/server-based ASR with real-time streaming
- Enterprise applications with existing Google Cloud infrastructure
- Not ideal for pure browser-based apps

---

## 3. Azure Speech Services

**Status:** Enterprise-grade, production-ready

### Languages Supported
**13 Indian languages with fast transcription:**
- Hindi (`hi-IN`)
- Bengali (`bn-IN`)
- Tamil (`ta-IN`)
- Telugu (`te-IN`)
- Marathi (`mr-IN`)
- Gujarati (`gu-IN`)
- Kannada (`kn-IN`)
- Malayalam (`ml-IN`)
- Punjabi (`pa-IN`)
- Urdu (`ur-IN`)
- Assamese (`as-IN`)
- Odia (`or-IN`)
- Bhojpuri (`bho-IN`)
- English (India) (`en-IN`)

### Real-Time Streaming
- ✅ **WebSocket streaming via Speech SDK**
- ✅ **JavaScript SDK available** for browser apps
- ✅ **Microphone capture supported** in browser (not in Node.js)
- React sample available showing microphone → streaming ASR

### Free Tier
- Pricing information timed out during research
- Check Azure pricing page directly: https://azure.microsoft.com/pricing/details/cognitive-services/speech-services

### Integration Complexity
- **Low-Medium** for browser apps
- JavaScript SDK: `microsoft-cognitiveservices-speech-sdk` (npm)
- React sample: https://github.com/Azure-Samples/AzureSpeechReactSample
- Supports PushStream and PullStream for audio input

### Browser Support
- ✅ **Excellent browser support**
- Native microphone capture in browser
- WebSocket streaming works directly from browser

### Best Use Case
- Best for browser-based real-time streaming ASR
- Strong Indian language support
- Need to verify free tier details

---

## 4. Whisper.cpp + Self-Hosting ⭐ FULLY FREE

**Status:** Open-source, self-hosted solution

### Languages Supported
**15+ Indian/South Asian languages:**
- Hindi (`hi`)
- Bengali (`bn`)
- Tamil (`ta`)
- Telugu (`te`)
- Marathi (`mr`)
- Gujarati (`gu`)
- Kannada (`kn`)
- Malayalam (`ml`)
- Punjabi (`pa`)
- Urdu (`ur`)
- Assamese (`as`)
- Sindhi (`sd`)
- Sanskrit (`sa`)
- Nepali (`ne`)
- Sinhala (`si`)
- Pashto (`ps`)

**Note:** Odia/Oriya NOT supported

### Real-Time Streaming
- ✅ **whisper-stream example** for live microphone transcription
- Samples audio every 0.5 seconds
- Runs continuous transcription
- Requires SDL2

### Free Tier
- ✅ **Completely free** - MIT License
- Unlimited usage
- Self-hosted

### Browser Support
- ✅ **WebAssembly (WASM) support**
- Multiple WASM examples:
  - `whisper.wasm` - transcription in-browser
  - `stream.wasm` - **real-time microphone transcription in-browser** ⭐
  - `bench.wasm` - benchmarking
  - `command.wasm` - voice assistant
- SIMD optimizations available for WASM

### Deployment Options
- **HTTP Server:** `whisper-server` with OpenAI-like API
- **Docker:** Pre-built images (CPU, CUDA, Vulkan, MUSA)
- **Package managers:** npm, Conan
- **Mobile:** iOS, Android, visionOS, tvOS, macOS
- **Hardware acceleration:** CUDA, ROCm, Vulkan, Metal, CoreML, OpenVINO

### Model Sizes
- Tiny (39M params) - ~1GB VRAM, ~10x speed
- Base (74M params) - ~1GB VRAM, ~7x speed
- Small (244M params) - ~2GB VRAM, ~4x speed
- Medium (769M params) - ~5GB VRAM, ~2x speed
- Large (1550M params) - ~10GB VRAM, 1x speed
- Turbo (809M params) - ~6GB VRAM, ~8x speed (optimized large-v3)

### Integration Complexity
- **Medium-High** for self-hosting
- **Low-Medium** for WASM browser integration
- Need to host models and server
- WASM bundle can be embedded in your app

### Best Use Case
- Best for **browser-based real-time ASR** with no API costs
- Fully offline-capable
- Maximum language support (15+ Indian languages)
- Requires technical setup and hosting

---

## 5. Transformers.js (Whisper/MMS in Browser) ⭐ FULLY FREE

**Status:** Open-source JavaScript library for running ML models in-browser

### Languages Supported
- **Whisper models:** All 15+ Indian languages listed above
- **MMS (Massively Multilingual Speech):** 1,000+ languages including rare Indian languages
- **Moonshine:** Live transcription optimized model
- **Cohere ASR:** State-of-the-art open-source

### Real-Time Streaming
- ✅ **Moonshine model** designed for "Live Transcription and Voice Commands"
- Runs via ONNX Runtime in browser
- WebGPU acceleration available

### Free Tier
- ✅ **Completely free** - Apache 2.0 License
- No API calls - runs entirely in browser
- Models downloaded from HuggingFace

### Browser Support
- ✅ **Native browser execution**
- CPU (WASM) or GPU (WebGPU) inference
- Quantized models (q4, q8) for better performance

### Integration Example
```javascript
import { pipeline } from '@huggingface/transformers';
const transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-small', {
  device: 'webgpu',
  dtype: 'q8'
});
const result = await transcriber(audioData);
```

### Integration Complexity
- **Low** - npm package, simple API
- Models auto-downloaded on first use
- Need to handle microphone capture separately

### Best Use Case
- Best for **pure browser-based ASR** with no backend
- Completely private (no data sent to servers)
- Works offline after initial model download
- Good for prototyping

---

## 6. AI4Bharat IndicConformer

**Status:** Open-source research model, limited documentation

### Languages Supported
- **Not clearly specified** in documentation
- Likely covers major Indian languages
- Based on AI4Bharat's mission (10+ Indian languages expected)

### Real-Time Streaming
- ❌ **No streaming support mentioned**
- Batch processing only via NeMo toolkit

### Free Tier
- ✅ **Free (self-hosted)** - CC-BY-4.0 License
- Requires access agreement (contact info sharing)

### Deployment
- ❌ **No hosted API** - must self-host
- Requires NeMo toolkit + PyTorch
- Template/placeholder documentation

### Integration Complexity
- **High** - research model, minimal docs
- Requires ML engineering expertise

### Browser Support
- ❌ Not suitable for browser deployment

### Best Use Case
- Research and fine-tuning
- Not recommended for production use

---

## 7. Reverie Language Technologies

**Status:** Commercial Indian company

### Languages Supported
- "Indian Languages" mentioned but not specified
- Likely covers major Indian languages

### Real-Time Streaming
- ✅ Described as "realtime" STT

### Free Tier
- ❌ **No clear free tier**
- Promotional offer: ₹19.9/hour (minimum 500 hours = ₹9,950 commitment)
- Self-service platform at revup.reverieinc.com

### Integration Complexity
- Unknown - limited public documentation

### Browser Support
- Unknown

### Best Use Case
- Enterprise customers with budget
- Not recommended for free tier/prototyping

---

## 8. Deepgram

**Status:** Enterprise-grade, production-ready

### Languages Supported
- "45+ languages" with multilingual models
- ⚠️ **Indian languages not explicitly listed**
- Need to check docs at developers.deepgram.com

### Real-Time Streaming
- ✅ **WebSocket (WSS) API** for real-time streaming
- Up to 150 concurrent connections on free tier

### Free Tier
- ✅ **$200 free credit**
- No expiration, no credit card required
- Covers 3,400-4,100 minutes depending on model

### Pricing After Free Tier
- Nova-3 Multilingual: $0.0058/min
- Flux Multilingual: $0.0078/min

### Browser Support
- ✅ WebSocket streaming works from browser

### Integration Complexity
- **Low** - WebSocket API, multiple SDKs

### Best Use Case
- Excellent for WebSocket streaming
- **Only recommended if Indian languages are confirmed**
- Check language support first

---

## Comparison Table

| Solution | Real-Time | Browser-Ready | Indian Languages | Free Tier | Best For |
|----------|-----------|---------------|------------------|-----------|----------|
| **Sarvam AI** | ❌ (REST only) | ⚠️ (with chunking) | 12 ✅ | ₹1,000 credits | Indian-focused, generous free tier |
| **Google Cloud** | ✅ gRPC | ❌ (needs proxy) | 13 ✅ | 60 min/month | Backend streaming |
| **Azure Speech** | ✅ WebSocket | ✅ JS SDK | 13 ✅ | Check pricing | Browser streaming ⭐ |
| **Whisper.cpp** | ✅ stream.wasm | ✅ WASM | 15+ ✅ | Unlimited (free) | Self-hosted browser ⭐ |
| **Transformers.js** | ✅ Moonshine | ✅ Native | 15+ ✅ | Unlimited (free) | Pure browser ⭐ |
| **IndicConformer** | ❌ | ❌ | ? | Free (self-host) | Research only |
| **Reverie** | ✅ | ? | Multiple | ❌ No free | Enterprise |
| **Deepgram** | ✅ WebSocket | ✅ | Unknown | $200 credit | If Hindi supported |

---

## Recommendations by Use Case

### 1. Browser-Based Real-Time ASR (No Backend)
**Best Choice: Transformers.js + Whisper/Moonshine**
- Pros: Free, private, offline-capable, 15+ languages
- Cons: Initial model download, client-side compute

**Alternative: Whisper.cpp WASM**
- Similar benefits, different implementation

### 2. Browser-Based with Backend OK
**Best Choice: Azure Speech Services**
- Pros: Native WebSocket, browser SDK, 13 languages
- Cons: Need to verify free tier limits

**Alternative: Build proxy for Google Cloud Speech-to-Text**
- More work but solid enterprise solution

### 3. Prototyping with Indian Languages
**Best Choice: Sarvam AI**
- Pros: ₹1,000 free credits (2,000 min), Indian-focused
- Cons: No true real-time streaming (yet)

### 4. Maximum Language Coverage + Free
**Best Choice: Whisper.cpp Self-Hosted**
- Pros: 15+ languages, unlimited free, real-time
- Cons: Self-hosting complexity

### 5. Pure Browser, No Installation
**Best Choice: Transformers.js**
- Pros: npm install, runs in browser, no backend
- Cons: Client-side processing overhead

---

## Implementation Strategy Recommendation

Given your requirements (browser-based, real-time, Indian languages, free):

### Phase 1: Quick Prototype
Use **Transformers.js** with Whisper-small:
```bash
npm install @huggingface/transformers
```
- Works immediately in browser
- No backend needed
- Free and unlimited

### Phase 2: Optimize Performance
Deploy **Whisper.cpp HTTP server** with `stream.wasm`:
- Host models on your server
- Use WASM client for browser
- Better performance than pure Transformers.js

### Phase 3: Production Alternative
Integrate **Azure Speech Services**:
- Real WebSocket streaming
- Enterprise-grade reliability
- Pay-as-you-go after free tier

### Fallback Option
**Sarvam AI** for Indian-specific optimization:
- Best accuracy for Indian languages likely
- Generous free tier
- Implement pseudo-streaming via chunked uploads

---

## Next Steps

1. **Test Transformers.js immediately** - fastest path to working prototype
2. **Verify Azure Speech free tier** - check current pricing page
3. **Test Sarvam API** - sign up for ₹1,000 credits, test quality
4. **Benchmark Whisper.cpp WASM** - test `stream.wasm` example locally
5. **Compare accuracy** across solutions for your target languages

---

## Key Resources

- Sarvam AI: https://dashboard.sarvam.ai
- Azure Speech SDK: https://github.com/Azure-Samples/AzureSpeechReactSample
- Whisper.cpp: https://github.com/ggerganov/whisper.cpp
- Transformers.js: https://github.com/huggingface/transformers.js
- Google Cloud Speech: https://cloud.google.com/speech-to-text/docs/streaming-recognize

---

**Document generated:** 2026-06-24
**Research status:** Complete
