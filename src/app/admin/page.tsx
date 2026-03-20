import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AUTH_COOKIE_NAME, verifySessionToken } from "@/server/auth/session";
import { isAdminUser } from "@/server/auth/admin";
import { getKeeperPools } from "@/server/config/pools";
import { getSeedingStatus } from "@/server/seeding/state";
import { env } from "@/server/config/env";
import { getConfirmedBetRecords } from "@/server/supabase/bets";
import type { BetRecord } from "@/server/supabase/bets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  const session = verifySessionToken(token);
  if (!session || !isAdminUser(session.user_id)) return null;
  return session;
}

function getBetCounts(): Record<string, number> {
  const map = (globalThis as Record<string, unknown>).__inMemoryBets;
  if (!(map instanceof Map)) return {};
  const counts: Record<string, number> = {};
  for (const bet of map.values()) {
    const state = (bet as BetRecord).state;
    counts[state] = (counts[state] ?? 0) + 1;
  }
  return counts;
}

function getRecentBets(limit = 20): BetRecord[] {
  const map = (globalThis as Record<string, unknown>).__inMemoryBets;
  if (!(map instanceof Map)) return [];
  return Array.from(map.values())
    .sort((a, b) => ((b as BetRecord).created_at ?? "").localeCompare((a as BetRecord).created_at ?? ""))
    .slice(0, limit) as BetRecord[];
}

const STATE_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  confirmed: "#3b82f6",
  won: "#22c55e",
  lost: "#ef4444",
  voided: "#6b7280",
};

export default async function AdminPage() {
  const session = await getAdminSession();
  if (!session) redirect("/");

  const pools = getKeeperPools();
  const seeding = getSeedingStatus();
  const betCounts = getBetCounts();
  const recentBets = getRecentBets();
  const nowSec = Math.floor(Date.now() / 1000);

  return (
    <html lang="en">
      <head>
        <title>BlocksRide Admin</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #0a0a0a; color: #e5e5e5; font-family: ui-monospace, monospace; font-size: 13px; padding: 24px; }
          h1 { font-size: 18px; font-weight: 700; color: #f5a623; margin-bottom: 4px; }
          h2 { font-size: 13px; font-weight: 700; color: #f5a623; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 12px; }
          .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 16px; margin-top: 20px; }
          .card { background: #111; border: 1px solid #222; border-radius: 8px; padding: 16px; }
          .row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #1a1a1a; }
          .row:last-child { border-bottom: none; }
          .label { color: #666; }
          .val { color: #e5e5e5; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
          .pill-ok { background: #14532d; color: #4ade80; }
          .pill-off { background: #1a1a1a; color: #555; }
          .pill-warn { background: #451a03; color: #fb923c; }
          table { width: 100%; border-collapse: collapse; }
          th { text-align: left; color: #444; font-weight: 600; padding: 6px 8px; border-bottom: 1px solid #1a1a1a; font-size: 11px; text-transform: uppercase; }
          td { padding: 6px 8px; border-bottom: 1px solid #111; vertical-align: top; }
          tr:last-child td { border-bottom: none; }
          .mono { font-family: ui-monospace, monospace; font-size: 11px; }
          .truncate { max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          a { color: #f5a623; text-decoration: none; }
          a:hover { text-decoration: underline; }
          .subtitle { color: #444; font-size: 11px; margin-top: 2px; }
          form { display: inline; }
          button { background: #1a1a1a; border: 1px solid #333; color: #e5e5e5; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-family: inherit; font-size: 12px; }
          button:hover { background: #222; }
          button.danger { border-color: #7f1d1d; color: #ef4444; }
          button.danger:hover { background: #1c0a0a; }
          .refresh { float: right; font-size: 11px; color: #444; }
        `}</style>
      </head>
      <body>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <div>
            <h1>BlocksRide Admin</h1>
            <div className="subtitle">Logged in as {session.user_id}</div>
          </div>
          <a href="/admin" style={{ fontSize: 11, color: "#444" }}>↻ Refresh</a>
        </div>

        <div className="grid">

          {/* Environment */}
          <div className="card">
            <h2>Environment</h2>
            <div className="row"><span className="label">Network</span><span className="val">{env.NETWORK}</span></div>
            <div className="row"><span className="label">RPC</span><span className="val mono truncate">{env.RPC_URL ?? "—"}</span></div>
            <div className="row">
              <span className="label">Contract</span>
              <span className="val mono" style={{ fontSize: 10 }}>{env.PARIHOOK_CONTRACT_ADDRESS ?? "—"}</span>
            </div>
            <div className="row">
              <span className="label">Supabase</span>
              <span className={`badge ${env.SUPABASE_URL ? "pill-ok" : "pill-off"}`}>{env.SUPABASE_URL ? "configured" : "not set"}</span>
            </div>
            <div className="row">
              <span className="label">Workers</span>
              <span className={`badge ${env.ENABLE_INTERNAL_WORKERS ? "pill-ok" : "pill-off"}`}>{env.ENABLE_INTERNAL_WORKERS ? "enabled" : "disabled"}</span>
            </div>
            <div className="row">
              <span className="label">Settlement</span>
              <span className={`badge ${env.SETTLEMENT_WORKER_ENABLED ? "pill-ok" : "pill-off"}`}>{env.SETTLEMENT_WORKER_ENABLED ? "enabled" : "disabled"}</span>
            </div>
            <div className="row">
              <span className="label">Bet Settlement</span>
              <span className={`badge ${env.BET_SETTLEMENT_WORKER_ENABLED ? "pill-ok" : "pill-off"}`}>{env.BET_SETTLEMENT_WORKER_ENABLED ? "enabled" : "disabled"}</span>
            </div>
          </div>

          {/* Pools */}
          <div className="card">
            <h2>Keeper Pools ({pools.length})</h2>
            {pools.length === 0 ? (
              <div style={{ color: "#444" }}>No pools configured</div>
            ) : pools.map(pool => {
              const currentWindowId = Math.floor((nowSec - pool.gridEpoch) / pool.windowDurationSec);
              return (
                <div key={pool.poolId} style={{ marginBottom: 12 }}>
                  <div className="row"><span className="label">Name</span><span className="val">{pool.name ?? pool.assetId}</span></div>
                  <div className="row"><span className="label">Window</span><span className="val">{pool.windowDurationSec}s — ID {currentWindowId}</span></div>
                  <div className="row"><span className="label">Price Feed</span><span className={`badge ${pool.priceFeedId ? "pill-ok" : "pill-warn"}`}>{pool.priceFeedId ? "set" : "missing"}</span></div>
                  <div className="row">
                    <span className="label">Pool ID</span>
                    <span className="val mono" style={{ fontSize: 10 }}>{pool.poolId.slice(0, 18)}…</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bet Records */}
          <div className="card">
            <h2>Bet Records</h2>
            {Object.keys(betCounts).length === 0 ? (
              <div style={{ color: "#444" }}>No bets in memory</div>
            ) : (
              <>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                  {Object.entries(betCounts).map(([state, count]) => (
                    <span key={state} className="badge" style={{ background: "#1a1a1a", color: STATE_COLORS[state] ?? "#e5e5e5" }}>
                      {state}: {count}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: "#444" }}>
                  {Object.values(betCounts).reduce((a, b) => a + b, 0)} total in-memory
                  {env.SUPABASE_URL ? " (Supabase is primary store)" : " (no Supabase — in-memory only)"}
                </div>
              </>
            )}
          </div>

          {/* Seeding */}
          <div className="card">
            <h2>Seeding</h2>
            <div className="row">
              <span className="label">Status</span>
              <span className={`badge ${seeding.armed ? "pill-warn" : "pill-off"}`}>{seeding.armed ? "armed" : "idle"}</span>
            </div>
            {seeding.armed && (
              <>
                <div className="row"><span className="label">Pending windows</span><span className="val">{seeding.pending.join(", ")}</span></div>
                <div className="row"><span className="label">Range</span><span className="val">{seeding.range}</span></div>
              </>
            )}
            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <a href="/api/admin/seeding/status"><button>Status JSON</button></a>
            </div>
          </div>

        </div>

        {/* Recent Bets Table */}
        <div className="card" style={{ marginTop: 16 }}>
          <h2>Recent Bets (in-memory, {recentBets.length} shown)</h2>
          {recentBets.length === 0 ? (
            <div style={{ color: "#444", padding: "8px 0" }}>No bets recorded yet</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Wallet</th>
                    <th>Window</th>
                    <th>Cell</th>
                    <th>Amount (USDC)</th>
                    <th>State</th>
                    <th>Tx</th>
                  </tr>
                </thead>
                <tbody>
                  {recentBets.map(bet => (
                    <tr key={bet.intent_id}>
                      <td className="mono" style={{ fontSize: 11, color: "#555" }}>
                        {bet.created_at ? new Date(bet.created_at).toLocaleTimeString() : "—"}
                      </td>
                      <td className="mono truncate" style={{ maxWidth: 100 }} title={bet.wallet_address}>
                        {bet.wallet_address.slice(0, 6)}…{bet.wallet_address.slice(-4)}
                      </td>
                      <td className="mono">{bet.window_id}</td>
                      <td className="mono">{bet.cell_id}</td>
                      <td className="mono">${(Number(bet.amount) / 1_000_000).toFixed(2)}</td>
                      <td>
                        <span className="badge" style={{ background: "#1a1a1a", color: STATE_COLORS[bet.state] ?? "#e5e5e5" }}>
                          {bet.state}
                        </span>
                      </td>
                      <td className="mono truncate" style={{ maxWidth: 80 }}>
                        {bet.tx_hash
                          ? <a href={`https://${env.NETWORK === "sepolia" ? "sepolia." : ""}basescan.org/tx/${bet.tx_hash}`} target="_blank" rel="noreferrer">
                              {bet.tx_hash.slice(0, 8)}…
                            </a>
                          : <span style={{ color: "#444" }}>—</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* API Quick Links */}
        <div className="card" style={{ marginTop: 16 }}>
          <h2>API Quick Links</h2>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {[
              ["/api/health", "Health"],
              ["/api/pools", "Pools"],
              ["/api/rides/active", "Active Ride"],
              ["/api/grids/active", "Active Grids"],
              ["/api/public-price?asset_id=ETH-USD", "ETH Price"],
              ["/api/admin/seeding/status", "Seeding Status"],
              ["/api/admin/status", "Admin Status JSON"],
            ].map(([href, label]) => (
              <a key={href} href={href} target="_blank" rel="noreferrer">
                <button>{label}</button>
              </a>
            ))}
          </div>
        </div>

      </body>
    </html>
  );
}
