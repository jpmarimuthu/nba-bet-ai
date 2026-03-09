import { useState, useEffect } from "react";

const API_BASE = "https://www.thesportsdb.com/api/v1/json/3";

const TEAMS = [
  { id: "1", name: "Lakers", short: "LAL", color: "#552583", city: "Los Angeles", conf: "West", wins: 45, losses: 27 },
  { id: "2", name: "Celtics", short: "BOS", color: "#007A33", city: "Boston", conf: "East", wins: 57, losses: 15 },
  { id: "3", name: "Warriors", short: "GSW", color: "#1D428A", city: "Golden State", conf: "West", wins: 40, losses: 32 },
  { id: "4", name: "Bulls", short: "CHI", color: "#CE1141", city: "Chicago", conf: "East", wins: 33, losses: 39 },
  { id: "5", name: "Heat", short: "MIA", color: "#98002E", city: "Miami", conf: "East", wins: 44, losses: 28 },
  { id: "6", name: "Nets", short: "BKN", color: "#444444", city: "Brooklyn", conf: "East", wins: 29, losses: 43 },
];

function oddsFromProb(prob: number) {
  if (prob >= 0.5) return -Math.round((prob / (1 - prob)) * 100);
  return +Math.round(((1 - prob) / prob) * 100);
}

function oddsLabel(o: number) { return o > 0 ? `+${o}` : `${o}`; }

function calcPayout(stake: number, odds: number) {
  if (odds > 0) return +(stake * (odds / 100)).toFixed(2);
  return +(stake * (100 / Math.abs(odds))).toFixed(2);
}

function generateGames(teams: typeof TEAMS) {
  const shuffled = [...teams].sort(() => Math.random() - 0.5);
  return [
    { id: 1, home: shuffled[0], away: shuffled[1], time: "7:30 PM ET", prediction: null as Prediction | null, status: "upcoming" },
    { id: 2, home: shuffled[2], away: shuffled[3], time: "8:00 PM ET", prediction: null as Prediction | null, status: "upcoming" },
    { id: 3, home: shuffled[4], away: shuffled[5], time: "10:00 PM ET", prediction: null as Prediction | null, status: "upcoming" },
  ];
}

interface Prediction {
  homeWinProb: number;
  awayWinProb: number;
  confidence: "low" | "medium" | "high";
  keyFactor: string;
  recommendedBet: "home" | "away" | "skip";
  reasoning: string;
}

function PredictionBadge({ prob, label }: { prob: number; label: string }) {
  const pct = Math.round(prob * 100);
  const color = pct >= 65 ? "#4ade80" : pct >= 50 ? "#facc15" : "#f87171";
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{pct}%</div>
    </div>
  );
}

export default function App() {
  const [games, setGames] = useState(generateGames(TEAMS));
  const [wallet, setWallet] = useState(1000);
  const [bets, setBets] = useState<any[]>([]);
  const [slip, setSlip] = useState<any[]>([]);
  const [stakes, setStakes] = useState<Record<string, string>>({});
  const [tab, setTab] = useState("games");
  const [recentResults, setRecentResults] = useState<any[]>([]);
  const [loadingResults, setLoadingResults] = useState(true);
  const [analyzingId, setAnalyzingId] = useState<number | null>(null);

  useEffect(() => { fetchRecent(); }, []);

  async function fetchRecent() {
    setLoadingResults(true);
    try {
      const res = await fetch(`${API_BASE}/eventsseason.php?id=4387&s=2023-2024`);
      const data = await res.json();
      const events = (data.events || [])
        .filter((e: any) => e.intHomeScore && e.intAwayScore)
        .slice(-5)
        .map((e: any) => ({ id: e.idEvent, home: e.strHomeTeam, away: e.strAwayTeam, homeScore: e.intHomeScore, awayScore: e.intAwayScore, date: e.dateEvent }));
      setRecentResults(events);
    } catch { setRecentResults([]); }
    setLoadingResults(false);
  }

  async function analyzeGame(gameId: number) {
    const game = games.find(g => g.id === gameId);
    if (!game) return;
    setAnalyzingId(gameId);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          home: { name: game.home.name, city: game.home.city, wins: game.home.wins, losses: game.home.losses, conf: game.home.conf },
          away: { name: game.away.name, city: game.away.city, wins: game.away.wins, losses: game.away.losses, conf: game.away.conf },
        }),
      });
      const prediction: Prediction = await res.json();
      setGames(prev => prev.map(g => g.id === gameId ? { ...g, prediction } : g));
    } catch (e) {
      console.error("AI error", e);
    }
    setAnalyzingId(null);
  }

  function togglePick(gameId: number, side: string, odds: number, label: string) {
    const key = `${gameId}-${side}`;
    const otherKey = `${gameId}-${side === "home" ? "away" : "home"}`;
    const exists = slip.find(s => s.key === key);
    if (exists) setSlip(slip.filter(s => s.key !== key));
    else setSlip([...slip.filter(s => s.key !== otherKey), { key, gameId, side, odds, label }]);
  }

  function placeBets() {
    let newWallet = wallet;
    const newBets: any[] = [];
    for (const pick of slip) {
      const stake = parseFloat(stakes[pick.key] || "0");
      if (!stake || stake <= 0 || stake > newWallet) continue;
      newWallet -= stake;
      newBets.push({ ...pick, stake, payout: calcPayout(stake, pick.odds), status: "pending", id: Date.now() + Math.random() });
    }
    if (!newBets.length) return;
    setWallet(+newWallet.toFixed(2));
    setBets([...newBets, ...bets]);
    setSlip([]); setStakes({});
    alert(`✅ ${newBets.length} bet(s) placed!`);
  }

  function simulateResults() {
    const updated = bets.map(b => {
      if (b.status !== "pending") return b;
      const win = Math.random() > 0.5;
      return { ...b, status: win ? "won" : "lost" };
    });
    const winnings = updated
      .filter(b => b.status === "won" && bets.find((o: any) => o.id === b.id)?.status === "pending")
      .reduce((sum, b) => sum + b.stake + b.payout, 0);
    setWallet(+(wallet + winnings).toFixed(2));
    setBets(updated);
  }

  const pendingCount = bets.filter(b => b.status === "pending").length;
  const confColor: Record<string, string> = { low: "#f87171", medium: "#facc15", high: "#4ade80" };

  return (
    <div style={{ minHeight: "100vh", background: "#0f1117", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#1a1d2e", borderBottom: "1px solid #2a2d3e", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#c084fc" }}>🏀 NBA Bet <span style={{ fontSize: 13, background: "#7c3aed33", color: "#a78bfa", padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}>AI Powered</span></div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>Simulation · No real money</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, color: "#9ca3af" }}>Wallet</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: wallet > 1000 ? "#4ade80" : wallet < 500 ? "#f87171" : "#fff" }}>${wallet.toLocaleString()}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid #2a2d3e", background: "#1a1d2e" }}>
        {["games", "slip", "history", "results"].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ flex: 1, padding: "12px", border: "none", background: "transparent", color: tab === t ? "#c084fc" : "#6b7280", fontWeight: tab === t ? 700 : 400, borderBottom: tab === t ? "2px solid #c084fc" : "2px solid transparent", cursor: "pointer", textTransform: "capitalize", fontSize: 14 }}>
            {t === "slip" ? `Slip (${slip.length})` : t === "history" ? `Bets (${bets.length})` : t}
          </button>
        ))}
      </div>

      <div style={{ padding: "16px", maxWidth: 620, margin: "0 auto" }}>

        {/* GAMES TAB */}
        {tab === "games" && (
          <div>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>Tonight's Games · Get AI prediction then bet</div>
            {games.map(g => {
              const homeOdds = g.prediction ? oddsFromProb(g.prediction.homeWinProb) : null;
              const awayOdds = g.prediction ? oddsFromProb(g.prediction.awayWinProb) : null;
              const isAnalyzing = analyzingId === g.id;
              const rec = g.prediction?.recommendedBet;

              return (
                <div key={g.id} style={{ background: "#1a1d2e", borderRadius: 12, marginBottom: 16, overflow: "hidden", border: "1px solid #2a2d3e" }}>
                  <div style={{ padding: "10px 16px", borderBottom: "1px solid #2a2d3e", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "#9ca3af" }}>🕐 {g.time}</span>
                    {g.prediction && (
                      <span style={{ fontSize: 11, color: confColor[g.prediction.confidence], background: confColor[g.prediction.confidence] + "22", padding: "2px 8px", borderRadius: 20, fontWeight: 700 }}>
                        {g.prediction.confidence.toUpperCase()} CONFIDENCE
                      </span>
                    )}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, padding: 16, alignItems: "center" }}>
                    {([{ team: g.home, side: "home", odds: homeOdds }, { team: g.away, side: "away", odds: awayOdds }] as const).map(({ team, side, odds }) => (
                      <div key={side} style={{ textAlign: "center" }}>
                        <div style={{ width: 44, height: 44, borderRadius: "50%", background: team.color, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 6px", fontWeight: 800, fontSize: 13, boxShadow: rec === side ? `0 0 12px ${team.color}` : "none" }}>
                          {team.short}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{team.name}</div>
                        <div style={{ fontSize: 11, color: "#9ca3af" }}>{team.wins}W-{team.losses}L</div>
                        {rec === side && <div style={{ fontSize: 10, color: "#4ade80", fontWeight: 700, marginTop: 2 }}>⭐ AI PICK</div>}
                        {odds !== null ? (
                          <button onClick={() => togglePick(g.id, side, odds, `${team.name} ML`)}
                            style={{ marginTop: 8, padding: "6px 14px", borderRadius: 8, border: "none", background: slip.find(s => s.key === `${g.id}-${side}`) ? "#7c3aed" : "#2a2d3e", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                            {oddsLabel(odds)}
                          </button>
                        ) : (
                          <div style={{ marginTop: 8, padding: "6px 14px", fontSize: 12, color: "#4b5563" }}>—</div>
                        )}
                      </div>
                    ))}
                    <div style={{ textAlign: "center", color: "#6b7280", fontWeight: 800 }}>VS</div>
                  </div>

                  {g.prediction && (
                    <div style={{ margin: "0 16px 12px", background: "#0f1117", borderRadius: 10, padding: 14, border: "1px solid #7c3aed33" }}>
                      <div style={{ display: "flex", justifyContent: "space-around", marginBottom: 12 }}>
                        <PredictionBadge prob={g.prediction.homeWinProb} label={`${g.home.name} Win%`} />
                        <div style={{ width: 1, background: "#2a2d3e" }} />
                        <PredictionBadge prob={g.prediction.awayWinProb} label={`${g.away.name} Win%`} />
                      </div>
                      <div style={{ fontSize: 12, color: "#a78bfa", marginBottom: 6 }}>
                        🔑 <b>Key Factor:</b> {g.prediction.keyFactor}
                      </div>
                      <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.6 }}>
                        {g.prediction.reasoning}
                      </div>
                    </div>
                  )}

                  <div style={{ padding: "0 16px 14px" }}>
                    <button onClick={() => analyzeGame(g.id)} disabled={isAnalyzing}
                      style={{ width: "100%", padding: "10px", borderRadius: 8, border: "none", background: g.prediction ? "#2a2d3e" : "linear-gradient(135deg, #7c3aed, #4f46e5)", color: "#fff", fontWeight: 600, cursor: isAnalyzing ? "wait" : "pointer", fontSize: 13, opacity: isAnalyzing ? 0.7 : 1 }}>
                      {isAnalyzing ? "🤖 Analyzing matchup..." : g.prediction ? "🔄 Re-analyze with AI" : "🤖 Get AI Prediction"}
                    </button>
                  </div>
                </div>
              );
            })}
            <button onClick={() => setGames(generateGames(TEAMS))} style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px dashed #4b5563", background: "transparent", color: "#9ca3af", cursor: "pointer", fontSize: 14 }}>
              🔄 Refresh Games
            </button>
          </div>
        )}

        {/* SLIP TAB */}
        {tab === "slip" && (
          <div>
            {slip.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>No picks yet. Get AI prediction and click odds.</div>
            ) : (
              <>
                {slip.map(s => {
                  const stake = parseFloat(stakes[s.key] || "0");
                  const payout = stake > 0 ? calcPayout(stake, s.odds) : 0;
                  return (
                    <div key={s.key} style={{ background: "#1a1d2e", borderRadius: 12, padding: 16, marginBottom: 10, border: "1px solid #7c3aed44" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontWeight: 600 }}>{s.label}</span>
                        <span style={{ color: s.odds > 0 ? "#4ade80" : "#f87171", fontWeight: 700 }}>{oddsLabel(s.odds)}</span>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input type="number" placeholder="Stake $" min={1} max={wallet}
                          value={stakes[s.key] || ""}
                          onChange={e => setStakes({ ...stakes, [s.key]: e.target.value })}
                          style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #374151", background: "#0f1117", color: "#fff", fontSize: 14 }} />
                        <div style={{ fontSize: 13, color: "#9ca3af", minWidth: 90 }}>
                          Win: <span style={{ color: "#4ade80", fontWeight: 600 }}>${payout}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <button onClick={placeBets}
                  style={{ width: "100%", padding: 14, borderRadius: 10, border: "none", background: "#7c3aed", color: "#fff", fontWeight: 700, fontSize: 16, cursor: "pointer", marginTop: 8 }}>
                  Place {slip.length} Bet{slip.length > 1 ? "s" : ""}
                </button>
              </>
            )}
          </div>
        )}

        {/* HISTORY TAB */}
        {tab === "history" && (
          <div>
            {pendingCount > 0 && (
              <button onClick={simulateResults}
                style={{ width: "100%", padding: 12, borderRadius: 10, border: "none", background: "#059669", color: "#fff", fontWeight: 700, cursor: "pointer", marginBottom: 14, fontSize: 14 }}>
                🎲 Simulate Results ({pendingCount} pending)
              </button>
            )}
            {bets.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>No bets placed yet.</div>
            ) : bets.map(b => (
              <div key={b.id} style={{ background: "#1a1d2e", borderRadius: 10, padding: 14, marginBottom: 8, borderLeft: `4px solid ${b.status === "won" ? "#4ade80" : b.status === "lost" ? "#f87171" : "#f59e0b"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 600 }}>{b.label}</span>
                  <span style={{ fontSize: 12, color: b.status === "won" ? "#4ade80" : b.status === "lost" ? "#f87171" : "#f59e0b", textTransform: "uppercase", fontWeight: 700 }}>{b.status}</span>
                </div>
                <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 4 }}>
                  Stake: <b style={{ color: "#fff" }}>${b.stake}</b> · To win: <b style={{ color: "#4ade80" }}>${b.payout}</b>
                  {b.status === "won" && <span style={{ color: "#4ade80" }}> ✓ +${(b.stake + b.payout).toFixed(2)}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* RESULTS TAB */}
        {tab === "results" && (
          <div>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>Recent NBA Results (2023-24 Season)</div>
            {loadingResults ? (
              <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>Loading real data...</div>
            ) : recentResults.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>No results found.</div>
            ) : recentResults.map(r => (
              <div key={r.id} style={{ background: "#1a1d2e", borderRadius: 10, padding: 14, marginBottom: 8, border: "1px solid #2a2d3e" }}>
                <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 6 }}>{r.date}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{r.home}</span>
                  <span style={{ fontWeight: 800, fontSize: 18, color: "#c084fc" }}>{r.homeScore} – {r.awayScore}</span>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{r.away}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
