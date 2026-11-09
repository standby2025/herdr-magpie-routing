import { View, div, svg, PathBuilder } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { theme } from "herdr";

// magpie serves its routing trace to loopback callers at its gateway address;
// the Routing page long-polls the same feed (internal/gateway/trace.go).
const GATEWAY = "http://127.0.0.1:3425";
const KEEP = 60;          // routes kept, as magpie's traceKeep
const ROW = 30;           // px per node row in the stage
const SRC_W = 76, HUB_W = 52, ACC_W = 96;

const live = (r) => !r.done;
const failed = (r) => r.done && r.status >= 400;
const hash = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const clock = (iso) => new Date(iso).toTimeString().slice(0, 8);
const kilo = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `${n}`);
const provName = (r) => {
  const id = r.tries?.length ? r.tries[r.tries.length - 1].id : r.provider;
  const o = r.order?.find((x) => x.id === id) ?? r.order?.find((x) => x.provider === r.provider);
  return o?.name ?? id ?? r.provider ?? "…";
};
const provId = (r) => (r.tries?.length ? r.tries[r.tries.length - 1].id : r.provider) ?? "?";

export default class Routing extends View {
  init(_props, cx) {
    this.routes = new Map();
    this.seq = 0;
    this.pid = null;
    this.offline = false;
    this.loaded = false;
    this.size = { width: 360, height: 600 };
    cx.spawn(async (cx) => {
      for (;;) {
        try {
          const res = await fetch(`${GATEWAY}/v1/magpie/trace?after=${this.seq}${this.loaded ? "&wait=1" : ""}`);
          const d = await res.json();
          if (!Array.isArray(d.routes)) throw new Error("no trace");
          // another magpie took the gateway over: its seq is its own
          if (this.pid !== null && d.pid !== this.pid) { this.routes.clear(); this.seq = 0; }
          this.pid = d.pid;
          for (const r of d.routes) { this.routes.set(r.id, r); this.seq = Math.max(this.seq, r.seq ?? 0); }
          if (Array.isArray(d.ids)) for (const id of [...this.routes.keys()]) if (!d.ids.includes(id)) this.routes.delete(id);
          this.offline = false;
          this.loaded = true;
          cx.notify();
        } catch (_e) {
          if (!this.offline) { this.offline = true; cx.notify(); }
          await cx.sleep(3000);
        }
      }
    });
  }

  list() {
    return [...this.routes.values()].sort((a, b) => b.id - a.id).slice(0, KEEP);
  }

  // Wires between whoever sent and whoever answered, lit while one is out.
  stage(cx, t, routes) {
    const recent = routes.slice(0, 12);
    const agents = [...new Set(recent.map((r) => r.agent || "?"))].slice(0, 4);
    const provs = [];
    for (const r of recent) { const id = provId(r); if (!provs.some((p) => p.id === id)) provs.push({ id, name: provName(r) }); }
    provs.splice(5);
    const rows = Math.max(agents.length, provs.length, 1);
    const H = rows * ROW + 12;
    const W = this.size.width - 24;
    const hubX = (W - HUB_W) / 2, accX = W - ACC_W;
    const y = (i, n) => (H / n) * (i + 0.5);
    const hubY = H / 2;
    const color = (a) => t[`ansi${1 + (hash(a) % 6)}`] ?? t.accent;

    const pairs = new Map();
    for (const r of recent) {
      const a = agents.indexOf(r.agent || "?"), p = provs.findIndex((x) => x.id === provId(r));
      if (a < 0 || p < 0) continue;
      const k = `${a}:${p}`;
      const prev = pairs.get(k) ?? { a, p, live: false };
      prev.live ||= live(r);
      pairs.set(k, prev);
    }
    const lines = (list, x0, x1, ya, yb, dash) => PathBuilder.stroke(1.5).dash_array(dash)
      .move_to(x0, ya).line_to(x1, yb).build();
    const wire = (path, c) => window.paint_path(path, c);
    const stageEl = div().relative().w(W).h(H).flex_none();
    const seen = new Set();
    for (const { a, p, live: on } of pairs.values()) {
      const ya = y(a, agents.length), yp = y(p, provs.length), c = color(agents[a]);
      const k1 = `s${a}`, k2 = `a${p}`;
      if (!seen.has(k1)) { seen.add(k1); stageEl.child(div().absolute().left(0).top(0).size_full().child(wire(lines(null, SRC_W, hubX, ya, hubY, on ? [3, 5] : [2, 6]), on ? c : t.border))); }
      stageEl.child(div().absolute().left(0).top(0).size_full().child(wire(lines(null, hubX + HUB_W, accX, hubY, yp, on ? [3, 5] : [2, 6]), on ? c : t.border)));
      if (on) {
        // the magpie out and back: a dot flying each leg, linear, there and back
        const dot = (x0, y0, x1, y1, period) => div().absolute().size(7).rounded_full().bg(c)
          .left(x0).top(y0).loop("left", { from: x0, to: x1, period, easing: "linear" }).loop("top", { from: y0, to: y1, period, easing: "linear" });
        stageEl.child(dot(SRC_W, ya - 3, hubX, hubY - 3, 1200)).child(dot(hubX + HUB_W, hubY - 3, accX, yp - 3, 1200));
      }
    }
    const node = (id, x, w, yy, label, c, on) => h_flex().id(id).absolute().left(x).top(yy - 12).w(w).h(24).px(6).gap(5).items_center().rounded(6)
      .bg(t.card ?? t.raised).border(1).border_color(on ? c : t.border).text_size(11)
      .child(div().size(6).flex_none().rounded_full().bg(on ? c : t.dim).when(on, (el) => el.loop("opacity", { from: 0.35, to: 1, period: 900 })))
      .child(div().flex_1().min_w(0).truncate().text_color(on ? t.foreground : t.muted).child(label));
    agents.forEach((a, i) => stageEl.child(node(`src-${i}`, 0, SRC_W, y(i, agents.length), a, color(a), recent.some((r) => (r.agent || "?") === a && live(r)))));
    provs.forEach((p, i) => stageEl.child(node(`acc-${i}`, accX, ACC_W, y(i, provs.length), p.name, t.accent, recent.some((r) => provId(r) === p.id && live(r)))));
    stageEl.child(v_flex().absolute().left(hubX).top(hubY - 20).w(HUB_W).h(40).items_center().justify_center().gap(1).rounded(8)
      .bg(t.card ?? t.raised).border(1).border_color(t.foreground)
      .child(svg("mods/routing/bird.svg").size(16).text_color(t.foreground))
      .child(div().text_size(9).text_color(t.muted).child("magpie")));
    return stageEl;
  }

  row(r, t) {
    const bad = failed(r), on = live(r);
    const tries = r.tries?.length ?? 0;
    const c = bad ? t.blocked : on ? t.working : t.done;
    const rate = r.out && r.ms ? Math.round((r.out / r.ms) * 1000) : 0;
    return v_flex().id(`r-${r.id}`).gap(3).py(8).px(4).border_b(1).border_color(t.border).text_size(12)
      .child(h_flex().gap(8).items_center()
        .child(div().text_color(t.foreground).font_semibold().child(r.agent || "?"))
        .child(div().min_w(0).truncate().px(6).rounded(5).bg(t.raised).text_color(t.muted).child(r.model ?? ""))
        .child(div().flex_1())
        .child(div().text_size(11).text_color(t.dim).child(clock(r.time))))
      .child(h_flex().gap(6).items_center().text_size(11).text_color(t.muted)
        .child(div().size(6).flex_none().rounded_full().bg(c).when(on, (el) => el.loop("opacity", { from: 0.3, to: 1, period: 900 })))
        .child(div().truncate().child(provName(r)))
        .child(div().flex_1().min_w(0).truncate().text_color(t.dim).child(
          on ? "routing…" : [`${tries} ${tries === 1 ? "try" : "tries"}`, r.tokens ? `${kilo(r.tokens)} tokens` : null, r.ms ? `${(r.ms / 1000).toFixed(1)}s` : null, rate ? `${rate} tok/s` : null, bad ? `HTTP ${r.status}` : null].filter(Boolean).join(" · "))));
  }

  render(cx) {
    const t = theme();
    const routes = this.list();
    const n = routes.filter(live).length;
    const header = h_flex().h(40).px(12).gap(8).items_center().flex_none().border_b(1).border_color(t.border)
      .child(svg("mods/routing/bird.svg").size(15).text_color(t.foreground))
      .child(div().font_semibold().text_color(t.foreground).child("Magpie"))
      .child(h_flex().gap(5).items_center().text_size(11).text_color(t.muted)
        .child(div().size(6).rounded_full().bg(this.offline ? t.dim : n ? t.working : t.idle).when(n > 0, (el) => el.loop("opacity", { from: 0.3, to: 1, period: 900 })))
        .child(this.offline ? "offline" : n ? `${n} live` : "idle"));
    const body = this.offline && !routes.length
      ? div().p(16).text_size(12).text_color(t.muted).child("magpie isn't answering at 127.0.0.1:3425. Start it and requests show up here.")
      : !routes.length
        ? div().p(16).text_size(12).text_color(t.muted).child("No request yet.")
        : v_flex().id("rt-scroll").flex_1().min_h(0).overflow_y_scrollbar().px(12).pb(8)
          .child(div().py(12).child(this.stage(cx, t, routes)))
          .child(div().text_size(10).text_color(t.dim).pb(4).child(`RECENT  ${routes.length}`))
          .children(routes.map((r) => this.row(r, t)));
    const footer = div().h(26).px(12).flex_none().flex().items_center().border_t(1).border_color(t.border).text_size(11).text_color(t.dim)
      .child(`127.0.0.1:3425${this.pid ? ` · pid ${this.pid}` : ""} · ${this.routes.size} calls`);
    return v_flex().id("routing-root").size_full().bg(t.surface)
      .on_size_change((size, cx) => { if (Math.abs(size.width - this.size.width) > 1) { this.size = size; cx.notify(); } })
      .child(header).child(body).child(footer);
  }
}
