# Arabic Bilingual Audio Generator

A React application that takes Arabic text, splits it by punctuation, translates each phrase to a selected language (French or Finnish), and generates a bilingual audio MP3 file where each phrase is spoken first in the translated language, then in Arabic.

## Features

- 📝 Split Arabic text by punctuation marks (commas, dots, question marks, etc.)
- 🌐 Translate Arabic text to French or Finnish
- 🔊 Generate bilingual audio (translated language + Arabic)
- 💾 Export as MP3 file
- 🆓 Completely free - uses free TTS and translation APIs

## Tech Stack

- React + Vite
- Browser Speech Synthesis APIs
- Free TTS services (Google TTS via CORS proxy)
- Free Translation APIs (Google Translate, MyMemory, LibreTranslate)
- lamejs for MP3 encoding

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

### Installation

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

## Deployment to Vercel

This project is configured for easy deployment to Vercel:

1. Push your code to GitHub
2. Import your repository in [Vercel](https://vercel.com)
3. Vercel will automatically detect it's a Vite project
4. Deploy!

The `vercel.json` file is already configured with:
- Build command: `pnpm build`
- Output directory: `dist`
- Framework: `vite`

## Usage

1. Select the destination language (French or Finnish)
2. Enter Arabic text in the textarea
3. Click "Generate Audio"
4. Wait for translation and audio generation
5. Download the MP3 file

## How It Works

1. **Text Splitting**: The input text is split by punctuation marks (.,!?;:؟،)
2. **Translation**: Each phrase is translated from Arabic to the selected language
3. **Audio Generation**:
   - First, the translated text is converted to speech
   - Then, the original Arabic text is converted to speech
   - Both are merged with pauses between them
4. **MP3 Export**: The combined audio is encoded as MP3 and made available for download

## Notes

- The app uses free APIs which may have rate limits
- CORS proxies are used to access Google TTS and Translate APIs
- Audio quality depends on the TTS service availability
- Translation quality may vary - Google Translate is prioritized for better results
