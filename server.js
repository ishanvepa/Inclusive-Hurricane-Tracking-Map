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
    const { storm_name, current, previous, derived, has_uncertainty_data, poi_locations } = req.body;

    // Validate required fields
    if (!storm_name || !current) {
      return res.status(400).json({ error: 'Missing required fields: storm_name and current are required' });
    }

    // Check for OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    // Build the prompt for OpenAI
    const systemPrompt = `You are generating the content for a "What's happening?" modal in an inclusive hurricane tracking tool.

This modal is an INTERPRETIVE LAYER — not a forecast, warning, or technical report.
Your goal is to help people understand what the storm data means for them right now,
regardless of their background, education level, language familiarity, numeracy, or ability.

CORE PRINCIPLES (must follow):
- Extreme inclusivity: write so no one is left behind.
- Accessibility, clarity, and relevance matter more than technical precision.
- Do NOT assume prior knowledge of hurricanes, maps, bearings, or forecast models.
- Do NOT invent impacts, risks, or safety claims not supported by the data.
- Do NOT give prescriptive safety instructions (e.g., evacuate).

WRITING GUIDELINES:
- Target a 6th–8th grade reading level.
- Use plain language first; explain technical terms briefly only if needed.
- Prefer relative change ("weakening", "moving away") over raw numbers.
- Use people-first, inclusive language (e.g., "people in this area…").
- Acknowledge uncertainty and correct common misunderstandings.
- Be calm, non-alarmist, and respectful of diverse lived experiences.

LOCATION AWARENESS:
${poi_locations && poi_locations.length > 0 ? `- User has marked specific locations — make these CENTRAL to your explanation.
- Explain what the storm's distance and movement mean in everyday terms for EACH location.
- Use qualitative distance language (e.g., "far", "closer", "moving away") alongside numbers.
- Calculate whether the storm is moving TOWARD, AWAY FROM, or PARALLEL to each location.
- Provide location-specific, actionable context in key_changes and what_to_watch.
- Avoid implying that distance alone means safety.` : '- No specific locations marked by user. Focus on general storm behavior.'}

UNCERTAINTY GUIDANCE:
${has_uncertainty_data ? '- Use provided uncertainty metadata and explain what it means in plain language.' : '- Uncertainty cone data is not available. Explicitly state this and explain that storm impacts can occur beyond the center path.'}

STRUCTURE REQUIREMENTS:
Return ONLY valid JSON in the following structure:

{
  "headline": "Short, plain-language headline (max 10 words)",
  "summary": "2–3 sentences explaining what changed, why it matters, and what it means for people near the selected location(s). Lead with relevance, not numbers.",
  "key_changes": {
    "bullets": [
      "Plain-language description of the most important change.",
      "Explanation of why that change matters (in everyday terms).",
      "Location-aware interpretation (distance + movement, explained accessibly)."
    ]
  },
  "uncertainty": "1–2 sentences explaining uncertainty in clear language, actively correcting misconceptions (e.g., storms can affect areas beyond the center path).",
  "what_to_watch": [
    "One inclusive, non-prescriptive thing people can monitor related to storm changes.",
    "One location-aware thing to watch that respects different access, mobility, language, or alert preferences."
  ]
}

CONTENT CONSTRAINTS:
- Use ONLY the provided storm and location data.
- Do NOT imply danger, safety, or impacts unless explicitly supported by the input data.
- Do NOT reference internal calculations or technical processes.
- Your output should help people feel informed, oriented, and capable of understanding what's happening — not overwhelmed or excluded.`;

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

${poi_locations && poi_locations.length > 0 ? `User-marked locations:
${poi_locations.map(loc => `- ${loc.name}: ${loc.distance_miles} miles ${loc.direction}`).join('\n')}

CRITICAL INSTRUCTIONS FOR USER LOCATIONS:
1. Calculate whether the storm is moving TOWARD, AWAY FROM, or PARALLEL to each location based on the bearing
2. Provide actionable guidance specific to each location (e.g., "Communities in [location] should prepare for...", "Those at [location] are currently in the path and should...", "[Location] is outside the immediate threat zone but should continue monitoring...")
3. Use inclusive language that considers diverse needs and perspectives
4. Be specific about what conditions each location might experience based on:
   - Current distance from storm
   - Storm's movement direction relative to the location
   - Storm's intensity and trajectory
5. In key_changes, include location-specific information
6. In what_to_watch, provide location-tailored monitoring guidance` : ''}

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
