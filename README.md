# Multicamiones · Ad Performance Console

Dashboard estático de rendimiento de Meta Ads para Multicamiones. Vanilla HTML/CSS/JS, sin frameworks, pensado para publicarse en GitHub Pages.

Cuenta de Meta Ads: `635475068426730`

## Estructura

```
index.html              dashboard (filtro, tarjetas, mapa de calor, tabla)
css/style.css            tema oscuro
js/app.js                lógica: fetch de datos, filtro, render
data/daily.json           datos diarios por campaña (reemplazable)
.github/workflows/        automatización opcional vía Meta API (ver abajo)
```

## Actualizar los datos a mano

Edita `data/daily.json`. Cada campaña tiene un array `values` con un resultado por día, empezando en `period.start`. Para agregar un día nuevo, agrega un número al final de cada array y actualiza `period.end`. No hay que tocar el HTML ni el JS.

## Correrlo en local

Como `index.html` carga `data/daily.json` con `fetch`, no puedes abrirlo con doble clic (bloqueo CORS de `file://`). Sirve la carpeta con cualquier servidor estático:

```bash
cd multicamiones-dashboard
python3 -m http.server 8080
```

Y visita `http://localhost:8080`.

## Publicar en GitHub Pages

### 1. Conectar el repo a GitHub

```bash
cd multicamiones-dashboard
git init
git add .
git commit -m "Dashboard inicial de rendimiento Multicamiones"
```

Crea un repositorio vacío en GitHub (sin README, sin .gitignore — ya los tienes), por ejemplo `multicamiones-dashboard`, y luego:

```bash
git remote add origin https://github.com/<tu-usuario>/multicamiones-dashboard.git
git branch -M main
git push -u origin main
```

### 2. Activar GitHub Pages

En GitHub: **Settings → Pages → Build and deployment → Source: "Deploy from a branch"**, rama `main`, carpeta `/ (root)`. Guarda. En 1-2 minutos el sitio queda publicado en:

```
https://<tu-usuario>.github.io/multicamiones-dashboard/
```

Cualquier `git push` a `main` después de esto actualiza el sitio automáticamente.

## Automatización con la API de Meta Marketing (opcional)

Ya está preparado un workflow (`.github/workflows/update-meta-data.yml`) que puede correr todos los días, jalar el "Resultado" de cada campaña vía la API de Meta y hacer commit de `data/daily.json`. **Está desactivado por defecto** (solo corre manualmente vía "Run workflow" en la pestaña Actions) hasta que actives estos dos pasos:

1. **Secret del token de acceso.** En `Settings → Secrets and variables → Actions → New repository secret`, crea `META_ACCESS_TOKEN` con un token de sistema/usuario de Meta con permiso `ads_read` sobre la cuenta `635475068426730`.
2. **Mapeo de campañas.** Edita [.github/meta-campaign-map.json](.github/meta-campaign-map.json) y reemplaza cada `REEMPLAZAR_CAMPAIGN_ID_...` con el ID numérico real de la campaña en Meta Ads (lo ves en la URL de Ads Manager o vía `GET /act_635475068426730/campaigns`).
3. Descomenta el bloque `schedule:` en el workflow (ya trae un cron diario sugerido a las 09:00 UTC).

El script (`.github/scripts/update_daily_data.py`) usa el campo `results` de la Insights API — el mismo número que ves en la columna "Resultados" de Ads Manager, calculado automáticamente según el objetivo de cada campaña — así que no hace falta mapear tipos de acción a mano.

Mientras tanto, el dashboard sigue funcionando perfectamente con los datos estáticos de julio 2026 en `data/daily.json`.
