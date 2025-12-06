import { useState } from "react";
import * as lamejs from "@breezystack/lamejs";

export default function App() {
  const [text, setText] = useState("");
  const [selectedLang, setSelectedLang] = useState("fr-FR");
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);

  const languages = [
    { code: "fr-FR", name: "French (France)" },
    { code: "fi-FI", name: "Finnish (Finland)" },
  ];

  // Split text by punctuation marks (commas, dots, question marks, exclamation marks, etc.)
  const splitByPunctuation = (text) => {
    // Split by common punctuation marks: . , ! ? ; : and Arabic punctuation ؟ ،
    const phrases = text
      .split(/([.,!?;:؟،]\s*)/)
      .filter((phrase) => phrase.trim().length > 0)
      .map((phrase) => phrase.trim());

    // Group punctuation with previous phrase
    const result = [];
    for (let i = 0; i < phrases.length; i++) {
      if (i === 0 || !/[.,!?;:؟،]/.test(phrases[i])) {
        result.push(phrases[i]);
      } else {
        // This is punctuation, append to previous phrase
        if (result.length > 0) {
          result[result.length - 1] += phrases[i];
        }
      }
    }
    return result.filter((p) => p.trim().length > 0);
  };

  // Use free TTS API with CORS proxy (skipping direct approach to avoid CORS errors)
  const getTTSAudio = async (text, lang) => {
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=tw-ob&q=${encodeURIComponent(text)}`;

    // Try multiple approaches (skipping direct to avoid CORS)
    const approaches = [
      // Approach 1: Google TTS via CORS proxy
      async () => {
        // Try multiple CORS proxy services
        const proxies = [
          'https://api.allorigins.win/raw?url=',
          'https://corsproxy.io/?',
          'https://api.codetabs.com/v1/proxy?quest=',
          'https://cors-anywhere.herokuapp.com/'
        ];

        for (const proxy of proxies) {
          try {
            const proxiedUrl = proxy + encodeURIComponent(ttsUrl);
            const response = await fetch(proxiedUrl, {
              mode: 'cors',
              credentials: 'omit'
            });
            if (response.ok) {
              const blob = await response.blob();
              if (blob.size > 0) {
                console.log(`TTS succeeded using proxy: ${proxy}`);
                return blob;
              }
            }
          } catch {
            // Silently continue to next proxy
            continue;
          }
        }
        throw new Error("All CORS proxies failed");
      },

      // Approach 2: Alternative free TTS service (voicerss.org format)
      async () => {
        // This is a fallback - voicerss requires API key, but let's try a free alternative
        // Using a different free TTS endpoint
        const ttsUrl = `https://api.voicerss.org/?key=demo&hl=${lang}&src=${encodeURIComponent(text)}&f=44khz_16bit_mono`;
        const response = await fetch(ttsUrl, {
          mode: 'cors',
          credentials: 'omit'
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        if (blob.size === 0) throw new Error("Empty response");
        return blob;
      }
    ];

    // Try each approach in order
    for (let i = 0; i < approaches.length; i++) {
      try {
        const blob = await approaches[i]();
        if (blob && blob.size > 0) {
          console.log(`TTS succeeded using approach ${i + 1}`);
          return blob;
        }
      } catch (error) {
        console.warn(`TTS approach ${i + 1} failed:`, error.message);
        if (i === approaches.length - 1) {
          // Last approach failed, throw error
          throw new Error(`All TTS approaches failed. Last error: ${error.message}`);
        }
        // Continue to next approach
      }
    }

    throw new Error("All TTS approaches failed");
  };

  const convertToMp3 = async (audioBlob) => {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const audioData = await audioContext.decodeAudioData(arrayBuffer);

    const samples = audioData.getChannelData(0);
    const sampleRate = audioData.sampleRate;

    // Convert float samples to 16-bit PCM
    const samples16bit = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      samples16bit[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    // Encode to MP3
    const mp3encoder = new lamejs.Mp3Encoder(1, sampleRate, 128);
    const sampleBlockSize = 1152;
    const mp3Data = [];

    for (let i = 0; i < samples16bit.length; i += sampleBlockSize) {
      const sampleChunk = samples16bit.subarray(i, i + sampleBlockSize);
      const mp3buf = mp3encoder.encodeBuffer(sampleChunk);
      if (mp3buf.length > 0) {
        mp3Data.push(mp3buf);
      }
    }

    // Flush remaining data
    const mp3buf = mp3encoder.flush();
    if (mp3buf.length > 0) {
      mp3Data.push(mp3buf);
    }

    // Create MP3 blob
    const mp3Blob = new Blob(mp3Data, { type: "audio/mp3" });
    return mp3Blob;
  };

  // Convert language code (fr-FR -> fr, ar-SA -> ar)
  const getLangCode = (lang) => {
    return lang.split("-")[0];
  };

  // Translate text from Arabic to destination language
  const translateText = async (text, targetLang) => {
    try {
      const targetLangCode = getLangCode(targetLang);

      // Try multiple translation approaches (prioritize Google Translate for better quality)
      const approaches = [
        // Approach 1: Google Translate free endpoint (via CORS proxy) - BEST QUALITY
        async () => {
          const translateUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ar&tl=${targetLangCode}&dt=t&q=${encodeURIComponent(text)}`;

          const proxies = [
            'https://api.allorigins.win/raw?url=',
            'https://corsproxy.io/?',
            'https://api.codetabs.com/v1/proxy?quest=',
          ];

          for (const proxy of proxies) {
            try {
              const proxiedUrl = proxy + encodeURIComponent(translateUrl);
              const response = await fetch(proxiedUrl, {
                mode: 'cors',
                credentials: 'omit'
              });

              if (response.ok) {
                const data = await response.json();
                // Google Translate returns nested array: [[["translated text", ...], ...]]
                if (data && data[0] && data[0][0] && data[0][0][0]) {
                  const translated = data[0][0][0];
                  console.log(`Google Translate: "${text}" -> "${translated}"`);
                  return translated;
                }
              }
            } catch {
              continue; // Try next proxy
            }
          }
          throw new Error("All translation proxies failed");
        },

        // Approach 2: MyMemory Translation API (free, good quality)
        async () => {
          const response = await fetch(
            `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=ar|${targetLangCode}`,
            {
              mode: 'cors',
              credentials: 'omit'
            }
          );

          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const data = await response.json();
          if (data && data.responseData && data.responseData.translatedText) {
            const translated = data.responseData.translatedText;
            console.log(`MyMemory: "${text}" -> "${translated}"`);
            return translated;
          }
          throw new Error("No translation received from MyMemory");
        },

        // Approach 3: LibreTranslate (fallback - lower quality)
        async () => {
          const response = await fetch("https://libretranslate.com/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              q: text,
              source: "ar",
              target: targetLangCode,
              format: "text"
            })
          });

          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const data = await response.json();
          if (!data.translatedText) throw new Error("No translation received");
          const translated = data.translatedText;
          console.log(`LibreTranslate: "${text}" -> "${translated}"`);
          return translated;
        }
      ];

      // Try each approach
      for (let i = 0; i < approaches.length; i++) {
        try {
          const translated = await approaches[i]();
          if (translated && translated.trim()) {
            console.log(`Translation succeeded using approach ${i + 1}`);
            return translated.trim();
          }
        } catch (error) {
          console.warn(`Translation approach ${i + 1} failed:`, error.message);
          if (i === approaches.length - 1) {
            throw new Error(`All translation approaches failed. Last error: ${error.message}`);
          }
        }
      }

      throw new Error("All translation approaches failed");
    } catch (error) {
      console.error("Translation error:", error);
      throw error;
    }
  };

  // Combine multiple audio buffers into one
  const combineAudioBuffers = async (audioBuffers, audioContext) => {
    const sampleRate = audioContext.sampleRate;
    let totalLength = 0;

    // Calculate total length
    audioBuffers.forEach((buffer) => {
      totalLength += buffer.length;
    });

    // Create a new buffer for the combined audio
    const combinedBuffer = audioContext.createBuffer(
      1, // mono
      totalLength,
      sampleRate
    );
    const combinedData = combinedBuffer.getChannelData(0);

    let offset = 0;
    for (const buffer of audioBuffers) {
      const bufferData = buffer.getChannelData(0);
      combinedData.set(bufferData, offset);
      offset += buffer.length;
    }

    return combinedBuffer;
  };

  // Create silence buffer
  const createSilence = (audioContext, duration) => {
    const sampleRate = audioContext.sampleRate;
    const length = Math.floor(sampleRate * duration);
    const buffer = audioContext.createBuffer(1, length, sampleRate);
    return buffer;
  };

  const generateAudio = async () => {
    if (!text.trim()) {
      alert("Please enter some text");
      return;
    }

    setIsGenerating(true);
    setAudioUrl(null);

    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffers = [];

      // Split text by punctuation
      const phrases = splitByPunctuation(text);

      // Process each phrase
      for (const phrase of phrases) {
        if (!phrase.trim()) continue;

        try {
          // Step 1: Translate the Arabic phrase to destination language
          console.log(`Translating: "${phrase}" to ${selectedLang}...`);
          const translatedText = await translateText(phrase, selectedLang);
          console.log(`Translated to: "${translatedText}"`);

          // Step 2: Generate audio for translated text (destination language first)
          const firstLangCode = getLangCode(selectedLang);
          const firstAudioBlob = await getTTSAudio(translatedText, firstLangCode);

          if (firstAudioBlob) {
            const firstArrayBuffer = await firstAudioBlob.arrayBuffer();
            const firstAudioBuffer = await audioContext.decodeAudioData(firstArrayBuffer);
            audioBuffers.push(firstAudioBuffer);
          }
        } catch (error) {
          console.warn(`Failed to translate or get TTS for phrase in ${selectedLang}:`, error);
          // Continue with Arabic even if translation/TTS fails
        }

        // Add small pause between languages (0.2 seconds)
        audioBuffers.push(createSilence(audioContext, 0.2));

        // Step 3: Generate audio for original Arabic text
        try {
          const arabicAudioBlob = await getTTSAudio(phrase, "ar");

          if (arabicAudioBlob) {
            const arabicArrayBuffer = await arabicAudioBlob.arrayBuffer();
            const arabicAudioBuffer = await audioContext.decodeAudioData(arabicArrayBuffer);
            audioBuffers.push(arabicAudioBuffer);
          }
        } catch (error) {
          console.warn("Failed to get TTS for Arabic phrase:", error);
          // Continue to next phrase
        }

        // Add pause between phrases (0.3 seconds)
        audioBuffers.push(createSilence(audioContext, 0.3));
      }

      if (audioBuffers.length === 0) {
        throw new Error("No audio was generated. This might be due to CORS restrictions. Please try a different browser or check the console for errors.");
      }

      // Combine all audio buffers
      const combinedBuffer = await combineAudioBuffers(audioBuffers, audioContext);

      // Convert AudioBuffer to WAV, then to MP3
      const wavBlob = audioBufferToWav(combinedBuffer);
      const mp3Blob = await convertToMp3(wavBlob);

      const url = URL.createObjectURL(mp3Blob);
      setAudioUrl(url);
      setIsGenerating(false);
    } catch (error) {
      console.error("Error generating audio:", error);
      alert("Error generating audio: " + error.message);
      setIsGenerating(false);
    }
  };

  // Convert AudioBuffer to WAV Blob
  const audioBufferToWav = (buffer) => {
    const length = buffer.length;
    const sampleRate = buffer.sampleRate;
    const arrayBuffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(arrayBuffer);
    const channels = buffer.numberOfChannels;
    const samples = buffer.getChannelData(0);

    // WAV header
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, "RIFF");
    view.setUint32(4, 36 + length * 2, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * channels * 2, true);
    view.setUint16(32, channels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, "data");
    view.setUint32(40, length * 2, true);

    // Convert float samples to 16-bit PCM
    let offset = 44;
    for (let i = 0; i < length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }

    return new Blob([arrayBuffer], { type: "audio/wav" });
  };

  const downloadAudio = () => {
    if (audioUrl) {
      const a = document.createElement("a");
      a.href = audioUrl;
      a.download = "bilingual-audio.mp3";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 800, margin: "0 auto" }}>
      <h1>Arabic Bilingual Audio Generator</h1>

      <div style={{ marginBottom: 15 }}>
        <label htmlFor="language" style={{ display: "block", marginBottom: 5 }}>
          First Language:
        </label>
        <select
          id="language"
          value={selectedLang}
          onChange={(e) => setSelectedLang(e.target.value)}
          disabled={isGenerating}
          style={{ padding: "8px 12px", fontSize: 16, width: "100%", maxWidth: 300 }}
        >
          {languages.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 15 }}>
        <label htmlFor="text" style={{ display: "block", marginBottom: 5 }}>
          Arabic Text:
        </label>
        <textarea
          id="text"
          style={{ width: "100%", height: 150, padding: 10, fontSize: 16 }}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter Arabic text here..."
          disabled={isGenerating}
        />
      </div>

      <div style={{ marginBottom: 15 }}>
        <button
          onClick={generateAudio}
          disabled={isGenerating || !text.trim()}
          style={{
            padding: "12px 24px",
            fontSize: 16,
            backgroundColor: isGenerating ? "#ccc" : "#007bff",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: isGenerating ? "not-allowed" : "pointer",
            marginRight: 10,
          }}
        >
          {isGenerating ? "Generating..." : "Generate Audio"}
        </button>

        {audioUrl && (
          <button
            onClick={downloadAudio}
            style={{
              padding: "12px 24px",
              fontSize: 16,
              backgroundColor: "#28a745",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Download MP3
          </button>
        )}
      </div>

      {audioUrl && (
        <div style={{ marginTop: 20 }}>
          <audio controls src={audioUrl} style={{ width: "100%" }} />
        </div>
      )}

      {isGenerating && (
        <p style={{ color: "#666", marginTop: 10 }}>
          Translating and generating audio... This may take a moment.
        </p>
      )}

    </div>
  );
}
