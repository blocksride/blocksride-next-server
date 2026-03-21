import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAddress } from "viem";

import { getKeeperPools } from "@/server/config/pools";
import { getSeedingStatus } from "@/server/seeding/state";
import { env } from "@/server/config/env";
import type { BetRecord } from "@/server/supabase/bets";
import { getPublicClient } from "@/server/chain/client";
import { getPublicPrice, isSupportedPublicPriceAsset } from "@/server/market-data/publicPrice";
import { pariHookKeeperAbi } from "@/shared/abi/pariHookKeeper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_COOKIE = "admin_session";
const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 8; // 8 hours

function getAdminSecret(): string {
  return env.ADMIN_SECRET ?? env.ADMIN_USER_IDS ?? "changeme";
}

async function checkAdminAuth(): Promise<boolean> {
  const cookieStore = await cookies();
  const val = cookieStore.get(ADMIN_COOKIE)?.value;
  return val === getAdminSecret();
}

async function loginAction(formData: FormData) {
  "use server";
  const password = formData.get("password") as string;
  if (password === getAdminSecret()) {
    const cookieStore = await cookies();
    cookieStore.set(ADMIN_COOKIE, password, {
      httpOnly: true,
      sameSite: "lax",
      path: "/admin",
      maxAge: ADMIN_COOKIE_MAX_AGE,
    });
  }
  redirect("/admin");
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

type SeedCell = {
  id: number;
  low: string;
  high: string;
  isCenter: boolean;
};

type SeedData = {
  poolId: string;
  poolName: string;
  assetId: string;
  price: number;
  centerCell: number;
  bandWidth: number;
  cells: SeedCell[];
  currentWindowId: number;
  frozenWindows: number;
  windowDurationSec: number;
  defaultAmountUsdc: string;
} | null;

async function getAdminSeedData(): Promise<SeedData> {
  const pools = getKeeperPools();
  const pool = pools[0];
  if (!pool || !isSupportedPublicPriceAsset(pool.assetId)) return null;

  try {
    const hookAddress = getAddress(pool.poolKey.hooks);
    const publicClient = getPublicClient();

    const [priceResult, config, currentWindowId] = await Promise.all([
      getPublicPrice(pool.assetId),
      publicClient.readContract({
        address: hookAddress,
        abi: pariHookKeeperAbi,
        functionName: "gridConfigs",
        args: [pool.poolId as `0x${string}`]
      }),
      publicClient.readContract({
        address: hookAddress,
        abi: pariHookKeeperAbi,
        functionName: "currentWindowId",
        args: [pool.poolKey]
      })
    ]);

    const bandWidth = Number(config[1]);
    if (bandWidth <= 0) return null;

    const price = priceResult.price;
    const centerCell = Math.floor((price * 1_000_000) / bandWidth);
    const RANGE = 10;
    const cells: SeedCell[] = [];

    // High prices at top, descending
    for (let i = centerCell + RANGE - 1; i >= centerCell - RANGE; i--) {
      const low = (i * bandWidth) / 1_000_000;
      const high = ((i + 1) * bandWidth) / 1_000_000;
      cells.push({
        id: i,
        low: low.toFixed(2),
        high: high.toFixed(2),
        isCenter: i === centerCell,
      });
    }

    return {
      poolId: pool.poolId,
      poolName: pool.name ?? pool.assetId,
      assetId: pool.assetId,
      price,
      centerCell,
      bandWidth,
      cells,
      currentWindowId: Number(currentWindowId),
      frozenWindows: Number(config[3]),
      windowDurationSec: pool.windowDurationSec,
      defaultAmountUsdc: (Number(env.SEED_AMOUNT_USDC) / 1_000_000).toFixed(2),
    };
  } catch {
    return null;
  }
}

const STATE_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  confirmed: "#3b82f6",
  won: "#22c55e",
  lost: "#ef4444",
  voided: "#6b7280",
};

const css = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0a0a0a; color: #e5e5e5; font-family: ui-monospace, monospace; font-size: 13px; padding: 24px; }
  h1 { font-size: 18px; font-weight: 700; color: #f5a623; margin-bottom: 4px; }
  h2 { font-size: 12px; font-weight: 700; color: #f5a623; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 12px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; margin-top: 20px; }
  .card { background: #111; border: 1px solid #1e1e1e; border-radius: 8px; padding: 16px; }
  .row { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; border-bottom: 1px solid #161616; }
  .row:last-child { border-bottom: none; }
  .label { color: #555; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
  .ok { background: #14532d; color: #4ade80; }
  .off { background: #1a1a1a; color: #444; }
  .warn { background: #451a03; color: #fb923c; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; color: #444; font-weight: 600; padding: 6px 8px; border-bottom: 1px solid #1a1a1a; font-size: 11px; text-transform: uppercase; }
  td { padding: 6px 8px; border-bottom: 1px solid #111; vertical-align: top; font-size: 12px; }
  tr:last-child td { border-bottom: none; }
  a { color: #f5a623; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .sub { color: #444; font-size: 11px; margin-top: 2px; }
  button { background: #1a1a1a; border: 1px solid #2a2a2a; color: #e5e5e5; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-family: inherit; font-size: 12px; }
  button:hover { background: #222; }
  .login-wrap { display: flex; align-items: center; justify-content: center; min-height: 100vh; }
  .login-box { background: #111; border: 1px solid #1e1e1e; border-radius: 8px; padding: 32px; width: 320px; }
  .login-box h1 { margin-bottom: 20px; }
  input[type=password] { width: 100%; padding: 8px 12px; background: #0a0a0a; border: 1px solid #2a2a2a; border-radius: 4px; color: #e5e5e5; font-family: inherit; font-size: 13px; margin-bottom: 12px; }
  input[type=password]:focus { outline: none; border-color: #f5a623; }
  .submit { width: 100%; background: #f5a623; color: #000; font-weight: 700; padding: 8px; border: none; }
  .submit:hover { background: #e09410; }
  .seed-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin: 12px 0; }
  .seed-cell { background: #0d0d0d; border: 1px solid #2a2a2a; border-radius: 4px; padding: 6px 8px; cursor: pointer; user-select: none; transition: border-color 0.1s; }
  .seed-cell:hover { border-color: #444; }
  .seed-cell.center { border-color: #22c55e40; background: #14532d20; }
  .seed-cell.selected { border-color: #f5a623 !important; background: #451a0330; }
  .seed-cell .price { font-size: 11px; color: #aaa; }
  .seed-cell .cell-id { font-size: 10px; color: #444; margin-top: 2px; }
  .seed-controls { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; }
  .seed-controls label { color: #555; font-size: 11px; }
  input[type=number], input[type=text] { background: #0a0a0a; border: 1px solid #2a2a2a; border-radius: 4px; color: #e5e5e5; font-family: inherit; font-size: 12px; padding: 4px 8px; width: 90px; }
  input[type=number]:focus, input[type=text]:focus { outline: none; border-color: #f5a623; }
  .seed-windows { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
  .win-btn { font-size: 11px; padding: 3px 10px; }
  .win-btn.active { background: #1a1a0a; border-color: #f5a623; color: #f5a623; }
  .seed-btn-row { display: flex; gap: 8px; align-items: center; }
  #seed-status { font-size: 12px; color: #555; }
`;

function LoginPage() {
  return (
    <>
      <style>{css}</style>
      <div className="login-wrap">
        <div className="login-box">
          <h1>Admin</h1>
          <form action={loginAction}>
            <input type="password" name="password" placeholder="Admin secret" autoFocus />
            <button type="submit" className="submit">Enter</button>
          </form>
        </div>
      </div>
    </>
  );
}

export default async function AdminPage() {
  const authed = await checkAdminAuth();
  if (!authed) return <LoginPage />;

  const pools = getKeeperPools();
  const seeding = getSeedingStatus();
  const betCounts = getBetCounts();
  const recentBets = getRecentBets();
  const nowSec = Math.floor(Date.now() / 1000);
  const seedData = await getAdminSeedData();

  const seedScript = seedData ? `
    (function() {
      var selected = new Set();
      var poolId = ${JSON.stringify(seedData.poolId)};
      var bandWidth = ${seedData.bandWidth};
      var assetId = ${JSON.stringify(seedData.assetId)};
      var selectedWindowId = ${seedData.currentWindowId + seedData.frozenWindows + 1};

      setInterval(async function() {
        try {
          var res = await fetch('/api/public-price?asset_id=' + assetId);
          var data = await res.json();
          if (!data.price) return;
          document.getElementById('seed-price').textContent = '$' + parseFloat(data.price).toFixed(2);
          var newCenter = Math.floor((data.price * 1000000) / bandWidth);
          document.querySelectorAll('.seed-cell').forEach(function(cell) {
            var id = parseInt(cell.dataset.cellId);
            var idEl = cell.querySelector('.cell-id');
            if (id === newCenter) {
              cell.classList.add('center');
              idEl.textContent = 'cell ' + id + ' \u25c0 now';
            } else {
              cell.classList.remove('center');
              idEl.textContent = 'cell ' + id;
            }
          });
        } catch(e) {}
      }, 10000);

      document.querySelectorAll('.seed-cell').forEach(function(cell) {
        cell.addEventListener('click', function() {
          var id = parseInt(cell.dataset.cellId);
          if (selected.has(id)) {
            selected.delete(id);
            cell.classList.remove('selected');
          } else {
            selected.add(id);
            cell.classList.add('selected');
          }
          document.getElementById('seed-count').textContent = selected.size + ' cell' + (selected.size !== 1 ? 's' : '') + ' selected';
        });
      });

      document.querySelectorAll('.win-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          selectedWindowId = parseInt(btn.dataset.wid);
          document.querySelectorAll('.win-btn').forEach(function(b) { b.classList.remove('active'); });
          btn.classList.add('active');
        });
      });

      document.getElementById('seed-all-btn').addEventListener('click', function() {
        document.querySelectorAll('.seed-cell').forEach(function(cell) {
          selected.add(parseInt(cell.dataset.cellId));
          cell.classList.add('selected');
        });
        document.getElementById('seed-count').textContent = selected.size + ' cells selected';
      });

      document.getElementById('seed-clear-btn').addEventListener('click', function() {
        selected.clear();
        document.querySelectorAll('.seed-cell').forEach(function(cell) { cell.classList.remove('selected'); });
        document.getElementById('seed-count').textContent = '0 cells selected';
      });

      document.getElementById('seed-submit-btn').addEventListener('click', async function() {
        if (selected.size === 0) {
          document.getElementById('seed-status').textContent = 'Select at least one cell.';
          return;
        }
        var amountDollars = parseFloat(document.getElementById('seed-amount').value);
        if (!amountDollars || amountDollars <= 0) {
          document.getElementById('seed-status').textContent = 'Enter a valid amount.';
          return;
        }
        var amountUsdc = String(Math.round(amountDollars * 1000000));
        var cells = Array.from(selected);
        var btn = document.getElementById('seed-submit-btn');
        btn.disabled = true;
        btn.textContent = 'Seeding...';
        document.getElementById('seed-status').textContent = 'Submitting ' + cells.length + ' cell(s) for window ' + selectedWindowId + '...';
        try {
          var res = await fetch('/admin/seed-direct', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ poolId: poolId, windowId: selectedWindowId, cells: cells, amountUsdc: amountUsdc })
          });
          var data = await res.json();          if (data.ok) {
            document.getElementById('seed-status').textContent = '✓ Seeded ' + data.seeded + ' cell(s) in window ' + selectedWindowId;
          } else {
            document.getElementById('seed-status').textContent = 'Error: ' + data.error;
          }
        } catch(e) {
          document.getElementById('seed-status').textContent = 'Network error';
        }
        btn.disabled = false;
        btn.textContent = 'Seed Selected';
      });
    })();
  ` : "";

  return (
    <>
      <style>{css}</style>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <div>
            <h1>BlocksRide Admin</h1>
            <div className="sub">{new Date().toISOString()}</div>
          </div>
          <a href="/admin"><button>↻ Refresh</button></a>
        </div>

        <div className="grid">
          {/* Environment */}
          <div className="card">
            <h2>Environment</h2>
            <div className="row"><span className="label">Network</span><span>{env.NETWORK}</span></div>
            <div className="row"><span className="label">RPC</span><span style={{ fontSize: 10, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{env.RPC_URL ?? "—"}</span></div>
            <div className="row"><span className="label">Contract</span><span style={{ fontSize: 10 }}>{env.PARIHOOK_CONTRACT_ADDRESS?.slice(0, 18) ?? "—"}…</span></div>
            <div className="row"><span className="label">Supabase</span><span className={`badge ${env.SUPABASE_URL ? "ok" : "off"}`}>{env.SUPABASE_URL ? "configured" : "not set"}</span></div>
            <div className="row"><span className="label">Workers</span><span className={`badge ${env.ENABLE_INTERNAL_WORKERS ? "ok" : "off"}`}>{env.ENABLE_INTERNAL_WORKERS ? "enabled" : "disabled"}</span></div>
            <div className="row"><span className="label">Settlement</span><span className={`badge ${env.SETTLEMENT_WORKER_ENABLED ? "ok" : "off"}`}>{env.SETTLEMENT_WORKER_ENABLED ? "on" : "off"}</span></div>
            <div className="row"><span className="label">Bet Settlement</span><span className={`badge ${env.BET_SETTLEMENT_WORKER_ENABLED ? "ok" : "off"}`}>{env.BET_SETTLEMENT_WORKER_ENABLED ? "on" : "off"}</span></div>
          </div>

          {/* Pools */}
          <div className="card">
            <h2>Keeper Pools ({pools.length})</h2>
            {pools.length === 0
              ? <div className="label">No pools configured</div>
              : pools.map(pool => {
                  const wid = Math.floor((nowSec - pool.gridEpoch) / pool.windowDurationSec);
                  return (
                    <div key={pool.poolId} style={{ marginBottom: 10 }}>
                      <div className="row"><span className="label">Asset</span><span>{pool.name ?? pool.assetId}</span></div>
                      <div className="row"><span className="label">Window</span><span>{pool.windowDurationSec}s — ID {wid}</span></div>
                      <div className="row"><span className="label">Price feed</span><span className={`badge ${pool.priceFeedId ? "ok" : "warn"}`}>{pool.priceFeedId ? "set" : "missing"}</span></div>
                    </div>
                  );
                })
            }
          </div>

          {/* Seeding */}
          <div className="card">
            <h2>Seeding</h2>
            <div className="row"><span className="label">Status</span><span className={`badge ${seeding.armed ? "warn" : "off"}`}>{seeding.armed ? "armed" : "idle"}</span></div>
            {seeding.armed && <>
              <div className="row"><span className="label">Pending</span><span>{seeding.pending.join(", ")}</span></div>
              <div className="row"><span className="label">Range</span><span>{seeding.range}</span></div>
            </>}
          </div>

          {/* Bets */}
          <div className="card">
            <h2>Bet Records (in-memory)</h2>
            {Object.keys(betCounts).length === 0
              ? <div className="label">No bets recorded</div>
              : <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {Object.entries(betCounts).map(([state, count]) => (
                    <span key={state} className="badge" style={{ background: "#1a1a1a", color: STATE_COLORS[state] ?? "#e5e5e5" }}>
                      {state}: {count}
                    </span>
                  ))}
                </div>
            }
            <div style={{ marginTop: 8, fontSize: 11, color: "#444" }}>
              {!env.SUPABASE_URL && "⚠ No Supabase — data lost on restart"}
            </div>
          </div>
        </div>

        {/* Manual Seed */}
        <div className="card" style={{ marginTop: 16 }}>
          <h2>Manual Seed</h2>
          {!seedData
            ? <div className="label">Price data unavailable — check RPC and pool config</div>
            : <>
                <div style={{ marginBottom: 10, fontSize: 13 }}>
                  <span className="label">Price </span>
                  <span id="seed-price" style={{ color: "#f5a623", fontWeight: 700 }}>${seedData.price.toFixed(2)}</span>
                  <span className="label" style={{ marginLeft: 16 }}>Current Window </span>{seedData.currentWindowId}
                </div>

                {/* Window selector */}
                <div style={{ marginBottom: 8, fontSize: 11, color: "#555" }}>Window to seed:</div>
                <div className="seed-windows">
                  {[0, 1, 2, 3].map(offset => {
                    const wid = seedData.currentWindowId + seedData.frozenWindows + 1 + offset;
                    const label = offset === 0 ? "next seedable" : `+${offset}`;
                    return (
                      <button
                        key={wid}
                        className={`win-btn${offset === 0 ? " active" : ""}`}
                        data-wid={wid}
                      >
                        {wid} <span style={{ color: "#555" }}>({label})</span>
                      </button>
                    );
                  })}
                </div>

                {/* Amount + actions */}
                <div className="seed-controls">
                  <label>Amount (USDC)</label>
                  <input
                    id="seed-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    defaultValue={seedData.defaultAmountUsdc}
                  />
                  <button id="seed-all-btn" style={{ fontSize: 11 }}>Select All</button>
                  <button id="seed-clear-btn" style={{ fontSize: 11 }}>Clear</button>
                </div>

                {/* Cell grid — 4 columns */}
                <div className="seed-grid">
                  {seedData.cells.map(cell => (
                    <div
                      key={cell.id}
                      className={`seed-cell${cell.isCenter ? " center" : ""}`}
                      data-cell-id={cell.id}
                    >
                      <div className="price">${cell.low}–{cell.high}</div>
                      <div className="cell-id">cell {cell.id}{cell.isCenter ? " ◀ now" : ""}</div>
                    </div>
                  ))}
                </div>

                <div className="seed-btn-row">
                  <button id="seed-submit-btn" style={{ background: "#f5a623", color: "#000", fontWeight: 700, border: "none" }}>
                    Seed Selected
                  </button>
                  <span id="seed-count" style={{ fontSize: 11, color: "#555" }}>0 cells selected</span>
                  <span id="seed-status" style={{ fontSize: 12, color: "#555" }}></span>
                </div>
              </>
          }
        </div>

        {/* Recent Bets */}
        <div className="card" style={{ marginTop: 16 }}>
          <h2>Recent Bets</h2>
          {recentBets.length === 0
            ? <div className="label" style={{ padding: "8px 0" }}>No bets yet</div>
            : <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Time</th><th>Wallet</th><th>Window</th><th>Cell</th><th>Amount</th><th>State</th><th>Tx</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentBets.map(bet => (
                      <tr key={bet.intent_id}>
                        <td style={{ color: "#555" }}>{bet.created_at ? new Date(bet.created_at).toLocaleTimeString() : "—"}</td>
                        <td title={bet.wallet_address}>{bet.wallet_address.slice(0, 6)}…{bet.wallet_address.slice(-4)}</td>
                        <td>{bet.window_id}</td>
                        <td>{bet.cell_id}</td>
                        <td>${(Number(bet.amount) / 1_000_000).toFixed(2)}</td>
                        <td><span className="badge" style={{ background: "#1a1a1a", color: STATE_COLORS[bet.state] ?? "#e5e5e5" }}>{bet.state}</span></td>
                        <td>
                          {bet.tx_hash
                            ? <a href={`https://${env.NETWORK === "sepolia" ? "sepolia." : ""}basescan.org/tx/${bet.tx_hash}`} target="_blank" rel="noreferrer">{bet.tx_hash.slice(0, 8)}…</a>
                            : <span style={{ color: "#444" }}>—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          }
        </div>

        {/* Quick Links */}
        <div className="card" style={{ marginTop: 16 }}>
          <h2>Quick Links</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              ["/api/health", "Health"],
              ["/api/pools", "Pools"],
              ["/api/rides/active", "Active Ride"],
              ["/api/public-price?asset_id=ETH-USD", "ETH Price"],
            ].map(([href, label]) => (
              <a key={href} href={href} target="_blank" rel="noreferrer"><button>{label}</button></a>
            ))}
          </div>
        </div>

        {seedScript && <script dangerouslySetInnerHTML={{ __html: seedScript }} />}
      </div>
    </>
  );
}
