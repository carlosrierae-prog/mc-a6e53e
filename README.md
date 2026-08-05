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

## Publicar en GitHub Pages (link no listado)

Este repo lleva un nombre no adivinable a propósito (`mc-a6e53e`) y el sitio trae `noindex`/`robots.txt` para que no aparezca en buscadores. **Nota real:** al ser un repo público (plan gratuito), sí queda visible en tu perfil de GitHub para quien lo navegue directamente — el nombre obscuro evita que lo encuentren por Google o por casualidad, no es una restricción de acceso real. Si más adelante quieres cerrarlo de verdad (repo privado + Pages), hace falta GitHub Pro.

### 1. Crea el repositorio vacío en GitHub

En [github.com/new](https://github.com/new):
- Nombre: `mc-a6e53e`
- Visibilidad: **Public** (necesario para Pages en el plan gratuito)
- No marques "Add a README", ni .gitignore, ni licencia — ya los tienes en el proyecto.

### 2. Conecta y sube el repo local

```bash
cd multicamiones-dashboard
git add .
git commit -m "Preparar dashboard: datos hasta agosto, detalle de anuncios, branding, privacidad"
git remote add origin https://github.com/<tu-usuario>/mc-a6e53e.git
git branch -M main
git push -u origin main
```

### 3. Activa GitHub Pages

En GitHub: **Settings → Pages → Build and deployment → Source: "Deploy from a branch"**, rama `main`, carpeta `/ (root)`. Guarda. En 1-2 minutos el sitio queda publicado en:

```
https://<tu-usuario>.github.io/mc-a6e53e/
```

Ese es el link que compartes con tu cliente si hace falta — evita compartirlo por canales públicos o indexables.

Cualquier `git push` a `main` después de esto actualiza el sitio automáticamente.

## Automatización diaria con la API de Meta Marketing

Ya está preparado un workflow (`.github/workflows/update-meta-data.yml`) que corre todos los días, jala el "Resultado" de ayer por campaña vía la API de Meta y hace commit de `data/daily.json` — así el dashboard siempre muestra hasta el día anterior, con el desfase de 1 día esperado. **Está desactivado por defecto** (solo corre manualmente vía "Run workflow" en la pestaña Actions) hasta que actives esto:

1. **Secret del token de acceso.** En `Settings → Secrets and variables → Actions → New repository secret`, crea `META_ACCESS_TOKEN` con un token de sistema/usuario de Meta con permiso `ads_read` sobre la cuenta `635475068426730`. Pasos para generarlo:
   - En [Business Settings](https://business.facebook.com/settings) → Usuarios → Usuarios del sistema → crea uno (o usa uno existente) con acceso a la cuenta de anuncios `635475068426730`.
   - Genera un token de larga duración con el permiso `ads_read`.
   - Cópialo como el secret `META_ACCESS_TOKEN` en GitHub (nunca lo pegues en el código ni en un commit).
2. Descomenta el bloque `schedule:` en el workflow (ya trae un cron diario sugerido a las 09:00 UTC).

El mapeo de campañas (`.github/meta-campaign-map.json`) ya tiene los IDs reales de las 5 campañas, confirmados contra la cuenta. El script (`.github/scripts/update_daily_data.py`) usa el campo `results` de la Insights API para 4 de las 5 campañas — el mismo número que ves en la columna "Resultados" de Ads Manager. Para **Freightliner**, que está optimizada para compra dentro del chat (no para inicio de conversación), el script pide el campo `actions` completo y toma el conteo exacto de `onsite_conversion.messaging_conversation_started_7d`, para que siga mostrando conversaciones iniciadas y no compras.

`data/ads.json` (el detalle de anuncios activos por campaña) no se refresca automáticamente todavía — es una foto manual tomada el 2026-08-05. Si quieres que también se actualice solo, se puede sumar al mismo workflow más adelante.

Mientras tanto, el dashboard sigue funcionando perfectamente con los datos ya cargados en `data/daily.json`.
