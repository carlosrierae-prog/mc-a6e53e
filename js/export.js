/* Multicamiones — Exportar PDF
   Genera un PDF de 1-2 páginas con la paleta de marca de PubliRocket
   (navy oscuro + acentos cian/verde/rojo), a partir de los datos ya
   cargados por app.js para el rango de fechas filtrado. Cliente puro:
   html2canvas rasteriza cada página, jsPDF arma el archivo. No depende
   de ningún backend ni de pedírselo a Claude.
*/

(() => {
  "use strict";

  const PAGE_W = 794;   // A4 @ 96dpi
  const PAGE_H = 1123;

  const COLORS = {
    bg: "#121829",
    card: "#161E33",
    cardBorder: "#232D4A",
    textPrimary: "#FFFFFF",
    textMuted: "#8B96B3",
    textFaint: "#5E6B8A",
    cyan: "#00E5FF",
    green: "#3DDC97",
    red: "#FF5C7A",
    amber: "#FFB84D",
  };

  function fmtMoney(v) {
    return v == null ? "—" : `S/${v.toFixed(2)}`;
  }

  function el(tag, styles, html) {
    const e = document.createElement(tag);
    if (styles) Object.assign(e.style, styles);
    if (html != null) e.innerHTML = html;
    return e;
  }

  function buildPageShell(pageNum) {
    const page = el("div", {
      width: PAGE_W + "px",
      minHeight: PAGE_H + "px",
      background: COLORS.bg,
      color: COLORS.textPrimary,
      fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
      padding: "40px 44px",
      boxSizing: "border-box",
      position: "relative",
    });

    const header = el("div", {
      display: "flex", alignItems: "center", justifyContent: "space-between",
      borderBottom: `1px solid ${COLORS.cardBorder}`, paddingBottom: "16px", marginBottom: "24px",
    });
    const logo = el("img");
    logo.src = "assets/publirocket-logo.png";
    Object.assign(logo.style, { height: "20px" });
    const brandRight = el("div", { fontSize: "11px", color: COLORS.textMuted, textAlign: "right" }, "Multicamiones · Meta Ads");
    header.append(logo, brandRight);
    page.appendChild(header);

    const footer = el("div", {
      position: "absolute", bottom: "28px", left: "44px", right: "44px",
      display: "flex", justifyContent: "space-between",
      fontSize: "10px", color: COLORS.textFaint,
      borderTop: `1px solid ${COLORS.cardBorder}`, paddingTop: "10px",
    });
    footer.append(
      el("span", null, "PUBLIROCKET · PAID MEDIA · CONFIDENCIAL"),
      el("span", null, `Página ${pageNum}`)
    );
    page.appendChild(footer);

    const body = el("div");
    page.appendChild(body);

    return { page, body };
  }

  function kpiTile(val, lbl) {
    return el("div", {
      flex: "1", background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`,
      borderRadius: "10px", padding: "16px 18px",
    }, `<div style="font-size:26px;font-weight:700;font-variant-numeric:tabular-nums;">${val}</div>
        <div style="font-size:10.5px;color:${COLORS.textMuted};text-transform:uppercase;letter-spacing:0.04em;margin-top:4px;">${lbl}</div>`);
  }

  function buildPage1(data) {
    const { page, body } = buildPageShell(1);
    const { campaigns, dates, indices, from, to } = data;
    const fmtInt = window.MC.fmtInt;
    const fmtDateISO = window.MC.fmtDateISO;

    body.appendChild(el("div", { fontSize: "10.5px", color: COLORS.cyan, letterSpacing: "0.08em", fontWeight: "600", marginBottom: "6px" }, "REPORTE DE PERFORMANCE"));
    body.appendChild(el("div", { fontSize: "28px", fontWeight: "700", marginBottom: "6px" }, "Multicamiones — Resultados por campaña"));
    body.appendChild(el("div", { fontSize: "13px", color: COLORS.textMuted, marginBottom: "26px" },
      `${fmtDateISO(from)} → ${fmtDateISO(to)} (${indices.length} día${indices.length === 1 ? "" : "s"}) · generado el ${fmtDateISO(new Date())}`));

    const total = campaigns.reduce((s, c) => s + indices.reduce((ss, i) => ss + c.values[i], 0), 0);
    let top = null, topTotal = -1;
    campaigns.forEach((c) => {
      const t = indices.reduce((s, i) => s + c.values[i], 0);
      if (t > topTotal) { topTotal = t; top = c; }
    });
    const avgDaily = indices.length ? (total / indices.length) : 0;

    const kpiRow = el("div", { display: "flex", gap: "12px", marginBottom: "28px" });
    kpiRow.append(
      kpiTile(fmtInt.format(total), "Resultados totales"),
      kpiTile(fmtInt.format(indices.length), "Días en el rango"),
      kpiTile(top ? top.name : "—", "Campaña líder"),
      kpiTile(avgDaily.toFixed(1), "Promedio diario")
    );
    body.appendChild(kpiRow);

    body.appendChild(el("div", { fontSize: "13px", fontWeight: "600", marginBottom: "10px" }, "Desempeño por campaña"));

    const table = el("div", { border: `1px solid ${COLORS.cardBorder}`, borderRadius: "10px", overflow: "hidden" });
    const head = el("div", {
      display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", padding: "10px 14px",
      background: COLORS.card, fontSize: "10.5px", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.03em",
    }, `<div>Campaña</div><div style="text-align:right">Total en rango</div><div style="text-align:right">Último día</div><div style="text-align:right">vs. anterior</div>`);
    table.appendChild(head);

    const lastIdx = indices.length ? indices[indices.length - 1] : null;
    const prevIdx = lastIdx != null ? lastIdx - 1 : null;

    campaigns.forEach((c, i) => {
      const campTotal = indices.reduce((s, idx) => s + c.values[idx], 0);
      const curr = lastIdx != null ? c.values[lastIdx] : 0;
      const hasPrev = prevIdx != null && prevIdx >= 0;
      const prev = hasPrev ? c.values[prevIdx] : null;
      let deltaTxt = "—", deltaColor = COLORS.textMuted;
      if (hasPrev) {
        const { pct, kind } = window.MC.computeDelta(curr, prev);
        if (kind === "new") { deltaTxt = "nuevo"; deltaColor = COLORS.green; }
        else if (kind === "flat") { deltaTxt = "0%"; deltaColor = COLORS.textMuted; }
        else { deltaTxt = `${kind === "up" ? "▲" : "▼"} ${Math.abs(pct).toFixed(0)}%`; deltaColor = kind === "up" ? COLORS.green : COLORS.red; }
      }
      const row = el("div", {
        display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", padding: "11px 14px",
        borderTop: `1px solid ${COLORS.cardBorder}`, fontSize: "12.5px",
        background: i % 2 === 1 ? "rgba(255,255,255,0.015)" : "transparent",
      });
      row.innerHTML = `<div>${c.name}</div>
        <div style="text-align:right;font-variant-numeric:tabular-nums;">${fmtInt.format(campTotal)}</div>
        <div style="text-align:right;font-variant-numeric:tabular-nums;">${fmtInt.format(curr)}</div>
        <div style="text-align:right;color:${deltaColor};font-weight:600;">${deltaTxt}</div>`;
      table.appendChild(row);
    });
    body.appendChild(table);

    return page;
  }

  function seqColor(t) {
    // t in [0,1] -> interpolate from card bg toward cyan
    const from = [22, 30, 51];   // #161E33
    const to = [0, 229, 255];    // cyan
    const rgb = from.map((f, i) => Math.round(f + (to[i] - f) * t));
    return `rgb(${rgb.join(",")})`;
  }

  function buildPage2(data) {
    const { page, body } = buildPageShell(2);
    const { campaigns, dates, indices } = data;
    const weekdayIndexMon0 = window.MC.weekdayIndexMon0;
    const WEEKDAY_LABELS = window.MC.WEEKDAY_LABELS;

    body.appendChild(el("div", { fontSize: "18px", fontWeight: "700", marginBottom: "4px" }, "Mapa de calor semanal"));
    body.appendChild(el("div", { fontSize: "12px", color: COLORS.textMuted, marginBottom: "20px" }, "Promedio de resultados por día de la semana, dentro del rango filtrado"));

    const averages = campaigns.map(() => Array.from({ length: 7 }, () => ({ sum: 0, n: 0 })));
    indices.forEach((i) => {
      const wd = weekdayIndexMon0(dates[i]);
      campaigns.forEach((c, ci) => { averages[ci][wd].sum += c.values[i]; averages[ci][wd].n += 1; });
    });
    let min = Infinity, max = -Infinity;
    averages.forEach((row) => row.forEach((cell) => {
      if (!cell.n) return;
      const avg = cell.sum / cell.n;
      if (avg < min) min = avg;
      if (avg > max) max = avg;
    }));
    if (!isFinite(min)) { min = 0; max = 0; }

    const grid = el("div", { border: `1px solid ${COLORS.cardBorder}`, borderRadius: "10px", overflow: "hidden", marginBottom: "30px" });
    const headRow = el("div", { display: "grid", gridTemplateColumns: "1.6fr repeat(7, 1fr)", background: COLORS.card });
    headRow.appendChild(el("div", { padding: "9px 12px", fontSize: "10px", color: COLORS.textMuted, textTransform: "uppercase" }, "Campaña"));
    WEEKDAY_LABELS.forEach((l) => headRow.appendChild(el("div", { padding: "9px 6px", fontSize: "10px", color: COLORS.textMuted, textAlign: "center", textTransform: "uppercase" }, l)));
    grid.appendChild(headRow);

    campaigns.forEach((c, ci) => {
      const row = el("div", { display: "grid", gridTemplateColumns: "1.6fr repeat(7, 1fr)", borderTop: `1px solid ${COLORS.cardBorder}` });
      row.appendChild(el("div", { padding: "10px 12px", fontSize: "11.5px", color: COLORS.textPrimary }, c.name));
      averages[ci].forEach((cell) => {
        if (!cell.n) {
          row.appendChild(el("div", { padding: "10px 6px", textAlign: "center", fontSize: "11.5px", color: COLORS.textFaint }, "–"));
        } else {
          const avg = cell.sum / cell.n;
          const t = max === min ? 0.5 : (avg - min) / (max - min);
          const bg = seqColor(t);
          const textColor = t > 0.55 ? "#06141c" : COLORS.textPrimary;
          row.appendChild(el("div", { padding: "10px 6px", textAlign: "center", fontSize: "11.5px", fontWeight: "600", background: bg, color: textColor }, avg.toFixed(1)));
        }
      });
      grid.appendChild(row);
    });
    body.appendChild(grid);

    // ad detail for the selected campaign, if any
    const adsBlock = el("div");
    const campaignData = data.ads && data.ads.campaigns && data.selectedCampaignId
      ? data.ads.campaigns[data.selectedCampaignId] : null;
    const campaignMeta = data.campaigns.find((c) => c.id === data.selectedCampaignId);

    if (campaignData && campaignMeta) {
      adsBlock.appendChild(el("div", { fontSize: "18px", fontWeight: "700", marginBottom: "4px" }, `Anuncios activos — ${campaignMeta.name}`));
      adsBlock.appendChild(el("div", { fontSize: "12px", color: COLORS.textMuted, marginBottom: "16px" },
        `KPI de ${data.ads.window_label || data.ads.window} · no depende del rango de fechas elegido arriba`));

      const cardsWrap = el("div", { display: "flex", flexDirection: "column", gap: "10px" });
      (campaignData.ads || []).forEach((ad) => {
        const badge = ad.action === "scale"
          ? `<span style="color:${COLORS.green};font-weight:700;font-size:10px;text-transform:uppercase;">▲ Escalar</span>`
          : ad.action === "review"
            ? `<span style="color:${COLORS.red};font-weight:700;font-size:10px;text-transform:uppercase;">⚠ Revisar</span>`
            : "";
        const card = el("div", { background: COLORS.card, border: `1px solid ${COLORS.cardBorder}`, borderRadius: "8px", padding: "12px 14px" });
        card.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <span style="font-size:12.5px;font-weight:600;">${ad.name}</span>${badge}
          </div>
          <div style="display:flex;gap:22px;font-size:11px;color:${COLORS.textMuted};">
            <span>Gasto <b style="color:${COLORS.textPrimary}">${fmtMoney(ad.spend)}</b></span>
            <span>${ad.result_label} <b style="color:${COLORS.textPrimary}">${ad.results}</b></span>
            <span>Costo/result. <b style="color:${COLORS.textPrimary}">${fmtMoney(ad.cost_per_result)}</b></span>
            <span>CTR <b style="color:${COLORS.textPrimary}">${ad.ctr.toFixed(2)}%</b></span>
          </div>`;
        cardsWrap.appendChild(card);
      });
      adsBlock.appendChild(cardsWrap);
    } else {
      adsBlock.appendChild(el("div", {
        fontSize: "12px", color: COLORS.textFaint, fontStyle: "italic",
        border: `1px dashed ${COLORS.cardBorder}`, borderRadius: "8px", padding: "14px",
      }, "Selecciona una campaña en el dashboard (clic en su tarjeta) antes de exportar para incluir aquí el detalle de sus anuncios activos."));
    }
    body.appendChild(adsBlock);

    return page;
  }

  async function exportPdf() {
    const btn = document.getElementById("export-pdf");
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Generando…";

    try {
      const data = window.MC.getExportData();
      if (!data.indices.length) {
        alert("No hay datos en el rango filtrado — ajusta las fechas antes de exportar.");
        return;
      }

      const stage = el("div", { position: "fixed", left: "-9999px", top: "0", zIndex: "-1" });
      const page1 = buildPage1(data);
      const page2 = buildPage2(data);
      stage.append(page1, page2);
      document.body.appendChild(stage);

      // let the browser lay out + load the logo image before rasterizing
      await new Promise((r) => setTimeout(r, 60));

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ unit: "px", format: [PAGE_W, PAGE_H], orientation: "portrait" });

      for (const [i, pageEl] of [page1, page2].entries()) {
        const canvas = await window.html2canvas(pageEl, { scale: 2, backgroundColor: COLORS.bg, useCORS: true });
        const img = canvas.toDataURL("image/jpeg", 0.92);
        if (i > 0) pdf.addPage([PAGE_W, PAGE_H], "portrait");
        pdf.addImage(img, "JPEG", 0, 0, PAGE_W, PAGE_H);
      }

      document.body.removeChild(stage);

      const fmtDateISO = window.MC.fmtDateISO;
      const fname = `Multicamiones_Reporte_${fmtDateISO(data.from)}_${fmtDateISO(data.to)}.pdf`;
      pdf.save(fname);
    } catch (err) {
      console.error("Error exportando PDF:", err);
      alert("No se pudo generar el PDF — revisa la consola (F12) para más detalle.");
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("export-pdf");
    if (btn) btn.addEventListener("click", exportPdf);
  });
})();
