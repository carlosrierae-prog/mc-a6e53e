#!/usr/bin/env python3
"""
Jala el "Resultado" (métrica de resultados de Ads Manager) del día anterior por
campaña desde la Meta Marketing API y lo agrega a data/daily.json.

Requiere la env var META_ACCESS_TOKEN (token de sistema/usuario con permiso
ads_read sobre la cuenta). El mapeo campaña -> ID real de Meta vive en
.github/meta-campaign-map.json.
"""

import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[2]
DATA_PATH = ROOT / "data" / "daily.json"
MAP_PATH = ROOT / ".github" / "meta-campaign-map.json"
GRAPH_VERSION = "v20.0"


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def fetch_results(campaign_id, day_iso, token):
    """Devuelve el valor de 'Resultados' (campo `results` de Insights) de una
    campaña para un día específico, tal como lo calcula Ads Manager según el
    objetivo/optimización de esa campaña."""
    url = f"https://graph.facebook.com/{GRAPH_VERSION}/{campaign_id}/insights"
    params = {
        "fields": "results",
        "time_range": json.dumps({"since": day_iso, "until": day_iso}),
        "access_token": token,
    }
    resp = requests.get(url, params=params, timeout=30)
    resp.raise_for_status()
    rows = resp.json().get("data", [])
    if not rows:
        return 0
    results = rows[0].get("results", [])
    total = 0
    for r in results:
        for v in r.get("values", []):
            total += int(v.get("value", 0) or 0)
    return total


def main():
    token = os.environ.get("META_ACCESS_TOKEN")
    if not token:
        print("META_ACCESS_TOKEN no está configurado — abortando.", file=sys.stderr)
        sys.exit(1)

    campaign_map = load_json(MAP_PATH)
    daily = load_json(DATA_PATH)

    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).date()
    yesterday_iso = yesterday.isoformat()

    period_start = datetime.fromisoformat(daily["period"]["start"]).date()
    period_end = datetime.fromisoformat(daily["period"]["end"]).date()
    expected_len = (period_end - period_start).days + 1
    days_gap = (yesterday - period_end).days

    if days_gap <= 0:
        print(f"{yesterday_iso} ya está cubierto en data/daily.json — nada que hacer.")
        return
    if days_gap > 1:
        print(
            f"Hay un hueco de {days_gap} días entre {period_end} y {yesterday_iso}. "
            "Corre el workflow manualmente para los días faltantes o rellena a mano.",
            file=sys.stderr,
        )

    id_to_meta = {c["id"]: c["meta_campaign_id"] for c in campaign_map["campaigns"]}

    for campaign in daily["campaigns"]:
        cid = campaign["id"]
        meta_id = id_to_meta.get(cid, "")
        if not meta_id or meta_id.startswith("REEMPLAZAR"):
            print(f"[{cid}] sin meta_campaign_id configurado, se agrega 0.", file=sys.stderr)
            value = 0
        else:
            try:
                value = fetch_results(meta_id, yesterday_iso, token)
            except requests.HTTPError as e:
                print(f"[{cid}] error consultando Meta API: {e}", file=sys.stderr)
                value = 0

        # rellena cualquier hueco con 0 antes de agregar el valor real de ayer
        while len(campaign["values"]) < expected_len + days_gap - 1:
            campaign["values"].append(0)
        campaign["values"].append(value)

    daily["period"]["end"] = yesterday_iso
    save_json(DATA_PATH, daily)
    print(f"data/daily.json actualizado con el {yesterday_iso}.")


if __name__ == "__main__":
    main()
