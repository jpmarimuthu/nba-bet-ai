import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

app.post("/api/analyze", async (req, res) => {
  const { home, away } = req.body;

  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not set" });
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
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();
    const text = data.content?.find((b) => b.type === "text")?.text || "";
    const clean = text.replace(/```json|```/g, "").trim();
    const prediction = JSON.parse(clean);
    res.json(prediction);
  } catch (e) {
    console.error("Anthropic error:", e);
    res.status(500).json({ error: "Failed to get AI prediction" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
