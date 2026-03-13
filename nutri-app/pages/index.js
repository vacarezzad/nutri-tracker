import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'

const MEALS = [
  { key: 'desayuno',    label: 'Desayuno',     icon: '🌅', color: '#E24B4A' },
  { key: 'postEntreno', label: 'Post-Entreno',  icon: '💪', color: '#EF9F27' },
  { key: 'almuerzo',    label: 'Almuerzo',      icon: '🍽',  color: '#378ADD' },
  { key: 'merienda',    label: 'Merienda',      icon: '🍎', color: '#7F77DD' },
  { key: 'cena',        label: 'Cena',          icon: '🌙', color: '#1D9E75' },
  { key: 'colaciones',  label: 'Colaciones',    icon: '🥜', color: '#EF9F27' },
]

const MACROS = [
  { key: 'calories', label: 'Calorías',      unit: 'kcal', color: '#E24B4A', goalKey: 'calories', heatColors: ['#FCEBEB','#F7C1C1','#F09595','#E24B4A','#A32D2D'] },
  { key: 'protein',  label: 'Proteínas',     unit: 'g',    color: '#378ADD', goalKey: 'protein',  heatColors: ['#E6F1FB','#B5D4F4','#85B7EB','#378ADD','#0C447C'] },
  { key: 'carbs',    label: 'Carbohidratos', unit: 'g',    color: '#EF9F27', goalKey: 'carbs',    heatColors: ['#FAEEDA','#FAC775','#EF9F27','#BA7517','#633806'] },
  { key: 'fat',      label: 'Grasas',        unit: 'g',    color: '#7F77DD', goalKey: 'fat',      heatColors: ['#EEEDFE','#CECBF6','#AFA9EC','#7F77DD','#3C3489'] },
]

const DEFAULT_GOALS = { calories: 2200, protein: 170, carbs: 220, fat: 70, fiber: 30 }
const STORAGE_KEY = 'nutri-db'
const STORAGE_URL = 'https://claude.ai' // placeholder, data fetched via postMessage

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function getLast(n, from) {
  const base = from ? new Date(from + 'T12:00:00') : new Date()
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(base)
    d.setDate(d.getDate() - (n - 1 - i))
    return d.toISOString().split('T')[0]
  })
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function fmtShort(str) {
  const [, m, d] = str.split('-')
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  return `${parseInt(d)} ${months[parseInt(m)-1]}`
}

function getDayTotals(meals, date) {
  const dm = meals[date] || {}
  return MACROS.reduce((acc, m) => {
    acc[m.key] = MEALS.reduce((s, meal) => s + (dm[meal.key]?.[m.key] || 0), 0)
    return acc
  }, { fiber: MEALS.reduce((s, meal) => s + (dm[meal.key]?.fiber || 0), 0) })
}

function heatColor(value, goal, colors) {
  if (!value || value === 0) return '#f0f0f0'
  const ratio = value / goal
  if (ratio < 0.5)  return colors[0]
  if (ratio < 0.75) return colors[1]
  if (ratio < 0.9)  return colors[2]
  if (ratio < 1.1)  return colors[3]
  return colors[4]
}

// ── LINE CHART (SVG) ─────────────────────────────────────────────────────────
function LineChart({ data, goal, color, unit }) {
  const W = 300, H = 80, PAD = 6
  const vals = data.map(d => d.value)
  const max = Math.max(...vals, goal * 1.15)
  const min = 0
  const range = max - min || 1

  const toY = v => PAD + (H - PAD * 2) * (1 - (v - min) / range)
  const toX = i => (i / (data.length - 1)) * W

  const pts = data.map((d, i) => `${toX(i)},${toY(d.value)}`).join(' ')
  const areaPath = `M${toX(0)},${toY(data[0].value)} ` +
    data.slice(1).map((d, i) => `L${toX(i+1)},${toY(d.value)}`).join(' ') +
    ` L${toX(data.length-1)},${H} L${toX(0)},${H} Z`

  const avg = vals.filter(v => v > 0).reduce((a, b) => a + b, 0) / (vals.filter(v => v > 0).length || 1)
  const avgY = toY(avg)
  const goalY = toY(goal)

  const dayLabels = ['L','M','X','J','V','S','D']

  return (
    <svg viewBox={`0 0 ${W} ${H + 18}`} style={{ width: '100%', overflow: 'visible' }}>
      {/* Goal line */}
      <line x1={0} y1={goalY} x2={W} y2={goalY} stroke={color} strokeWidth={0.8} strokeDasharray="5,4" opacity={0.35} />
      <text x={W - 2} y={goalY - 2} textAnchor="end" fontSize={7} fill={color} opacity={0.5}>obj</text>
      {/* Area */}
      <path d={areaPath} fill={color} opacity={0.07} />
      {/* Line */}
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {/* Avg line */}
      <line x1={0} y1={avgY} x2={W} y2={avgY} stroke={color} strokeWidth={1} strokeDasharray="8,4" opacity={0.55} />
      {/* Dots */}
      {data.map((d, i) => {
        const x = toX(i), y = toY(d.value)
        const isToday = i === data.length - 1
        return d.value > 0 ? (
          <g key={i}>
            {isToday
              ? <><circle cx={x} cy={y} r={5} fill="white" stroke={color} strokeWidth={2} /><circle cx={x} cy={y} r={2} fill={color} /></>
              : <circle cx={x} cy={y} r={3} fill={color} />
            }
          </g>
        ) : null
      })}
      {/* Day labels */}
      {data.map((d, i) => (
        <text key={i} x={toX(i)} y={H + 14} textAnchor="middle" fontSize={8}
          fill={i === data.length - 1 ? color : '#999'}
          fontWeight={i === data.length - 1 ? '600' : '400'}>
          {dayLabels[new Date(d.date + 'T12:00:00').getDay()] ?? ''}
        </text>
      ))}
    </svg>
  )
}

// ── HEATMAP ──────────────────────────────────────────────────────────────────
function Heatmap({ macro, meals, goals, year, month }) {
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = new Date(year, month, 1).getDay()
  const offset = firstDay === 0 ? 6 : firstDay - 1 // Monday start
  const today = todayStr()
  const goal = goals[macro.goalKey] || DEFAULT_GOALS[macro.goalKey]

  const cells = []
  for (let i = 0; i < offset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    const totals = getDayTotals(meals, dateStr)
    cells.push({ day: d, date: dateStr, value: totals[macro.key] || 0 })
  }

  const dayNames = ['L','M','X','J','V','S','D']

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '2px', marginBottom: '4px' }}>
        {dayNames.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: '9px', color: '#999', fontWeight: '500' }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '2px' }}>
        {cells.map((cell, i) => {
          if (!cell) return <div key={i} style={{ height: '18px' }} />
          const bg = heatColor(cell.value, goal, macro.heatColors)
          const isToday = cell.date === today
          const isFuture = cell.date > today
          return (
            <div
              key={i}
              title={`${fmtShort(cell.date)}: ${Math.round(cell.value)}${macro.unit}`}
              style={{
                height: '18px',
                borderRadius: '3px',
                background: isFuture ? '#f5f5f5' : bg,
                opacity: isFuture ? 0.3 : 1,
                outline: isToday ? `2px solid ${macro.color}` : 'none',
                outlineOffset: '1px',
                cursor: 'default',
                transition: 'opacity 0.15s',
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

// ── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function Home() {
  const [db, setDb] = useState({ meals: {}, goals: DEFAULT_GOALS })
  const [tab, setTab] = useState('hoy')
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [loaded, setLoaded] = useState(false)
  const [monthOffset, setMonthOffset] = useState(0)

  // Load from localStorage (populated by Claude artifact via postMessage or manual entry)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setDb(JSON.parse(raw))
    } catch (e) {}
    setLoaded(true)

    // Listen for data from Claude artifact
    const handler = (e) => {
      if (e.data && e.data.type === 'NUTRI_UPDATE') {
        try {
          const updated = JSON.parse(e.data.payload)
          setDb(updated)
          localStorage.setItem(STORAGE_KEY, e.data.payload)
        } catch {}
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  const today = todayStr()
  const dayMeals = db.meals[selectedDate] || {}
  const goals = db.goals || DEFAULT_GOALS
  const totals = getDayTotals(db.meals, selectedDate)

  // Weekly data for line charts
  const last7 = getLast(7)
  const weekData = MACROS.map(m => ({
    ...m,
    series: last7.map(date => ({ date, value: getDayTotals(db.meals, date)[m.key] || 0 })),
    avg: (() => {
      const vals = last7.map(d => getDayTotals(db.meals, d)[m.key] || 0).filter(v => v > 0)
      return vals.length ? Math.round(vals.reduce((a,b) => a+b,0) / vals.length) : 0
    })(),
    goal: goals[m.goalKey] || DEFAULT_GOALS[m.goalKey],
  }))

  // Month for heatmap
  const now = new Date()
  const heatYear = now.getFullYear()
  const heatMonth = (now.getMonth() + monthOffset + 12) % 12
  const heatYearAdj = now.getFullYear() + Math.floor((now.getMonth() + monthOffset) / 12)
  const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

  // Monthly averages
  const daysInHeatMonth = getDaysInMonth(heatYearAdj, heatMonth)
  const monthAvgs = MACROS.map(m => {
    const vals = Array.from({ length: daysInHeatMonth }, (_, i) => {
      const d = `${heatYearAdj}-${String(heatMonth+1).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`
      return getDayTotals(db.meals, d)[m.key] || 0
    }).filter(v => v > 0)
    return { ...m, avg: vals.length ? Math.round(vals.reduce((a,b)=>a+b,0)/vals.length) : 0 }
  })

  if (!loaded) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f1a', fontFamily: 'system-ui' }}>
      <div style={{ textAlign: 'center', color: 'white' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>🥗</div>
        <div style={{ opacity: 0.6 }}>Cargando...</div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fc', fontFamily: "'Inter', system-ui, sans-serif", color: '#1a1a2e' }}>
      <Head>
        <title>Nutri Tracker</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
      </Head>

      {/* HEADER */}
      <div style={{ background: '#1a1a2e', color: 'white', padding: '20px 24px 0' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <div style={{ fontSize: '20px', fontWeight: '600', letterSpacing: '-0.3px' }}>🥗 Nutri Tracker</div>
              <div style={{ fontSize: '12px', opacity: 0.5, marginTop: '2px' }}>
                {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {[
              { id: 'hoy', label: 'Hoy' },
              { id: 'semana', label: 'Semana' },
              { id: 'mes', label: 'Mes' },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: '10px 20px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: '13px', fontWeight: '500', borderRadius: '8px 8px 0 0',
                background: tab === t.id ? '#f8f9fc' : 'transparent',
                color: tab === t.id ? '#1a1a2e' : 'rgba(255,255,255,0.55)',
                transition: 'all 0.15s',
              }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '20px 16px 40px' }}>

        {/* ══ TAB HOY ══ */}
        {tab === 'hoy' && (
          <>
            {/* Date selector */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
              {getLast(7).map(d => {
                const dt = new Date(d + 'T12:00:00')
                const dayN = ['D','L','M','X','J','V','S'][dt.getDay()]
                const isSelected = d === selectedDate
                const hasMeals = Object.keys(db.meals[d] || {}).length > 0
                return (
                  <button key={d} onClick={() => setSelectedDate(d)} style={{
                    padding: '7px 12px', borderRadius: '20px', border: `1.5px solid ${isSelected ? '#1a1a2e' : '#e0e0e0'}`,
                    background: isSelected ? '#1a1a2e' : 'white', color: isSelected ? 'white' : '#666',
                    cursor: 'pointer', fontSize: '12px', fontWeight: '500', fontFamily: 'inherit',
                    position: 'relative',
                  }}>
                    {d === today ? 'Hoy' : `${dayN} ${fmtShort(d)}`}
                    {hasMeals && <span style={{ position: 'absolute', top: '3px', right: '3px', width: '5px', height: '5px', borderRadius: '50%', background: '#1D9E75' }} />}
                  </button>
                )
              })}
            </div>

            {/* Macro rings */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: '8px', marginBottom: '16px' }}>
              {MACROS.map(m => {
                const val = totals[m.key] || 0
                const goal = goals[m.goalKey] || DEFAULT_GOALS[m.goalKey]
                const pct = goal ? Math.min(Math.round((val / goal) * 100), 100) : 0
                const r = 26, circ = 2 * Math.PI * r
                const dash = (pct / 100) * circ
                return (
                  <div key={m.key} style={{ background: 'white', border: '0.5px solid #e8e8e8', borderRadius: '12px', padding: '12px 8px', textAlign: 'center' }}>
                    <svg width="68" height="68" viewBox="0 0 68 68" style={{ margin: '0 auto', display: 'block' }}>
                      <circle cx="34" cy="34" r={r} fill="none" stroke="#f0f0f0" strokeWidth="7" />
                      <circle cx="34" cy="34" r={r} fill="none" stroke={m.color} strokeWidth="7"
                        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
                        transform="rotate(-90 34 34)" style={{ transition: 'stroke-dasharray 0.8s ease' }} />
                      <text x="34" y="30" textAnchor="middle" fontSize="11" fontWeight="600" fill="#1a1a2e">{Math.round(val)}</text>
                      <text x="34" y="42" textAnchor="middle" fontSize="8" fill="#999">{m.unit}</text>
                    </svg>
                    <div style={{ fontSize: '10px', fontWeight: '600', color: '#555', marginTop: '4px' }}>{m.label}</div>
                    <div style={{ fontSize: '9px', color: m.color, marginTop: '2px' }}>{pct}% de {goal}{m.unit}</div>
                  </div>
                )
              })}
            </div>

            {/* Meals grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px,1fr))', gap: '10px' }}>
              {MEALS.map(meal => {
                const data = dayMeals[meal.key]
                return (
                  <div key={meal.key} style={{
                    background: 'white', borderRadius: '12px',
                    border: `0.5px solid ${data ? meal.color + '40' : '#e8e8e8'}`,
                    borderLeft: `3px solid ${data ? meal.color : '#e8e8e8'}`,
                    padding: '14px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: data ? meal.color + '18' : '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>
                        {meal.icon}
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#1a1a2e' }}>{meal.label}</div>
                        <div style={{ fontSize: '11px', color: data ? meal.color : '#bbb', fontWeight: '500' }}>
                          {data ? `${Math.round(data.calories)} kcal` : 'Sin cargar'}
                        </div>
                      </div>
                    </div>
                    {data ? (
                      <>
                        <div style={{ fontSize: '11px', color: '#888', fontStyle: 'italic', marginBottom: '8px', lineHeight: '1.4' }}>{data.food}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '4px' }}>
                          {[
                            { l: 'Prot', v: data.protein, c: '#378ADD' },
                            { l: 'Carbs', v: data.carbs, c: '#EF9F27' },
                            { l: 'Grasas', v: data.fat, c: '#7F77DD' },
                            { l: 'Fibra', v: data.fiber, c: '#1D9E75' },
                          ].map(mac => (
                            <div key={mac.l} style={{ background: mac.c + '12', borderRadius: '6px', padding: '4px 2px', textAlign: 'center' }}>
                              <div style={{ fontSize: '11px', fontWeight: '600', color: mac.c }}>{Math.round(mac.v)}g</div>
                              <div style={{ fontSize: '8px', color: '#999' }}>{mac.l}</div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: '11px', color: '#ccc', fontStyle: 'italic' }}>Todavía no cargaste esta comida</div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* ══ TAB SEMANA ══ */}
        {tab === 'semana' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: '12px' }}>
              {weekData.map(m => {
                const dev = m.avg - m.goal
                const devStr = dev === 0 ? '±0' : dev > 0 ? `+${Math.round(dev)}` : `${Math.round(dev)}`
                const devColor = Math.abs(dev) < m.goal * 0.1 ? '#1D9E75' : m.color
                return (
                  <div key={m.key} style={{ background: 'white', borderRadius: '14px', border: '0.5px solid #e8e8e8', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2px' }}>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: '#555' }}>{m.label}</div>
                      <div style={{ fontSize: '10px', color: '#bbb' }}>Obj: <span style={{ color: m.color, fontWeight: '600' }}>{m.goal}{m.unit}</span></div>
                    </div>
                    <div style={{ fontSize: '22px', fontWeight: '600', color: m.color, marginBottom: '2px' }}>
                      {m.avg} <span style={{ fontSize: '11px', fontWeight: '400', color: '#aaa' }}>{m.unit} prom.</span>
                    </div>
                    <div style={{ fontSize: '11px', color: devColor, marginBottom: '10px' }}>
                      Desvío: <strong>{devStr}{m.unit}</strong> vs objetivo
                    </div>
                    <LineChart data={m.series} goal={m.goal} color={m.color} unit={m.unit} />
                    <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                      {[
                        { dash: 'none', label: 'Real' },
                        { dash: '8px 4px', label: 'Promedio' },
                        { dash: '4px 4px', label: 'Objetivo', op: 0.4 },
                      ].map(l => (
                        <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <div style={{ width: '14px', height: '0', borderTop: `1.5px ${l.dash === 'none' ? 'solid' : 'dashed'} ${m.color}`, opacity: l.op || 1 }} />
                          <span style={{ fontSize: '9px', color: '#aaa' }}>{l.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Weekly summary table */}
            <div style={{ background: 'white', borderRadius: '14px', border: '0.5px solid #e8e8e8', padding: '16px', marginTop: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#555', marginBottom: '12px' }}>Resumen diario</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ borderBottom: '0.5px solid #e8e8e8' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: '600', color: '#888', fontSize: '11px' }}>Día</th>
                      {MACROS.map(m => <th key={m.key} style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '600', color: m.color, fontSize: '11px' }}>{m.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {last7.map((d, i) => {
                      const dt = getDayTotals(db.meals, d)
                      const isToday = d === today
                      const dayN = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][new Date(d+'T12:00:00').getDay()]
                      return (
                        <tr key={d} style={{ background: isToday ? '#f0f4ff' : i % 2 === 0 ? 'white' : '#fafafa', cursor: 'pointer' }}
                          onClick={() => { setSelectedDate(d); setTab('hoy') }}>
                          <td style={{ padding: '8px 10px', fontWeight: isToday ? '600' : '400', color: isToday ? '#1a1a2e' : '#555' }}>
                            {dayN} {fmtShort(d)} {isToday ? '←' : ''}
                          </td>
                          {MACROS.map(m => {
                            const v = dt[m.key] || 0
                            const goal = goals[m.goalKey] || DEFAULT_GOALS[m.goalKey]
                            const ok = v >= goal * 0.9
                            return (
                              <td key={m.key} style={{ padding: '8px 10px', textAlign: 'center', color: v > 0 ? (ok ? '#1D9E75' : m.color) : '#ddd', fontWeight: v > 0 ? '500' : '400' }}>
                                {v > 0 ? `${Math.round(v)}${m.unit}` : '—'}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ══ TAB MES ══ */}
        {tab === 'mes' && (
          <>
            {/* Month nav */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <button onClick={() => setMonthOffset(o => o - 1)} style={{ padding: '6px 14px', border: '0.5px solid #e0e0e0', borderRadius: '8px', background: 'white', cursor: 'pointer', fontSize: '14px', fontFamily: 'inherit' }}>‹</button>
              <div style={{ fontSize: '15px', fontWeight: '600', color: '#1a1a2e' }}>{monthNames[heatMonth]} {heatYearAdj}</div>
              <button onClick={() => setMonthOffset(o => Math.min(o + 1, 0))} style={{ padding: '6px 14px', border: '0.5px solid #e0e0e0', borderRadius: '8px', background: 'white', cursor: 'pointer', fontSize: '14px', fontFamily: 'inherit' }}>›</button>
            </div>

            {/* Monthly averages summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: '8px', marginBottom: '16px' }}>
              {monthAvgs.map(m => {
                const goal = goals[m.goalKey] || DEFAULT_GOALS[m.goalKey]
                const dev = m.avg - goal
                const devStr = m.avg === 0 ? 'Sin datos' : dev >= 0 ? `+${Math.round(dev)}` : `${Math.round(dev)}`
                return (
                  <div key={m.key} style={{ background: 'white', borderRadius: '12px', border: '0.5px solid #e8e8e8', padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '4px' }}>Prom. mensual</div>
                    <div style={{ fontSize: '11px', fontWeight: '600', color: m.color, marginBottom: '2px' }}>{m.label}</div>
                    <div style={{ fontSize: '20px', fontWeight: '600', color: '#1a1a2e' }}>{m.avg || '—'}</div>
                    <div style={{ fontSize: '9px', color: '#aaa' }}>{m.unit}</div>
                    {m.avg > 0 && <div style={{ fontSize: '10px', color: Math.abs(dev) < goal * 0.1 ? '#1D9E75' : m.color, marginTop: '4px', fontWeight: '500' }}>{devStr}{m.unit} vs obj</div>}
                  </div>
                )
              })}
            </div>

            {/* Heatmap legend */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '10px', color: '#aaa' }}>Bajo</span>
              {[0,1,2,3,4].map(i => <div key={i} style={{ width: '14px', height: '14px', borderRadius: '3px', background: MACROS[0].heatColors[i] }} />)}
              <span style={{ fontSize: '10px', color: '#aaa' }}>≥ Objetivo</span>
            </div>

            {/* 4 heatmaps */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: '12px' }}>
              {MACROS.map(m => {
                const goal = goals[m.goalKey] || DEFAULT_GOALS[m.goalKey]
                const avg = monthAvgs.find(x => x.key === m.key)?.avg || 0
                return (
                  <div key={m.key} style={{ background: 'white', borderRadius: '14px', border: '0.5px solid #e8e8e8', padding: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: m.color }}>{m.label}</div>
                      <div style={{ fontSize: '10px', color: '#aaa' }}>
                        Prom: <span style={{ color: m.color, fontWeight: '600' }}>{avg || '—'}{m.unit}</span>
                        {avg > 0 && <span style={{ marginLeft: '6px', color: '#bbb' }}>/ obj {goal}{m.unit}</span>}
                      </div>
                    </div>
                    <Heatmap macro={m} meals={db.meals} goals={goals} year={heatYearAdj} month={heatMonth} />
                    <div style={{ fontSize: '9px', color: '#bbb', marginTop: '6px' }}>
                      Más oscuro = más cerca del objetivo · borde = hoy
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
