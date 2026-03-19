# CLAUDE.md — Nutri Tracker

Guía de contexto para agentes de IA trabajando en este proyecto.

## Qué es este proyecto

App personal de seguimiento nutricional de Diego Vacarezza. Permite registrar comidas y macros por día y visualizar progreso diario, semanal y mensual.

## Stack

- **Framework:** Next.js 14 (Pages Router, sin App Router)
- **Backend:** Supabase Edge Function `nutrition` en `https://uxcvmliojhsmjtopcsig.supabase.co/functions/v1/nutrition`
- **Deploy:** Vercel (root directory: `nutri-app/`)
- **Gráficos:** SVG inline puro, sin Chart.js ni recharts

## Archivos clave

| Archivo | Descripción |
|---------|-------------|
| `nutri-app/pages/index.js` | Toda la UI: tabs Hoy / Semana / Mes, componentes SVG, lógica de datos |
| `nutri-app/pages/api/sync.js` | Endpoint auxiliar, sólo maneja CORS |
| `nutri-app/pages/_app.js` | Global styles y meta tags |

## Estructura de datos

La Edge Function devuelve:
```json
{
  "meals": [
    {
      "date": "2026-03-19",
      "meal": "desayuno",
      "food": "Avena con frutas",
      "calories": 380,
      "protein": 12,
      "carbs": 65,
      "fat": 8,
      "fiber": 6
    }
  ],
  "goals": {
    "calories": 2200,
    "protein": 170,
    "carbs": 220,
    "fat": 70,
    "fiber": 30
  }
}
```

### Campo `meal` — valores válidos
`desayuno` | `postEntreno` | `almuerzo` | `merienda` | `cena` | `colaciones`

## Constantes importantes

- `MEALS` — array con key, label, icon y color de cada comida
- `MACROS` — array con key, label, unit, color, goalKey y heatColors
- `DEFAULT_GOALS` — objetivos por defecto si la API no devuelve goals
- `SUPABASE_FN` — URL de la Edge Function

## Convenciones de código

- Todo en un solo archivo (`index.js`) para simplificar el deploy
- Estilos inline (sin CSS modules ni Tailwind)
- Componentes SVG: `LineChart` (tab semana), `WeekBarChart` (tab mes)
- Helpers puros: `buildDayMap`, `getDayTotals`, `getWeekBuckets`, `getWeekDayAvg`, `getMealMonthAvgs`
- Fechas siempre en formato `YYYY-MM-DD`

## Comandos útiles

```bash
cd nutri-app
npm install       # instalar dependencias
npm run dev       # desarrollo en localhost:3000
npm run build     # build de producción
npm run lint      # linting ESLint
```

## Deploy

El repo está vinculado a Vercel. Cualquier push a `main` dispara un deploy automático.
El root directory en Vercel debe apuntar a `nutri-app/`.
