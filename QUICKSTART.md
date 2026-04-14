# Quick Start Guide

## Setup (First Time Only)

1. **Install Node.js dependencies:**
   ```powershell
   npm install
   ```

2. **Create environment file:**
   ```powershell
   Copy-Item .env.example .env
   ```

3. **Add your OpenAI API key to `.env`:**
   ```
   OPENAI_API_KEY=sk-your-actual-api-key-here
   ```
   Get an API key at: https://platform.openai.com/api-keys

## Running the Application

1. **Start the backend server:**
   ```powershell
   npm start
   ```
   
   You should see: `Server running on http://localhost:3001`

2. **Open the application:**
   - Open `index.html` in your web browser
   - Or use Live Server in VS Code for hot reload

## Using the Feature

1. Click the **Windback Feature** button (down arrow ▼) in the header
2. Select any timestamp from the dropdown
3. The **"What's Happening?"** modal opens automatically with an AI explanation
4. Click **↻ Regenerate** to get a new explanation
5. Close by clicking **X**, outside the modal, or pressing **Escape**

## That's it! 🎉

For more details, see [FEATURE_EXPLAIN.md](FEATURE_EXPLAIN.md)
