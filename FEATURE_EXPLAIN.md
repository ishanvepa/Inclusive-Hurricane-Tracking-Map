# "What's Happening?" Feature - Setup Guide

This guide explains how to set up and use the new AI-powered "What's Happening?" explanation modal feature.

## Overview

The "What's Happening?" feature provides AI-generated, data-grounded explanations for each storm point selected from the windback feature. The explanations include:

- **Headline**: A brief summary (≤10 words)
- **Summary**: 2-3 sentences about the current state
- **Key Changes**: 3 bullet points describing changes from the previous point
- **Uncertainty**: Information about forecast uncertainty
- **What to Watch Next**: 2 bullet points about what to monitor

## Features

✅ **Data-grounded explanations** - All content is based on actual storm data  
✅ **Auto-opens on timestamp selection** - Modal automatically updates when selecting a point  
✅ **Response caching** - Same timestamp won't re-call API unless regenerated  
✅ **Regenerate button** - Re-generate explanation for current point  
✅ **Error handling** - Friendly error messages with retry option  
✅ **Loading states** - Spinner shows while generating explanation  
✅ **Secure API** - OpenAI API key kept server-side only  

## Setup Instructions

### 1. Prerequisites

- Node.js (version 14 or higher)
- npm (comes with Node.js)
- OpenAI API key ([get one here](https://platform.openai.com/api-keys))

### 2. Install Dependencies

Open a terminal in the project directory and run:

```powershell
npm install
```

This will install:
- `express` - Web server framework
- `cors` - Enable cross-origin requests
- `dotenv` - Load environment variables

### 3. Configure Environment Variables

1. Copy the example environment file:
   ```powershell
   Copy-Item .env.example .env
   ```

2. Edit the `.env` file and add your OpenAI API key:
   ```
   OPENAI_API_KEY=sk-your-actual-api-key-here
   PORT=3001
   ```

**Important:** Never commit the `.env` file to version control! It's already added to `.gitignore`.

### 4. Start the Backend Server

In a terminal, run:

```powershell
npm start
```

Or for development with auto-reload:

```powershell
npm run dev
```

You should see:
```
Server running on http://localhost:3001
OpenAI API key configured
```

### 5. Open the Application

1. Open `index.html` in a web browser (or use a local server like Live Server in VS Code)
2. The "What's happening?" button (?) should appear in the header taskbar

## Usage

### Opening the Modal

**Method 1: Auto-open on timestamp selection**
1. Click the "Windback Feature" button (down arrow)
2. Select any timestamp from the dropdown
3. The modal automatically opens with an AI-generated explanation

**Method 2: Manual toggle**
1. Click the "What's happening?" button (?) in the header
2. If a timestamp is already selected, it shows the cached explanation
3. Click the button again to close

### Regenerating Explanations

- Click the "↻ Regenerate" button in the modal
- This clears the cache and generates a fresh explanation from the AI
- Useful if you want a different perspective or the first generation had issues

### Closing the Modal

- Click the X button in the top-right corner
- Click outside the modal (on the dark overlay)
- Press the Escape key

## How It Works

### Data Flow

1. **User selects timestamp** → Frontend collects storm data for current and previous points
2. **Calculate deltas** → Frontend computes wind speed change, pressure change, bearing, lifecycle progress
3. **API call** → Frontend sends JSON payload to `/api/explain` endpoint
4. **OpenAI generation** → Backend calls OpenAI API with structured prompt
5. **Render response** → Frontend displays JSON response in modal (HTML-escaped for security)

### Data Included in API Call

```javascript
{
  "storm_name": "Hurricane Michael 2018",
  "current": {
    "time": "2018-10-10 12:00:00",
    "lat": 30.1,
    "lon": -85.5,
    "vmax": 140,
    "mslp": 919,
    "category": "Category 5"
  },
  "previous": { ... },
  "derived": {
    "delta_vmax": 15,          // Wind speed change (kt)
    "delta_mslp": -12,         // Pressure change (mb)
    "bearing_deg": 22.5,       // Direction of movement
    "lifecycle_pct": 0.65      // Progress through storm (0-1)
  },
  "has_uncertainty_data": false
}
```

### AI Response Format

The API returns structured JSON:

```json
{
  "headline": "Storm rapidly intensifying near Florida coast",
  "summary": "Hurricane Michael has strengthened to Category 5...",
  "key_changes": {
    "bullets": [
      "Wind speeds increased 15 kt to 140 kt",
      "Pressure dropped 12 mb indicating rapid intensification",
      "Moving northeast at consistent speed"
    ]
  },
  "uncertainty": "Uncertainty cone data not available in this view; uncertainty generally increases further into the forecast.",
  "what_to_watch": [
    "Continued rapid intensification as storm approaches land",
    "Potential for storm surge impacts along the coast"
  ]
}
```

## Files Added/Modified

### New Files
- `server.js` - Express backend with `/api/explain` endpoint
- `explain.js` - Frontend module for modal and API calls
- `package.json` - Node.js dependencies
- `.env.example` - Environment variable template
- `FEATURE_EXPLAIN.md` - This documentation

### Modified Files
- `index.html` - Added modal HTML and button, included `explain.js` script
- `styles.css` - Added modal, spinner, and button styles
- `map.js` - Integrated explanation updates on timestamp selection

## Troubleshooting

### "OpenAI API key not configured" error

**Solution:** Make sure you created a `.env` file with your API key:
```
OPENAI_API_KEY=sk-...
```

### "Failed to fetch" or CORS error

**Solution:** Ensure the backend server is running on port 3001:
```powershell
npm start
```

### Modal doesn't open

**Solution:** 
1. Check browser console for errors (F12)
2. Verify `explain.js` is loaded (check Network tab)
3. Make sure backend server is running

### API returns errors

**Solution:**
1. Check your OpenAI API key is valid
2. Verify you have credits in your OpenAI account
3. Check the server console for detailed error messages

### Slow response times

**Note:** The first request may take 3-5 seconds as OpenAI generates the response. Subsequent requests for the same timestamp are instant due to caching.

## Development Notes

### Modifying the AI Prompt

The prompt is in `server.js` around line 30. You can adjust:
- The system prompt to change the AI's behavior
- The user prompt template to include different data
- The temperature (0.7) for more creative/conservative responses

### Caching Behavior

- Explanations are cached in memory by timestamp
- Cache persists until page reload
- "Regenerate" button clears cache for current timestamp only

### Security

- ✅ API key is server-side only (never exposed to browser)
- ✅ All explanations are HTML-escaped to prevent XSS
- ✅ CORS is enabled for local development
- ✅ Input validation on backend

### API Rate Limits

OpenAI has rate limits based on your account tier. If you hit limits:
1. Reduce frequency of regenerations
2. Upgrade your OpenAI account
3. Add rate limiting to the backend (future enhancement)

## Future Enhancements

Potential improvements:
- [ ] Add uncertainty cone data if available in dataset
- [ ] Persist cache to localStorage
- [ ] Add loading progress indicator
- [ ] Support for multiple storms
- [ ] Explanation history/comparison view
- [ ] Export explanations to PDF/text

## Support

For issues or questions:
1. Check the browser console (F12 → Console tab)
2. Check the server console where you ran `npm start`
3. Review the OpenAI API status: https://status.openai.com/

---

**Note:** This feature requires an active internet connection and a valid OpenAI API key to function.
