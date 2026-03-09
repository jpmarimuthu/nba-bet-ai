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

  const prompt = `You are an NBA analyst AI. Analyze this matchup and provide win probabilities.

Home Team: ${home.name} (${home.city}) - Record: ${home.wins}W-${home.losses}L, Conference: ${home.conf}
Away Team: ${away.name} (${away.city}) - Record: ${away.wins}W-${away.losses}L, Conference: ${away.conf}

Consider: win/loss records, home court advantage (~60% historical edge), conference strength, and team quality.

Respond ONLY with a valid JSON object, no markdown, no explanation outside JSON:
{
  "homeWinProb": <number between 0 and 1>,
  "awayWinProb": <number between 0 and 1>,
  "confidence": <"low"|"medium"|"high">,
  "keyFactor": "<one sentence max explaining the main deciding factor>",
  "recommendedBet": <"home"|"away"|"skip">,
  "reasoning": "<2-3 sentences of analysis>"
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
