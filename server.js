const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Explanation endpoint
app.post('/api/explain', async (req, res) => {
  try {
    const { storm_name, current, previous, derived, has_uncertainty_data } = req.body;

    // Validate required fields
    if (!storm_name || !current) {
      return res.status(400).json({ error: 'Missing required fields: storm_name and current are required' });
    }

    // Check for OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    // Build the prompt for OpenAI
    const systemPrompt = `You are a hurricane forecasting assistant. Generate explanations based ONLY on the provided storm data. Do not invent information.

Return valid JSON only with this exact structure:
{
  "headline": "string (max 10 words)",
  "summary": "string (2-3 sentences)",
  "key_changes": { "bullets": ["string", "string", "string"] },
  "uncertainty": "string (1-2 sentences)",
  "what_to_watch": ["string", "string"]
}

Rules:
- Base all content on provided data values only
- Use delta values to describe changes (strengthening/weakening)
- Mention bearing/direction if provided
- For uncertainty: ${has_uncertainty_data ? 'Use provided uncertainty metadata' : 'State "Uncertainty cone data not available in this view; uncertainty generally increases further into the forecast."'}
- Be concise and data-grounded`;

    const userPrompt = `Storm: ${storm_name}
Current point:
- Time: ${current.time}
- Location: ${current.lat}°, ${current.lon}°
- Max winds: ${current.vmax} kt
- Pressure: ${current.mslp} mb
- Category: ${current.category}

${previous ? `Previous point:
- Time: ${previous.time}
- Max winds: ${previous.vmax} kt
- Pressure: ${previous.mslp} mb
- Category: ${previous.category}

Changes from previous:
- Wind speed: ${derived?.delta_vmax ? (derived.delta_vmax > 0 ? '+' : '') + derived.delta_vmax + ' kt' : 'N/A'}
- Pressure: ${derived?.delta_mslp ? (derived.delta_mslp > 0 ? '+' : '') + derived.delta_mslp + ' mb' : 'N/A'}
- Bearing: ${derived?.bearing_deg !== undefined ? derived.bearing_deg.toFixed(1) + '° (moving ' + getBearingDirection(derived.bearing_deg) + ')' : 'N/A'}` : 'This is the first point in the dataset.'}

${derived?.lifecycle_pct !== undefined ? `Progress through storm lifecycle: ${(derived.lifecycle_pct * 100).toFixed(0)}%` : ''}

Generate the explanation.`;

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 800
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API error:', errorData);
      return res.status(response.status).json({ 
        error: 'OpenAI API request failed', 
        details: errorData 
      });
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      return res.status(500).json({ error: 'No content received from OpenAI' });
    }

    // Parse and validate the JSON response
    let explanation;
    try {
      explanation = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', content);
      return res.status(500).json({ error: 'Invalid JSON response from AI', raw: content });
    }

    // Validate the structure
    if (!explanation.headline || !explanation.summary || !explanation.key_changes || 
        !explanation.uncertainty || !explanation.what_to_watch) {
      return res.status(500).json({ error: 'Invalid response structure from AI', data: explanation });
    }

    res.json(explanation);

  } catch (error) {
    console.error('Error in /api/explain:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});

// Helper function to convert bearing to direction
function getBearingDirection(bearing) {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(bearing / 22.5) % 16;
  return directions[index];
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`OpenAI API key ${process.env.OPENAI_API_KEY ? 'configured' : 'NOT configured - set OPENAI_API_KEY in .env'}`);
});
