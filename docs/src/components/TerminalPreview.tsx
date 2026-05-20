import { createSignal, onMount, onCleanup, Index } from "solid-js";

const MARKETS = [
  { name: "BTC above $200k by EOY?", yes: 41, vol: "$4.2M", change: "+2.1%" },
  { name: "Fed cuts rates in Sep?",   yes: 67, vol: "$8.1M", change: "+5.3%" },
  { name: "ETH flips BTC in 2026?",   yes: 18, vol: "$2.9M", change: "-1.4%" },
  { name: "AI AGI before 2030?",      yes: 55, vol: "$6.7M", change: "+0.8%" },
  { name: "US recession in 2025?",    yes: 38, vol: "$3.5M", change: "-2.2%" },
];

export function TerminalPreview() {
  const [selected, setSelected] = createSignal(1);
  const [blink, setBlink] = createSignal(true);
  const [tick, setTick] = createSignal(0);

  onMount(() => {
    const blinkId = setInterval(() => setBlink((b) => !b), 530);
    const tickId = setInterval(() => {
      setTick((t) => {
        const next = t + 1;
        if (next % 35 === 0) setSelected((s) => (s + 1) % MARKETS.length);
        return next;
      });
    }, 100);
    onCleanup(() => {
      clearInterval(blinkId);
      clearInterval(tickId);
    });
  });

  const market = () => MARKETS[selected()];
  const isPos = (c: string) => parseFloat(c) >= 0;

  const chartBars = "▁▂▃▅▄▆▇█▇▆▅▆▇▆▅▇█▇█▇";

  return (
    <div class="terminal-preview" aria-label="polytui-dashboard live preview">
      {/* header */}
      <div class="tp-header">
        <span class="tp-title">polytui-dashboard v1.0.1</span>
        <span class="tp-time">09:41:23 UTC  ●  50 markets</span>
      </div>

      {/* body */}
      <div class="tp-body">
        {/* left: market list */}
        <div class="tp-list">
          <div class="tp-section-title">MARKETS  ↑↓ navigate  Ctrl+K sort</div>
          <Index each={MARKETS}>
            {(m, i) => (
              <div class={`tp-row${selected() === i ? " tp-row--selected" : ""}`}>
                <span class="tp-row-name">{m().name}</span>
                <span class={`tp-row-yes ${isPos(m().change) ? "tp-green" : "tp-red"}`}>
                  {m().yes}¢
                </span>
              </div>
            )}
          </Index>
        </div>

        {/* right: detail panel */}
        <div class="tp-detail">
          <div class="tp-section-title">DETAIL</div>
          <div class="tp-detail-name">{market().name}</div>

          <div class="tp-detail-grid">
            <div class="tp-kv">
              <span>YES</span>
              <strong class="tp-green">{market().yes}¢</strong>
            </div>
            <div class="tp-kv">
              <span>NO</span>
              <strong class="tp-red">{100 - market().yes}¢</strong>
            </div>
            <div class="tp-kv">
              <span>VOL</span>
              <strong>{market().vol}</strong>
            </div>
            <div class="tp-kv">
              <span>24H</span>
              <strong class={isPos(market().change) ? "tp-green" : "tp-red"}>
                {market().change}
              </strong>
            </div>
          </div>

          <div class="tp-chart">
            {chartBars.split("").map((c, i) => (
              <span class={i === chartBars.length - 1 ? "tp-chart-tip" : ""}>{c}</span>
            ))}
          </div>

          <div class="tp-actions">
            <span class="tp-key">o</span>&nbsp;buy&nbsp;&nbsp;
            <span class="tp-key">s</span>&nbsp;sell&nbsp;&nbsp;
            <span class="tp-key">h</span>&nbsp;history&nbsp;&nbsp;
            <span class="tp-key">z</span>&nbsp;alerts
          </div>
        </div>
      </div>

      {/* status bar */}
      <div class="tp-status">
        <span>0x7f3c…ab4d</span>
        <span class="tp-green">● connected</span>
        <span>
          <span class="tp-key">r</span>&nbsp;refresh&nbsp;&nbsp;
          <span class="tp-key">q</span>&nbsp;quit
          <span class="tp-cursor">{blink() ? "█" : " "}</span>
        </span>
      </div>
    </div>
  );
}
