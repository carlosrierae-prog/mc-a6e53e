/* Multicamiones — Ad Performance Console
   Loads data/daily.json, then renders comparison cards, weekly heatmap,
   and a raw-data table, all re-derived from the active date-range filter. */

(() => {
  "use strict";

  const SERIES_COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181"];
  const SEQ_STEPS = ["#cde2fb", "#b7d3f6", "#9ec5f4", "#86b6ef", "#6da7ec", "#5598e7",
                      "#3987e5", "#2a78d6", "#256abf", "#1c5cab", "#184f95", "#104281", "#0d366b"];
  const SEQ_DARK_TEXT_UNTIL = 5; // steps 0..5 use dark text, 6+ use light text
  const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const WEEKDAY_LABELS_FULL = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

  const fmtInt = new Intl.NumberFormat("es-MX");
  const fmtDateLabel = (d) => d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", timeZone: "UTC" });
  const fmtDateISO = (d) => d.toISOString().slice(0, 10);

  const $ = (sel) => document.querySelector(sel);

  const state = {
    campaigns: [],   // [{id, name, metric, values, color}]
    dates: [],       // Date[] aligned with values index, UTC midnight
    dateIndex: new Map(), // ISO string -> index
    periodStart: null,
    periodEnd: null,
    from: null,
    to: null,
  };

  function utc(y, m, d) { return new Date(Date.UTC(y, m, d)); }

  function parseISO(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return utc(y, m - 1, d);
  }

  function addDays(date, n) {
    return new Date(date.getTime() + n * 86400000);
  }

  function weekdayIndexMon0(date) {
    return (date.getUTCDay() + 6) % 7;
  }

  async function loadData() {
    const res = await fetch("data/daily.json", { cache: "no-store" });
    if (!res.ok) throw new Error("No se pudo cargar data/daily.json");
    const json = await res.json();

    state.periodStart = parseISO(json.period.start);
    state.periodEnd = parseISO(json.period.end);

    const dayCount = json.campaigns[0].values.length;
    state.dates = Array.from({ length: dayCount }, (_, i) => addDays(state.periodStart, i));
    state.dateIndex = new Map(state.dates.map((d, i) => [fmtDateISO(d), i]));

    state.campaigns = json.campaigns.map((c, i) => ({
      ...c,
      color: SERIES_COLORS[i % SERIES_COLORS.length],
    }));

    state.from = state.periodStart;
    state.to = state.periodEnd;

    document.title = `Multicamiones · ${json.account.meta_account_id} · Rendimiento publicitario`;
    $("#account-label").textContent = `Meta Ads · ${json.account.meta_account_id}`;
  }

  // ---------- filter range helpers ----------

  function clampToPeriod(date) {
    if (date < state.periodStart) return state.periodStart;
    if (date > state.periodEnd) return state.periodEnd;
    return date;
  }

  function filteredIndices() {
    const out = [];
    for (let i = 0; i < state.dates.length; i++) {
      if (state.dates[i] >= state.from && state.dates[i] <= state.to) out.push(i);
    }
    return out;
  }

  // ---------- rendering: hero stats ----------

  function renderHeroStats(indices) {
    const el = $("#hero-stats");
    el.innerHTML = "";

    const total = state.campaigns.reduce(
      (sum, c) => sum + indices.reduce((s, i) => s + c.values[i], 0), 0
    );

    let topCampaign = null, topTotal = -1;
    state.campaigns.forEach((c) => {
      const t = indices.reduce((s, i) => s + c.values[i], 0);
      if (t > topTotal) { topTotal = t; topCampaign = c; }
    });

    const stats = [
      { lbl: "Resultados totales", val: fmtInt.format(total) },
      { lbl: "Días en el rango", val: fmtInt.format(indices.length) },
      { lbl: "Campaña líder", val: topCampaign ? topCampaign.name : "—" },
    ];

    stats.forEach((s) => {
      const div = document.createElement("div");
      div.className = "hero-stat";
      const val = document.createElement("span");
      val.className = "val";
      val.textContent = s.val;
      const lbl = document.createElement("span");
      lbl.className = "lbl";
      lbl.textContent = s.lbl;
      div.append(val, lbl);
      el.appendChild(div);
    });
  }

  // ---------- rendering: comparison cards ----------

  function computeDelta(curr, prev) {
    if (prev === 0) {
      if (curr === 0) return { pct: 0, kind: "flat" };
      return { pct: null, kind: "new" };
    }
    const pct = ((curr - prev) / prev) * 100;
    return { pct, kind: pct > 0 ? "up" : pct < 0 ? "down" : "flat" };
  }

  function renderCards(indices) {
    const grid = $("#cards-grid");
    grid.innerHTML = "";

    if (indices.length === 0) {
      grid.innerHTML = `<p class="card-empty">No hay datos en el rango seleccionado.</p>`;
      return;
    }

    const lastIdx = indices[indices.length - 1];
    const lastDate = state.dates[lastIdx];
    const prevIdx = lastIdx - 1; // previous calendar day, from full dataset (not clipped to filter)

    state.campaigns.forEach((c) => {
      const card = document.createElement("div");
      card.className = "card";
      card.style.setProperty("--accent", c.color);

      const curr = c.values[lastIdx];
      const hasPrev = prevIdx >= 0;
      const prev = hasPrev ? c.values[prevIdx] : null;

      const head = document.createElement("div");
      head.className = "card-head";
      head.innerHTML = `<span class="card-dot"></span><span class="card-name"></span>`;
      head.querySelector(".card-name").textContent = c.name;

      const valueRow = document.createElement("div");
      valueRow.className = "card-value-row";

      const valueEl = document.createElement("span");
      valueEl.className = "card-value";
      valueEl.textContent = fmtInt.format(curr);
      valueRow.appendChild(valueEl);

      if (hasPrev) {
        const { pct, kind } = computeDelta(curr, prev);
        const delta = document.createElement("span");
        delta.className = `card-delta ${kind}`;
        if (kind === "new") {
          delta.textContent = "▲ nuevo";
        } else if (kind === "flat") {
          delta.textContent = "0%";
        } else {
          const arrow = kind === "up" ? "▲" : "▼";
          delta.textContent = `${arrow} ${Math.abs(pct).toFixed(0)}%`;
        }
        valueRow.appendChild(delta);
      }

      const sub = document.createElement("div");
      sub.className = "card-sub";
      sub.textContent = hasPrev
        ? `vs ${fmtInt.format(prev)} el ${fmtDateLabel(state.dates[prevIdx])}`
        : "sin día anterior disponible";

      const capt = document.createElement("div");
      capt.className = "card-sub";
      capt.style.marginBottom = "8px";
      capt.style.marginTop = "-4px";
      capt.textContent = fmtDateLabel(lastDate);

      const spark = document.createElement("div");
      spark.className = "card-spark";
      spark.setAttribute("aria-hidden", "true");
      const sparkVals = indices.map((i) => c.values[i]);
      const max = Math.max(1, ...sparkVals);
      sparkVals.forEach((v, k) => {
        const bar = document.createElement("i");
        bar.style.height = `${Math.max(6, (v / max) * 100)}%`;
        if (k === sparkVals.length - 1) bar.classList.add("is-last");
        spark.appendChild(bar);
      });

      card.append(head, valueRow, capt, sub, spark);
      grid.appendChild(card);
    });
  }

  // ---------- rendering: weekly heatmap ----------

  function renderHeatmap(indices) {
    const el = $("#heatmap");
    const legendEl = $("#heatmap-legend");
    el.innerHTML = "";
    legendEl.innerHTML = "";

    // averages[campaignIdx][weekday 0..6] = { sum, n }
    const averages = state.campaigns.map(() => Array.from({ length: 7 }, () => ({ sum: 0, n: 0 })));

    indices.forEach((i) => {
      const wd = weekdayIndexMon0(state.dates[i]);
      state.campaigns.forEach((c, ci) => {
        averages[ci][wd].sum += c.values[i];
        averages[ci][wd].n += 1;
      });
    });

    let min = Infinity, max = -Infinity;
    averages.forEach((row) => row.forEach((cell) => {
      if (cell.n === 0) return;
      const avg = cell.sum / cell.n;
      if (avg < min) min = avg;
      if (avg > max) max = avg;
    }));
    if (!isFinite(min)) { min = 0; max = 0; }

    const stepFor = (avg) => {
      if (max === min) return Math.floor(SEQ_STEPS.length / 2);
      const t = (avg - min) / (max - min);
      return Math.min(SEQ_STEPS.length - 1, Math.floor(t * SEQ_STEPS.length));
    };

    // header row
    const head = document.createElement("div");
    head.className = "hm-row hm-head";
    head.setAttribute("role", "row");
    const corner = document.createElement("div");
    corner.className = "hm-cell hm-rowlabel";
    corner.setAttribute("role", "columnheader");
    corner.textContent = "Campaña";
    head.appendChild(corner);
    WEEKDAY_LABELS.forEach((lbl) => {
      const c = document.createElement("div");
      c.className = "hm-cell";
      c.setAttribute("role", "columnheader");
      c.textContent = lbl;
      head.appendChild(c);
    });
    el.appendChild(head);

    state.campaigns.forEach((c, ci) => {
      const row = document.createElement("div");
      row.className = "hm-row";
      row.setAttribute("role", "row");

      const rowLabel = document.createElement("div");
      rowLabel.className = "hm-cell hm-rowlabel";
      rowLabel.setAttribute("role", "rowheader");
      rowLabel.innerHTML = `<span class="card-dot"></span><span></span>`;
      rowLabel.querySelector("span:last-child").textContent = c.name;
      rowLabel.style.setProperty("--accent", c.color);
      row.appendChild(rowLabel);

      averages[ci].forEach((cell, wd) => {
        const cellEl = document.createElement("div");
        cellEl.className = "hm-cell";
        cellEl.setAttribute("role", "cell");

        if (cell.n === 0) {
          cellEl.classList.add("empty");
          cellEl.textContent = "–";
          cellEl.tabIndex = -1;
          cellEl.setAttribute("aria-label", `${c.name}, ${WEEKDAY_LABELS_FULL[wd]}: sin datos`);
        } else {
          const avg = cell.sum / cell.n;
          const step = stepFor(avg);
          cellEl.style.background = SEQ_STEPS[step];
          cellEl.style.color = step <= SEQ_DARK_TEXT_UNTIL ? "#0b0f16" : "#ffffff";
          cellEl.textContent = avg.toFixed(1);
          cellEl.tabIndex = 0;
          const label = `${c.name}, ${WEEKDAY_LABELS_FULL[wd]}: promedio ${avg.toFixed(1)} (${cell.n} día${cell.n === 1 ? "" : "s"})`;
          cellEl.setAttribute("aria-label", label);

          const showTip = (evt) => showTooltip(evt, `${avg.toFixed(1)}`, `${c.name} · ${WEEKDAY_LABELS_FULL[wd]} · ${cell.n} día${cell.n === 1 ? "" : "s"}`);
          cellEl.addEventListener("pointerenter", showTip);
          cellEl.addEventListener("pointermove", showTip);
          cellEl.addEventListener("pointerleave", hideTooltip);
          cellEl.addEventListener("focus", (e) => showTooltip(e, `${avg.toFixed(1)}`, `${c.name} · ${WEEKDAY_LABELS_FULL[wd]} · ${cell.n} día${cell.n === 1 ? "" : "s"}`));
          cellEl.addEventListener("blur", hideTooltip);
        }
        row.appendChild(cellEl);
      });

      el.appendChild(row);
    });

    // legend
    const ramp = document.createElement("div");
    ramp.className = "legend-ramp";
    SEQ_STEPS.forEach((hex) => {
      const s = document.createElement("span");
      s.style.background = hex;
      ramp.appendChild(s);
    });
    const lo = document.createElement("span");
    lo.textContent = min.toFixed(1);
    const hi = document.createElement("span");
    hi.textContent = max.toFixed(1);
    legendEl.append(lo, ramp, hi);
  }

  // ---------- tooltip ----------

  function showTooltip(evt, value, label) {
    const tip = $("#tooltip");
    tip.hidden = false;
    tip.innerHTML = `<span class="tt-value"></span><span class="tt-label"></span>`;
    tip.querySelector(".tt-value").textContent = value;
    tip.querySelector(".tt-label").textContent = label;

    let x, y;
    if (evt.clientX !== undefined && evt.clientX !== 0) {
      x = evt.clientX; y = evt.clientY;
    } else {
      const r = evt.target.getBoundingClientRect();
      x = r.left + r.width / 2; y = r.top;
    }
    tip.style.left = `${x}px`;
    tip.style.top = `${y - 8}px`;
  }

  function hideTooltip() {
    $("#tooltip").hidden = true;
  }

  // ---------- rendering: table ----------

  function renderTable(indices) {
    const table = $("#data-table");
    const thead = table.querySelector("thead");
    const tbody = table.querySelector("tbody");
    thead.innerHTML = "";
    tbody.innerHTML = "";

    const headRow = document.createElement("tr");
    ["Fecha", "Día", ...state.campaigns.map((c) => c.name)].forEach((h) => {
      const th = document.createElement("th");
      th.textContent = h;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);

    indices.forEach((i) => {
      const tr = document.createElement("tr");
      const d = state.dates[i];
      const tdDate = document.createElement("td");
      tdDate.textContent = fmtDateISO(d);
      const tdDay = document.createElement("td");
      tdDay.textContent = WEEKDAY_LABELS[weekdayIndexMon0(d)];
      tr.append(tdDate, tdDay);
      state.campaigns.forEach((c) => {
        const td = document.createElement("td");
        td.textContent = fmtInt.format(c.values[i]);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }

  // ---------- orchestration ----------

  function renderAll() {
    const indices = filteredIndices();
    renderHeroStats(indices);
    renderCards(indices);
    renderHeatmap(indices);
    renderTable(indices);

    const note = $("#filter-note");
    note.textContent = indices.length
      ? `Mostrando ${fmtDateISO(state.from)} → ${fmtDateISO(state.to)} (${indices.length} día${indices.length === 1 ? "" : "s"})`
      : "Sin datos en el rango seleccionado.";
  }

  function setPresetActive(name) {
    document.querySelectorAll("#presets button").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.preset === name));
    });
  }

  function applyRange(from, to, presetName) {
    state.from = clampToPeriod(from);
    state.to = clampToPeriod(to);
    if (state.from > state.to) [state.from, state.to] = [state.to, state.from];

    $("#date-from").value = fmtDateISO(state.from);
    $("#date-to").value = fmtDateISO(state.to);
    setPresetActive(presetName || "");
    renderAll();
  }

  function wireControls() {
    const fromInput = $("#date-from");
    const toInput = $("#date-to");
    const minISO = fmtDateISO(state.periodStart);
    const maxISO = fmtDateISO(state.periodEnd);
    [fromInput, toInput].forEach((inp) => { inp.min = minISO; inp.max = maxISO; });

    fromInput.value = minISO;
    toInput.value = maxISO;

    fromInput.addEventListener("change", () => {
      applyRange(parseISO(fromInput.value || minISO), parseISO(toInput.value || maxISO), null);
    });
    toInput.addEventListener("change", () => {
      applyRange(parseISO(fromInput.value || minISO), parseISO(toInput.value || maxISO), null);
    });

    document.querySelectorAll("#presets button").forEach((btn) => {
      btn.addEventListener("click", () => {
        const p = btn.dataset.preset;
        if (p === "all") applyRange(state.periodStart, state.periodEnd, p);
        else if (p === "last7") applyRange(addDays(state.periodEnd, -6), state.periodEnd, p);
        else if (p === "first15") applyRange(state.periodStart, addDays(state.periodStart, 14), p);
        else if (p === "last16") applyRange(addDays(state.periodStart, 15), state.periodEnd, p);
      });
    });

    const tableToggle = $("#table-toggle");
    const tableSection = $("#table-section");
    tableToggle.addEventListener("click", () => {
      const isOpen = !tableSection.hidden;
      tableSection.hidden = isOpen;
      tableToggle.setAttribute("aria-pressed", String(!isOpen));
      tableToggle.textContent = isOpen ? "Ver tabla de datos" : "Ocultar tabla de datos";
      if (!isOpen) tableSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  async function init() {
    try {
      await loadData();
      wireControls();
      setPresetActive("all");
      renderAll();
    } catch (err) {
      console.error(err);
      $("main.wrap") && ($("#filter-note").textContent = "Error cargando data/daily.json — revisa la consola.");
      document.querySelector(".wrap").insertAdjacentHTML(
        "afterbegin",
        `<div style="background:#3a1414;border:1px solid #d03b3b;color:#ffb4b4;padding:14px 16px;border-radius:10px;margin:20px 0;font-size:13px;">
          No se pudo cargar <code>data/daily.json</code>. Si abriste este archivo directamente (file://), sírvelo con un servidor local, por ejemplo:
          <br><code>python3 -m http.server 8080</code> y visita <code>http://localhost:8080</code>.
        </div>`
      );
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
