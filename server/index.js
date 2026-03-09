import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

app.post("/api/analyze", async (req, res) => {
  const { home, away } = req.body;

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: "GEMINI_API_KEY not set" });
  }

  const homeInjuries = (home.injuries || []).length > 0
    ? home.injuries.join("; ")
    : "None reported";
  const awayInjuries = (away.injuries || []).length > 0
    ? away.injuries.join("; ")
    : "None reported";

  const prompt = `You are an expert NBA analyst. Analyze this matchup using the stats below and return win probabilities.

HOME: ${home.name} (${home.city})
- Season record: ${home.wins}W-${home.losses}L
- Home record: ${home.homeWins}W-${home.homeLosses}L
- Avg points/game: ${home.ppg || "N/A"}
- Field goal %: ${home.fgPct || "N/A"}%
- Injuries: ${homeInjuries}

AWAY: ${away.name} (${away.city})
- Season record: ${away.wins}W-${away.losses}L
- Road record: ${away.roadWins}W-${away.roadLosses}L
- Avg points/game: ${away.ppg || "N/A"}
- Field goal %: ${away.fgPct || "N/A"}%
- Injuries: ${awayInjuries}

Factors to weigh: home court advantage, home/road splits, scoring efficiency, injury impact on key players.

Respond ONLY with a valid JSON object, no markdown, no explanation outside JSON:
{
  "homeWinProb": <number between 0 and 1>,
  "awayWinProb": <number between 0 and 1>,
  "confidence": <"low"|"medium"|"high">,
  "keyFactor": "<one sentence explaining the single biggest deciding factor>",
  "recommendedBet": <"home"|"away"|"skip">,
  "reasoning": "<2-3 sentences of analysis covering stats and injuries>"
}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 2048,
            temperature: 0.4,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      }
    );

    const data = await response.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    const text = parts.filter((p) => p.text && !p.thought).map((p) => p.text).join("") || "";
    const clean = text.replace(/```json|```/g, "").trim();
    const prediction = JSON.parse(clean);
    res.json(prediction);
  } catch (e) {
    console.error("Gemini error:", e);
    res.status(500).json({ error: "Failed to get AI prediction" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
