📰 Minimalist RSS Reader

A highly functional, premium-looking RSS reader built with React and Tailwind CSS. Inspired by the sleek, high-contrast design language of modern engineering tools, it operates entirely in the browser without needing a dedicated backend.

✨ Features

Modern UI/UX: A rigid, high-contrast dark mode interface with thin borders and minimal distractions. Features both a classic List View and an image-rich Grid/Card View.

AI Summarization: Built-in integration with the Google Gemini API. Instantly generate TL;DR summaries of long articles with a single click.

Smart Folders & Drag-and-Drop: Group your feeds into custom folders. Drag and drop feeds in the sidebar to reorder them or move them between folders.

Local Persistence: All your feeds, read history, and saved articles are stored securely in your browser's localStorage. No database required.

RSSHub Support: Generate feeds for sites that don't natively support RSS (like Twitter/X, YouTube, or GitHub) using the built-in RSSHub URL builder.

Progressive Web App (PWA): Installable on iOS, Android, and Desktop as a standalone application.

🚀 Tech Stack

Framework: React 18

Build Tool: Vite

Styling: Tailwind CSS

Icons: Lucide React

RSS Parsing: rss2json API

🛠️ Local Development

Clone the repository and install dependencies:

npm install


Start the local development server:

npm run dev


Open the app:
Navigate to http://localhost:5173 in your browser.

⚙️ Configuration

Because this application runs entirely client-side, it does not require an .env file for API keys.

To use the AI Summarization feature, simply click the Settings (Gear Icon) in the bottom left of the application's sidebar and paste in your free Gemini API Key from Google AI Studio. The key is saved securely in your browser's local storage.

🌐 Deployment

This project is optimized for deployment on Vercel.

Push your code to a GitHub repository.

Import the project in Vercel.

Vercel will automatically detect the Vite + React setup and deploy your application.