# 🥗 Nutri Tracker

App personal de seguimiento nutricional. Registrá tus comidas y macros diariamente, visualizá tendencias semanales y revisá tu evolución mensual.

---

## Funcionalidades

### 📅 Tab Hoy
- Selector de los últimos 7 días
- Anillos de progreso por macro (Calorías, Proteínas, Carbos, Grasas, Fibra) vs objetivo
- Cards por comida: Desayuno, Post-Entreno, Almuerzo, Merienda, Cena, Colaciones
- Detalle de macros por comida cargada

### 📈 Tab Semana
- Gráficos de línea para cada macro con promedio, desvío vs objetivo y tendencia
- Tabla resumen con los 7 días anteriores (clic en fila para ir al día)

### 📊 Tab Mes
- Cards de promedio mensual por macro
- Gráficos de barras semanales (Sem 1–5): promedio diario por semana vs objetivo
- Tabla de promedio mensual desglosado **por comida** (calorías + 4 macros + fibra)

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | [Next.js 14](https://nextjs.org/) (Pages Router) |
| Backend / datos | [Supabase Edge Functions](https://supabase.com/docs/guides/functions) |
| Deploy | [Vercel](https://vercel.com/) |
| Gráficos | SVG inline (sin librerías externas) |

---

## Arquitectura

```
nutri-tracker/
└── nutri-app/              # App Next.js
    ├── pages/
    │   ├── index.js        # UI completa (3 tabs: Hoy, Semana, Mes)
    │   └── api/
    │       └── sync.js     # Endpoint auxiliar (CORS handler)
    ├── public/             # Assets estáticos
    ├── next.config.js
    ├── vercel.json
    └── package.json
```

**Flujo de datos:**
```
Claude (artifact) → Supabase Edge Function (nutrition)
                           ↓
                   Nutri Tracker (fetch cada 30s)
```

Los datos se guardan vía una **Supabase Edge Function** llamada `nutrition`. La app consulta ese endpoint y actualiza el estado automáticamente cada 30 segundos.

---

## Setup local

```bash
# 1. Clonar repo
git clone https://github.com/vacarezzad/nutri-tracker.git
cd nutri-tracker/nutri-app

# 2. Instalar dependencias
npm install

# 3. Correr en desarrollo
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000).

> **Nota:** La app consume datos reales desde Supabase. Sin datos cargados, los tabs mostrarán valores vacíos/cero.

---

## Deploy en Vercel

El proyecto está configurado para deploy automático desde este repo.

- **Root directory:** `nutri-app`
- **Framework:** Next.js (auto-detectado)
- **Build command:** `next build`
- **Output directory:** `.next`

---

## Objetivos nutricionales por defecto

| Macro | Objetivo |
|-------|---------|
| Calorías | 2200 kcal |
| Proteínas | 170 g |
| Carbohidratos | 220 g |
| Grasas | 70 g |
| Fibra | 30 g |

Los objetivos se sobreescriben dinámicamente si la Edge Function devuelve un objeto `goals`.

---

## Comidas soportadas

`desayuno` · `postEntreno` · `almuerzo` · `merienda` · `cena` · `colaciones`
