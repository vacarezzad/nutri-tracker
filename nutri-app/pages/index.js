import { useState, useEffect } from 'react'
import Head from 'next/head'

const SUPABASE_FN = 'https://uxcvmliojhsmjtopcsig.supabase.co/functions/v1/nutrition'

const MEALS = [
  { key: 'desayuno',    label: 'Desayuno',     icon: '🌅', color: '#E24B4A' },
  { key: 'postEntreno', label: 'Post-Entreno',  icon: '💪', color: '#EF9F27' },
  { key: 'almuerzo',    label: 'Almuerzo',      icon: '🍽',  color: '#378ADD' },
  { key: 'merienda',    label: 'Merienda',      icon: '🍎', color: '#7F77DD' },
  { key: 'cena',        label: 'Cena',          icon: '🌙', color: '#1D9E75' },
  { key: 'colaciones',  label: 'Colaciones',    icon: '🥜', color: '#EF9F27' },
]

const MACROS = [
  { key: 'calories', label: 'Calorías',  unit: 'kcal', color: '#E24B4A', goalKey: 'calories', heatColors: ['#FCEBEB','#F7C1C1','#F09595','#E24B4A','#A32D2D'] },
  { key: 'protein',  label: 'Proteínas', unit: 'g',    color: '#378ADD', goalKey: 'protein',  heatColors: ['#E6F1FB','#B5D4F4','#85B7EB','#378ADD','#0C447C'] },
  { key: 'carbs',    label: 'Carbos',    unit: 'g',    color: '#EF9F27', goalKey: 'carbs',    heatColors: ['#FAEEDA','#FAC775','#EF9F27','#BA7517','#633806'] },
  { key: 'fat',      label: 'Grasas',    unit: 'g',    color: '#7F77DD', goalKey: 'fat',      heatColors: ['#EEEDFE','#CECBF6','#AFA9EC','#7F77DD','#3C3489'] },
  { key: 'fiber',    label: 'Fibra',     unit: 'g',    color: '#1D9E75', goalKey: 'fiber',    heatColors: ['#E1F5EE','#9FE1CB','#5DCAA5','#1D9E75','#085041'] },
]

// type: 'max' = no pasar de X | 'min' = llegar a X | 'target' = apuntar a X
const MICROS = [
  { key: 'sodium',    label: 'Sodio',       unit: 'mg', color: '#F97316', goal: 2300, type: 'max'    },
  { key: 'potassium', label: 'Potasio',     unit: 'mg', color: '#8B5CF6', goal: 3500, type: 'min'    },
  { key: 'sugar',     label: 'Azúcares',    unit: 'g',  color: '#EC4899', goal: 50,   type: 'max'    },
  { key: 'sat_fat',   label: 'G. Saturadas',unit: 'g',  color: '#DC2626', goal: 22,   type: 'max'    },
  { key: 'mono_fat',  label: 'G. Mono.',    unit: 'g',  color: '#059669', goal: 30,   type: 'target' },
  { key: 'poly_fat',  label: 'G. Poli.',    unit: 'g',  color: '#0284C7', goal: 15,   type: 'target' },
]

const DEFAULT_GOALS = { calories: 2200, protein: 170, carbs: 220, fat: 70, fiber: 30 }
const DAY_NAMES_LONG = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function todayStr() { return new Date().toISOString().split('T')[0] }
function getLast7() {
  return Array.from({length:7},(_,i)=>{ const d=new Date(); d.setDate(d.getDate()-(6-i)); return d.toISOString().split('T')[0] })
}
function getDaysInMonth(y,m) { return new Date(y,m+1,0).getDate() }
function fmtShort(str) {
  const [,m,d]=str.split('-')
  return `${parseInt(d)} ${['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][parseInt(m)-1]}`
}
function buildDayMap(meals) {
  const map={}
  ;(meals||[]).forEach(m=>{ if(!map[m.date])map[m.date]={}; map[m.date][m.meal]=m })
  return map
}
function getDayTotals(dayMap,date) {
  const dm=dayMap[date]||{}
  return MACROS.reduce((acc,m)=>{ acc[m.key]=MEALS.reduce((s,meal)=>s+(Number(dm[meal.key]?.[m.key])||0),0); return acc },{})
}
function getDayMicroTotals(dayMap,date) {
  const dm=dayMap[date]||{}
  return MICROS.reduce((acc,m)=>{ acc[m.key]=MEALS.reduce((s,meal)=>s+(Number(dm[meal.key]?.[m.key])||0),0); return acc },{})
}
function microStatusColor(value,goal,type) {
  if(!value)return'#ccc'
  const r=value/goal
  if(type==='max'){
    if(r<0.75)return'#1D9E75'
    if(r<0.9) return'#EF9F27'
    if(r<1.0) return'#F97316'
    return'#E24B4A'
  }
  if(type==='min'){
    if(r>=0.9) return'#1D9E75'
    if(r>=0.75)return'#EF9F27'
    return'#E24B4A'
  }
  // target
  if(r>=0.9&&r<=1.1)return'#1D9E75'
  if(r>=0.75&&r<=1.25)return'#EF9F27'
  return'#E24B4A'
}
function heatColor(value,goal,colors) {
  if(!value)return'#f5f5f5'
  const r=value/goal
  if(r<0.5)return colors[0]; if(r<0.75)return colors[1]; if(r<0.9)return colors[2]; if(r<1.1)return colors[3]; return colors[4]
}
function getWeekBuckets(year,month) {
  const dim=getDaysInMonth(year,month),weeks=[]
  let s=1
  while(s<=dim){ const e=Math.min(s+6,dim); weeks.push({label:`Sem ${weeks.length+1}`,start:s,end:e}); s+=7 }
  return weeks
}
function getWeekDayAvg(dayMap,year,month,start,end,macroKey) {
  const vals=[]
  for(let d=start;d<=end;d++){
    const ds=`${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    const v=getDayTotals(dayMap,ds)[macroKey]||0
    if(v>0)vals.push(v)
  }
  return vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length):0
}
function getMealMonthAvgs(dayMap,year,month) {
  const dim=getDaysInMonth(year,month)
  return MEALS.map(meal=>{
    const rows=[]
    for(let d=1;d<=dim;d++){
      const ds=`${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
      const md=dayMap[ds]?.[meal.key]
      if(md)rows.push(md)
    }
    const n=rows.length
    if(!n)return{...meal,count:0,avgs:{}}
    const avgs=MACROS.reduce((acc,m)=>{ acc[m.key]=Math.round(rows.reduce((s,r)=>s+(Number(r[m.key])||0),0)/n); return acc },{})
    return{...meal,count:n,avgs}
  })
}
function calcDayScore(totals,microTotals,goals) {
  const hasMacros=MACROS.some(m=>(totals[m.key]||0)>0)
  if(!hasMacros)return null
  const macroScores=MACROS.map(m=>{
    const val=totals[m.key]||0,goal=goals[m.goalKey]||DEFAULT_GOALS[m.goalKey]
    if(!val)return 0
    if(m.key==='fiber'){const r=val/goal;return r>=1?1:r>=0.8?0.8:r>=0.6?0.5:r*0.5}
    const dev=Math.abs(val/goal-1)
    return dev<=0.1?1:dev<=0.2?0.8:dev<=0.3?0.6:dev<=0.5?0.3:0.1
  })
  const macroScore=macroScores.reduce((a,b)=>a+b,0)/MACROS.length*70
  const hasMicros=MICROS.some(m=>(microTotals[m.key]||0)>0)
  const microScores=MICROS.map(m=>{
    const val=microTotals[m.key]||0
    if(!val)return hasMicros?0:0.5
    const r=val/m.goal
    if(m.type==='max')return r<=0.75?1:r<=0.9?0.8:r<=1?0.5:Math.max(0,1-(r-1))
    if(m.type==='min')return r>=1?1:r>=0.75?0.7:r*0.7
    const dev=Math.abs(r-1);return dev<=0.1?1:dev<=0.25?0.75:dev<=0.5?0.5:0.2
  })
  const microScore=microScores.reduce((a,b)=>a+b,0)/MICROS.length*30
  return Math.round(macroScore+microScore)
}
function scoreGrade(score) {
  if(score>=90)return{grade:'A',color:'#1D9E75'}
  if(score>=75)return{grade:'B',color:'#059669'}
  if(score>=60)return{grade:'C',color:'#EF9F27'}
  if(score>=45)return{grade:'D',color:'#F97316'}
  return{grade:'F',color:'#E24B4A'}
}
function calcStreak(dayMap) {
  const d=new Date()
  const ts=d.toISOString().split('T')[0]
  if(!dayMap[ts]||!Object.keys(dayMap[ts]).length)d.setDate(d.getDate()-1)
  let streak=0
  for(let i=0;i<365;i++){
    const ds=d.toISOString().split('T')[0]
    if(dayMap[ds]&&Object.keys(dayMap[ds]).length>0){streak++;d.setDate(d.getDate()-1)}
    else break
  }
  return streak
}
function getPeriodWeeks(dayMap,days) {
  const dates=Array.from({length:days},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(days-1-i));return d.toISOString().split('T')[0]})
  const weeks=[]
  for(let i=0;i<dates.length;i+=7){
    const chunk=dates.slice(i,i+7)
    const logged=chunk.filter(d=>dayMap[d]&&Object.keys(dayMap[d]).length>0).length
    weeks.push({label:`S${weeks.length+1}`,dates:chunk,logged,total:chunk.length})
  }
  return weeks
}
function getPeriodWeekMacro(dayMap,periodWeeks,macroKey) {
  return periodWeeks.map(w=>({
    ...w,
    value:(()=>{const vals=w.dates.map(d=>getDayTotals(dayMap,d)[macroKey]||0).filter(v=>v>0);return vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length):0})()
  }))
}
function getPeriodAdherence(dayMap,days) {
  let logged=0
  for(let i=0;i<days;i++){const d=new Date();d.setDate(d.getDate()-i);const ds=d.toISOString().split('T')[0];if(dayMap[ds]&&Object.keys(dayMap[ds]).length>0)logged++}
  return Math.round((logged/days)*100)
}

function MicrosGrid({microTotals}) {
  return (
    <div style={{marginBottom:'14px'}}>
      <div style={{fontSize:'12px',fontWeight:'600',color:'#666',marginBottom:'8px'}}>🔬 Micros</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:'8px'}}>
        {MICROS.map(m=>{
          const val=microTotals[m.key]||0
          const pct=val>0?Math.min(Math.round((val/m.goal)*100),150):0
          const sc=microStatusColor(val,m.goal,m.type)
          const barPct=Math.min((val/m.goal)*100,100)
          const typeLabel=m.type==='max'?'límite':m.type==='min'?'mínimo':'objetivo'
          return(
            <div key={m.key} style={{background:'white',borderRadius:'12px',border:'0.5px solid #e8e8e8',padding:'10px 12px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:'4px'}}>
                <div style={{fontSize:'10px',fontWeight:'600',color:'#555'}}>{m.label}</div>
                <div style={{fontSize:'9px',color:'#bbb'}}>{m.goal}{m.unit}</div>
              </div>
              <div style={{fontSize:'17px',fontWeight:'600',color:val>0?sc:'#ccc',lineHeight:1}}>
                {val>0?Math.round(val):'—'}<span style={{fontSize:'10px',fontWeight:'400',color:'#bbb'}}> {m.unit}</span>
              </div>
              <div style={{background:'#f0f0f0',borderRadius:'4px',height:'4px',marginTop:'6px'}}>
                <div style={{background:val>0?sc:'#f0f0f0',borderRadius:'4px',height:'4px',width:`${barPct}%`,transition:'width 0.6s ease'}}/>
              </div>
              <div style={{fontSize:'9px',color:val>0?sc:'#ccc',marginTop:'3px',fontWeight:'500'}}>
                {val>0?`${pct}% del ${typeLabel}`:'Sin datos'}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MicrosSummary({microAvgs,label}) {
  return (
    <div style={{background:'white',borderRadius:'14px',border:'0.5px solid #e8e8e8',padding:'14px',marginTop:'12px'}}>
      <div style={{fontSize:'12px',fontWeight:'600',color:'#666',marginBottom:'12px'}}>🔬 {label}</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:'8px'}}>
        {microAvgs.map(m=>{
          const val=m.avg||0
          const pct=val>0?Math.min(Math.round((val/m.goal)*100),150):0
          const sc=microStatusColor(val,m.goal,m.type)
          const barPct=Math.min((val/m.goal)*100,100)
          const typeLabel=m.type==='max'?'límite':m.type==='min'?'mínimo':'objetivo'
          return(
            <div key={m.key} style={{display:'flex',flexDirection:'column',gap:'4px',padding:'8px 10px',background:'#fafafa',borderRadius:'10px',border:'0.5px solid #f0f0f0'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
                <div style={{fontSize:'10px',fontWeight:'600',color:'#555'}}>{m.label}</div>
                <div style={{fontSize:'9px',color:'#bbb'}}>{m.goal}{m.unit}</div>
              </div>
              <div style={{fontSize:'15px',fontWeight:'600',color:val>0?sc:'#ccc',lineHeight:1}}>
                {val>0?Math.round(val):'—'}<span style={{fontSize:'10px',fontWeight:'400',color:'#bbb'}}> {m.unit}</span>
              </div>
              <div style={{background:'#e8e8e8',borderRadius:'4px',height:'3px'}}>
                <div style={{background:val>0?sc:'#e8e8e8',borderRadius:'4px',height:'3px',width:`${barPct}%`,transition:'width 0.6s ease'}}/>
              </div>
              <div style={{fontSize:'9px',color:val>0?sc:'#ccc',fontWeight:'500'}}>
                {val>0?`${pct}% del ${typeLabel}`:'Sin datos'}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function LineChart({series,goal,color}) {
  const W=280,H=75,PAD=6
  const vals=series.map(s=>s.value)
  const max=Math.max(...vals,goal*1.1,1)
  const toY=v=>PAD+(H-PAD*2)*(1-v/max)
  const toX=i=>(i/(series.length-1))*W
  const pts=series.map((s,i)=>`${toX(i)},${toY(s.value)}`).join(' ')
  const area=`M${toX(0)},${toY(series[0].value)} `+series.slice(1).map((s,i)=>`L${toX(i+1)},${toY(s.value)}`).join(' ')+` L${W},${H} L0,${H} Z`
  const validVals=vals.filter(v=>v>0)
  const avg=validVals.length?validVals.reduce((a,b)=>a+b,0)/validVals.length:0
  const avgY=toY(avg),goalY=toY(goal),today=todayStr()
  const dayLbls=['L','M','X','J','V','S','D']
  return (
    <svg viewBox={`0 0 ${W} ${H+16}`} style={{width:'100%',overflow:'visible'}}>
      <line x1={0} y1={goalY} x2={W} y2={goalY} stroke={color} strokeWidth={0.8} strokeDasharray="4,3" opacity={0.3}/>
      <path d={area} fill={color} opacity={0.07}/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"/>
      <line x1={0} y1={avgY} x2={W} y2={avgY} stroke={color} strokeWidth={1} strokeDasharray="7,4" opacity={0.55}/>
      {series.map((s,i)=>{ const x=toX(i),y=toY(s.value),isT=s.date===today; return s.value>0?(<g key={i}>{isT?<><circle cx={x} cy={y} r={5} fill="white" stroke={color} strokeWidth={2}/><circle cx={x} cy={y} r={2} fill={color}/></>:<circle cx={x} cy={y} r={3} fill={color}/>}</g>):null })}
      {series.map((s,i)=><text key={i} x={toX(i)} y={H+13} textAnchor="middle" fontSize={8} fill={s.date===today?color:'#bbb'} fontWeight={s.date===today?'600':'400'}>{dayLbls[new Date(s.date+'T12:00:00').getDay()]}</text>)}
    </svg>
  )
}

function WeekBarChart({weeks,goal,color,unit}) {
  const W=280,H=80,PAD=8,n=weeks.length
  const maxVal=Math.max(...weeks.map(w=>w.value),goal*1.1,1)
  const toY=v=>PAD+(H-PAD*2)*(1-v/maxVal)
  const goalY=toY(goal)
  const slotW=(W-PAD*2)/n
  const barW=Math.min(slotW*0.62,38)
  return (
    <svg viewBox={`0 0 ${W} ${H+20}`} style={{width:'100%',overflow:'visible'}}>
      <line x1={PAD} y1={goalY} x2={W-PAD} y2={goalY} stroke={color} strokeWidth={0.8} strokeDasharray="4,3" opacity={0.35}/>
      {weeks.map((w,i)=>{
        const cx=PAD+slotW*i+slotW/2,barH=w.value>0?(H-PAD*2)*(w.value/maxVal):0,y=toY(w.value)
        return(<g key={i}>
          <rect x={cx-barW/2} y={w.value>0?y:H-PAD} width={barW} height={barH>0?barH:2} rx={4} fill={w.value>0?color:'#f0f0f0'} opacity={w.value>0?0.85:1}/>
          {w.value>0&&<text x={cx} y={y-4} textAnchor="middle" fontSize={8} fill={color} fontWeight="600">{w.value}</text>}
          <text x={cx} y={H+14} textAnchor="middle" fontSize={9} fill="#aaa">{w.label}</text>
        </g>)
      })}
      <text x={W-PAD} y={goalY-3} textAnchor="end" fontSize={8} fill={color} opacity={0.55}>obj {goal}{unit}</text>
    </svg>
  )
}

function Heatmap({macro,dayMap,goals,year,month}) {
  const daysInMonth=getDaysInMonth(year,month)
  const firstDay=new Date(year,month,1).getDay()
  const offset=firstDay===0?6:firstDay-1
  const today=todayStr(), goal=goals[macro.goalKey]||DEFAULT_GOALS[macro.goalKey]
  const cells=[]
  for(let i=0;i<offset;i++)cells.push(null)
  for(let d=1;d<=daysInMonth;d++){
    const ds=`${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    cells.push({date:ds,value:getDayTotals(dayMap,ds)[macro.key]||0})
  }
  return (
    <div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'2px',marginBottom:'4px'}}>
        {['L','M','X','J','V','S','D'].map(d=><div key={d} style={{textAlign:'center',fontSize:'9px',color:'#bbb',fontWeight:'500'}}>{d}</div>)}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'2px'}}>
        {cells.map((cell,i)=>{
          if(!cell)return<div key={i} style={{height:'18px'}}/>
          const bg=heatColor(cell.value,goal,macro.heatColors),isT=cell.date===today,isFut=cell.date>today
          return<div key={i} style={{height:'18px',borderRadius:'3px',background:isFut?'#f5f5f5':bg,opacity:isFut?0.3:1,outline:isT?`2px solid ${macro.color}`:'none',outlineOffset:'1px'}} title={`${fmtShort(cell.date)}: ${Math.round(cell.value)}${macro.unit}`}/>
        })}
      </div>
    </div>
  )
}

function TrendLineChart({weeks,goal,color,unit}) {
  const W=280,H=75,PAD=10
  const vals=weeks.map(w=>w.value)
  const max=Math.max(...vals,goal*1.1,1)
  const toY=v=>PAD+(H-PAD*2)*(1-v/max)
  const n=weeks.length
  const toX=i=>PAD+(n<2?0:i/(n-1))*(W-PAD*2)
  const goalY=toY(goal)
  const pts=weeks.filter(w=>w.value>0).length>1
    ?weeks.map((w,i)=>w.value>0?`${toX(i)},${toY(w.value)}`:null).filter(Boolean).join(' ')
    :''
  return (
    <svg viewBox={`0 0 ${W} ${H+20}`} style={{width:'100%',overflow:'visible'}}>
      <line x1={PAD} y1={goalY} x2={W-PAD} y2={goalY} stroke={color} strokeWidth={0.8} strokeDasharray="4,3" opacity={0.35}/>
      {pts&&<polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" opacity={0.85}/>}
      {weeks.map((w,i)=>w.value>0?(
        <g key={i}>
          <circle cx={toX(i)} cy={toY(w.value)} r={3.5} fill="white" stroke={color} strokeWidth={2}/>
          <text x={toX(i)} y={toY(w.value)-8} textAnchor="middle" fontSize={8} fill={color} fontWeight="600">{w.value}</text>
        </g>
      ):null)}
      {weeks.map((w,i)=><text key={i} x={toX(i)} y={H+14} textAnchor="middle" fontSize={9} fill="#aaa">{w.label}</text>)}
      <text x={W-PAD} y={goalY-3} textAnchor="end" fontSize={8} fill={color} opacity={0.55}>obj {goal}{unit}</text>
    </svg>
  )
}

function StepsCard({steps,goal}) {
  const pct=steps>0?Math.min((steps/goal)*100,100):0
  const r=22,circ=2*Math.PI*r,dash=(pct/100)*circ
  const color=pct>=100?'#1D9E75':pct>=70?'#EF9F27':'#378ADD'
  const remaining=Math.max(goal-steps,0)
  return(
    <div style={{background:'white',borderRadius:'14px',border:'0.5px solid #e8e8e8',padding:'14px 16px',marginBottom:'14px',display:'flex',alignItems:'center',gap:'16px'}}>
      <div style={{position:'relative',width:'52px',height:'52px',flexShrink:0}}>
        <svg width="52" height="52" viewBox="0 0 52 52">
          <circle cx="26" cy="26" r={r} fill="none" stroke="#f0f0f0" strokeWidth="5"/>
          <circle cx="26" cy="26" r={r} fill="none" stroke={steps>0?color:'#f0f0f0'} strokeWidth="5"
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 26 26)"
            style={{transition:'stroke-dasharray 0.8s ease'}}/>
        </svg>
        <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px'}}>👟</div>
      </div>
      <div style={{flex:1}}>
        <div style={{fontSize:'13px',fontWeight:'600',color:'#1a1a2e',marginBottom:'2px'}}>Pasos del día</div>
        <div style={{display:'flex',alignItems:'baseline',gap:'6px',marginBottom:'6px'}}>
          <div style={{fontSize:'26px',fontWeight:'700',color:steps>0?color:'#ccc',lineHeight:1}}>{steps>0?steps.toLocaleString('es-AR'):'—'}</div>
          <div style={{fontSize:'12px',color:'#bbb'}}>/ {goal.toLocaleString('es-AR')}</div>
        </div>
        <div style={{background:'#f0f0f0',borderRadius:'6px',height:'5px'}}>
          <div style={{background:steps>0?color:'#f0f0f0',borderRadius:'6px',height:'5px',width:`${pct}%`,transition:'width 0.8s ease'}}/>
        </div>
        <div style={{fontSize:'10px',color:'#aaa',marginTop:'4px'}}>{steps>0?(pct>=100?'¡Meta alcanzada!':` Faltan ${remaining.toLocaleString('es-AR')} pasos`):'Sin datos hoy'}</div>
      </div>
    </div>
  )
}

export default function Home() {
  const [rawMeals,setRawMeals]=useState([])
  const [goals,setGoals]=useState(DEFAULT_GOALS)
  const [loading,setLoading]=useState(true)
  const [tab,setTab]=useState('hoy')
  const [selectedDate,setSelectedDate]=useState(todayStr())
  const [monthOffset,setMonthOffset]=useState(0)
  const [tendPeriod,setTendPeriod]=useState(30)
  const [rawFitness,setRawFitness]=useState([])

  const fetchData=async()=>{
    try{
      const res=await fetch(SUPABASE_FN)
      const data=await res.json()
      setRawMeals(data.meals||[])
      if(data.goals)setGoals(data.goals)
      setRawFitness(data.fitness||[])
    }catch(e){}
    setLoading(false)
  }

  useEffect(()=>{
    fetchData()
    const iv=setInterval(fetchData,30000)
    return()=>clearInterval(iv)
  },[])

  const today=todayStr(),last7=getLast7(),dayMap=buildDayMap(rawMeals)
  const dayMeals=dayMap[selectedDate]||{},totals=getDayTotals(dayMap,selectedDate)
  const microTotals=getDayMicroTotals(dayMap,selectedDate)
  const dayScore=calcDayScore(totals,microTotals,goals)
  const streak=calcStreak(dayMap)
  const periodWeeks=getPeriodWeeks(dayMap,tendPeriod)
  const periodAdherence=getPeriodAdherence(dayMap,tendPeriod)

  const stepsGoalRow=rawFitness.find(r=>r.date==='__goal__')
  const stepsGoal=stepsGoalRow?stepsGoalRow.steps_goal:5000
  const stepsMap=rawFitness.reduce((acc,r)=>{if(r.date!=='__goal__')acc[r.date]={steps:r.steps,goal:r.steps_goal||stepsGoal};return acc},{})
  const todaySteps=stepsMap[selectedDate]||{steps:0,goal:stepsGoal}

  const now=new Date()
  const heatMonth=((now.getMonth()+monthOffset)%12+12)%12
  const heatYear=now.getFullYear()+Math.floor((now.getMonth()+monthOffset)/12)
  const daysInHeatMonth=getDaysInMonth(heatYear,heatMonth)

  const monthAvgs=MACROS.map(m=>{
    const vals=Array.from({length:daysInHeatMonth},(_,i)=>{
      const d=`${heatYear}-${String(heatMonth+1).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`
      return getDayTotals(dayMap,d)[m.key]||0
    }).filter(v=>v>0)
    return{...m,avg:vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length):0}
  })
  const mealAvgs=getMealMonthAvgs(dayMap,heatYear,heatMonth)

  // Micro averages — semana
  const weekMicroAvgs=MICROS.map(m=>{
    const vals=last7.map(d=>getDayMicroTotals(dayMap,d)[m.key]||0).filter(v=>v>0)
    return{...m,avg:vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length):0}
  })

  // Micro averages — mes
  const monthMicroAvgs=MICROS.map(m=>{
    const vals=Array.from({length:daysInHeatMonth},(_,i)=>{
      const d=`${heatYear}-${String(heatMonth+1).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`
      return getDayMicroTotals(dayMap,d)[m.key]||0
    }).filter(v=>v>0)
    return{...m,avg:vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length):0}
  })

  const monthCalBalance=(()=>{
    const calGoal=goals.calories||DEFAULT_GOALS.calories
    let total=0,count=0
    for(let d=1;d<=daysInHeatMonth;d++){
      const ds=`${heatYear}-${String(heatMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
      const v=getDayTotals(dayMap,ds).calories||0
      if(v>0){total+=(v-calGoal);count++}
    }
    return{total:Math.round(total),days:count,avg:count?Math.round(total/count):0}
  })()

  if(loading)return(
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0f0f1a',fontFamily:'system-ui'}}>
      <div style={{textAlign:'center',color:'white'}}><div style={{fontSize:'40px',marginBottom:'12px'}}>🥗</div><div style={{opacity:0.6,fontSize:'14px'}}>Cargando...</div></div>
    </div>
  )

  return (
    <div style={{minHeight:'100vh',background:'#f8f9fc',fontFamily:"'Inter',system-ui,sans-serif",color:'#1a1a2e'}}>
      <Head>
        <title>Nutri Tracker</title>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet"/>
      </Head>

      <div style={{background:'#1a1a2e',color:'white',padding:'20px 24px 0'}}>
        <div style={{maxWidth:'960px',margin:'0 auto'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'18px'}}>
            <div>
              <div style={{fontSize:'20px',fontWeight:'600'}}>🥗 Nutri Tracker</div>
              <div style={{fontSize:'12px',opacity:0.5,marginTop:'2px'}}>{new Date().toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'})}</div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
              {streak>0&&(
                <div style={{display:'flex',alignItems:'center',gap:'5px',background:'rgba(255,180,0,0.15)',border:'1px solid rgba(255,180,0,0.3)',borderRadius:'20px',padding:'4px 12px'}}>
                  <span style={{fontSize:'14px'}}>🔥</span>
                  <span style={{fontSize:'12px',fontWeight:'600',color:'#FFB400'}}>{streak}d</span>
                  <span style={{fontSize:'10px',color:'rgba(255,180,0,0.7)'}}>racha</span>
                </div>
              )}
              <button onClick={fetchData} style={{background:'rgba(255,255,255,0.1)',border:'none',color:'white',padding:'6px 14px',borderRadius:'8px',cursor:'pointer',fontSize:'12px',fontFamily:'inherit'}}>↻ Actualizar</button>
            </div>
          </div>
          <div style={{display:'flex',gap:'4px'}}>
            {[{id:'hoy',label:'Hoy'},{id:'semana',label:'Semana'},{id:'mes',label:'Mes'},{id:'tendencias',label:'Tendencias'}].map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:'10px 18px',border:'none',cursor:'pointer',fontFamily:'inherit',fontSize:'13px',fontWeight:'500',borderRadius:'8px 8px 0 0',background:tab===t.id?'#f8f9fc':'transparent',color:tab===t.id?'#1a1a2e':'rgba(255,255,255,0.5)'}}>{t.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{maxWidth:'960px',margin:'0 auto',padding:'20px 16px 40px'}}>

        {tab==='hoy'&&<>
          <div style={{display:'flex',gap:'6px',marginBottom:'14px',flexWrap:'wrap'}}>
            {last7.map(d=>{
              const dt=new Date(d+'T12:00:00'),label=d===today?'Hoy':`${DAY_NAMES_LONG[dt.getDay()]} ${fmtShort(d)}`,hasMeals=!!dayMap[d]&&Object.keys(dayMap[d]).length>0
              return(<button key={d} onClick={()=>setSelectedDate(d)} style={{padding:'6px 12px',borderRadius:'20px',fontFamily:'inherit',border:`1.5px solid ${d===selectedDate?'#1a1a2e':'#e0e0e0'}`,background:d===selectedDate?'#1a1a2e':'white',color:d===selectedDate?'white':'#666',cursor:'pointer',fontSize:'11px',fontWeight:'500',position:'relative'}}>
                {label}{hasMeals&&<span style={{position:'absolute',top:'2px',right:'2px',width:'5px',height:'5px',borderRadius:'50%',background:'#1D9E75'}}/>}
              </button>)
            })}
          </div>

          {/* Score nutricional */}
          {dayScore!==null&&(()=>{const sg=scoreGrade(dayScore);return(
            <div style={{background:'white',borderRadius:'14px',border:'0.5px solid #e8e8e8',padding:'14px 16px',marginBottom:'14px',display:'flex',alignItems:'center',gap:'16px'}}>
              <div style={{position:'relative',width:'60px',height:'60px',flexShrink:0}}>
                <svg width="60" height="60" viewBox="0 0 60 60">
                  <circle cx="30" cy="30" r="25" fill="none" stroke="#f0f0f0" strokeWidth="6"/>
                  <circle cx="30" cy="30" r="25" fill="none" stroke={sg.color} strokeWidth="6"
                    strokeDasharray={`${(dayScore/100)*2*Math.PI*25} ${2*Math.PI*25}`}
                    strokeLinecap="round" transform="rotate(-90 30 30)" style={{transition:'stroke-dasharray 0.8s ease'}}/>
                  <text x="30" y="34" textAnchor="middle" fontSize="14" fontWeight="700" fill={sg.color}>{sg.grade}</text>
                </svg>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:'13px',fontWeight:'600',color:'#1a1a2e',marginBottom:'2px'}}>Score nutricional del día</div>
                <div style={{display:'flex',alignItems:'baseline',gap:'6px',marginBottom:'6px'}}>
                  <div style={{fontSize:'28px',fontWeight:'700',color:sg.color,lineHeight:1}}>{dayScore}</div>
                  <div style={{fontSize:'12px',color:'#bbb'}}>/100</div>
                </div>
                <div style={{background:'#f0f0f0',borderRadius:'6px',height:'5px'}}>
                  <div style={{background:sg.color,borderRadius:'6px',height:'5px',width:`${dayScore}%`,transition:'width 0.8s ease'}}/>
                </div>
                <div style={{fontSize:'10px',color:'#aaa',marginTop:'4px'}}>Macros 70% · Micros 30%</div>
              </div>
            </div>
          )})()}

          {/* Pasos */}
          <StepsCard steps={todaySteps.steps} goal={todaySteps.goal}/>

          {/* Macros */}
          <div style={{fontSize:'12px',fontWeight:'600',color:'#666',marginBottom:'8px'}}>💊 Macros</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(5,minmax(0,1fr))',gap:'8px',marginBottom:'14px'}}>
            {MACROS.map(m=>{
              const val=totals[m.key]||0,goal=goals[m.goalKey]||DEFAULT_GOALS[m.goalKey],pct=goal?Math.min(Math.round((val/goal)*100),100):0
              const r=26,circ=2*Math.PI*r,dash=(pct/100)*circ
              return(<div key={m.key} style={{background:'white',border:'0.5px solid #e8e8e8',borderRadius:'12px',padding:'10px 6px',textAlign:'center'}}>
                <svg width="64" height="64" viewBox="0 0 64 64" style={{display:'block',margin:'0 auto'}}>
                  <circle cx="32" cy="32" r={r} fill="none" stroke="#f0f0f0" strokeWidth="7"/>
                  <circle cx="32" cy="32" r={r} fill="none" stroke={m.color} strokeWidth="7" strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 32 32)" style={{transition:'stroke-dasharray 0.8s ease'}}/>
                  <text x="32" y="28" textAnchor="middle" fontSize="10" fontWeight="600" fill="#1a1a2e">{Math.round(val)}</text>
                  <text x="32" y="40" textAnchor="middle" fontSize="8" fill="#999">{m.unit}</text>
                </svg>
                <div style={{fontSize:'10px',fontWeight:'600',color:'#777',marginTop:'4px'}}>{m.label}</div>
                <div style={{fontSize:'9px',color:m.color,marginTop:'2px'}}>{pct}% de {goal}</div>
              </div>)
            })}
          </div>

          {/* Micros */}
          <MicrosGrid microTotals={microTotals}/>

          {/* Comidas */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:'10px'}}>
            {MEALS.map(meal=>{
              const data=dayMeals[meal.key]
              return(<div key={meal.key} style={{background:'white',borderRadius:'12px',padding:'13px',border:`0.5px solid ${data?meal.color+'40':'#e8e8e8'}`,borderLeft:`3px solid ${data?meal.color:'#e8e8e8'}`}}>
                <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'8px'}}>
                  <div style={{width:'32px',height:'32px',borderRadius:'8px',background:data?meal.color+'18':'#f5f5f5',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'15px'}}>{meal.icon}</div>
                  <div><div style={{fontSize:'12px',fontWeight:'600'}}>{meal.label}</div><div style={{fontSize:'11px',fontWeight:'500',color:data?meal.color:'#ccc'}}>{data?`${Math.round(data.calories)} kcal`:'Sin cargar'}</div></div>
                </div>
                {data?<><div style={{fontSize:'11px',color:'#888',fontStyle:'italic',marginBottom:'8px',lineHeight:'1.4'}}>{data.food}</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'4px',marginBottom:'6px'}}>
                  {[{l:'Prot',v:data.protein,c:'#378ADD'},{l:'Carbs',v:data.carbs,c:'#EF9F27'},{l:'Grasas',v:data.fat,c:'#7F77DD'},{l:'Fibra',v:data.fiber,c:'#1D9E75'}].map(mac=>(
                    <div key={mac.l} style={{background:mac.c+'12',borderRadius:'6px',padding:'4px 2px',textAlign:'center'}}>
                      <div style={{fontSize:'11px',fontWeight:'600',color:mac.c}}>{Math.round(mac.v)}g</div>
                      <div style={{fontSize:'8px',color:'#aaa'}}>{mac.l}</div>
                    </div>
                  ))}
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'3px',paddingTop:'6px',borderTop:'0.5px solid #f0f0f0'}}>
                  {MICROS.map(m=>{
                    const val=Number(data[m.key])||0
                    const sc=microStatusColor(val,m.goal,m.type)
                    return(
                      <div key={m.key} style={{background:'#fafafa',borderRadius:'5px',padding:'3px 4px',textAlign:'center'}}>
                        <div style={{fontSize:'10px',fontWeight:'600',color:val>0?sc:'#ccc',lineHeight:1.2}}>{val>0?Math.round(val):'—'}<span style={{fontSize:'8px',fontWeight:'400',color:'#bbb'}}>{m.unit}</span></div>
                        <div style={{fontSize:'8px',color:'#bbb',marginTop:'1px'}}>{m.label}</div>
                      </div>
                    )
                  })}
                </div>
                </>:<div style={{fontSize:'11px',color:'#ccc',fontStyle:'italic'}}>Todavía no cargaste esta comida</div>}
              </div>)
            })}
          </div>
        </>}

        {tab==='semana'&&<>
          <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:'12px'}}>
            {MACROS.filter(m=>m.key!=='fiber').map(m=>{
              const series=last7.map(d=>({date:d,value:getDayTotals(dayMap,d)[m.key]||0}))
              const vals=series.filter(s=>s.value>0).map(s=>s.value)
              const avg=vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length):0
              const goal=goals[m.goalKey]||DEFAULT_GOALS[m.goalKey],dev=avg-goal
              const devStr=dev===0?'±0':dev>0?`+${Math.round(dev)}`:`${Math.round(dev)}`
              return(<div key={m.key} style={{background:'white',borderRadius:'14px',border:'0.5px solid #e8e8e8',padding:'16px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:'2px'}}>
                  <div style={{fontSize:'12px',fontWeight:'600',color:'#666'}}>{m.label}</div>
                  <div style={{fontSize:'10px',color:'#bbb'}}>Obj: <span style={{color:m.color,fontWeight:'600'}}>{goal}{m.unit}</span></div>
                </div>
                <div style={{fontSize:'22px',fontWeight:'600',color:m.color,marginBottom:'2px'}}>{avg}<span style={{fontSize:'11px',fontWeight:'400',color:'#bbb'}}> {m.unit} prom.</span></div>
                <div style={{fontSize:'11px',color:Math.abs(dev)<goal*0.1?'#1D9E75':m.color,marginBottom:'10px'}}>Desvío: <strong>{devStr}{m.unit}</strong> vs objetivo</div>
                <LineChart series={series} goal={goal} color={m.color}/>
                <div style={{display:'flex',gap:'10px',marginTop:'6px'}}>
                  {[{d:'none',l:'Real'},{d:'8px',l:'Promedio'},{d:'4px',l:'Objetivo',op:0.4}].map(lg=>(
                    <div key={lg.l} style={{display:'flex',alignItems:'center',gap:'4px'}}>
                      <div style={{width:'14px',height:'0',borderTop:`1.5px ${lg.d==='none'?'solid':'dashed'} ${m.color}`,opacity:lg.op||1}}/>
                      <span style={{fontSize:'9px',color:'#bbb'}}>{lg.l}</span>
                    </div>
                  ))}
                </div>
              </div>)
            })}
          </div>
          <div style={{background:'white',borderRadius:'14px',border:'0.5px solid #e8e8e8',padding:'14px',marginTop:'12px'}}>
            <div style={{fontSize:'12px',fontWeight:'600',color:'#666',marginBottom:'10px'}}>Resumen diario</div>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:'11px'}}>
                <thead><tr style={{borderBottom:'0.5px solid #e8e8e8'}}>
                  <th style={{padding:'7px 8px',textAlign:'left',color:'#aaa',fontWeight:'600'}}>Día</th>
                  {MACROS.filter(m=>m.key!=='fiber').map(m=><th key={m.key} style={{padding:'7px 8px',textAlign:'center',color:m.color,fontWeight:'600'}}>{m.label}</th>)}
                </tr></thead>
                <tbody>{last7.map((d,i)=>{
                  const dt=getDayTotals(dayMap,d),isT=d===today,dn=DAY_NAMES_LONG[new Date(d+'T12:00:00').getDay()]
                  return(<tr key={d} style={{background:isT?'#f0f4ff':i%2===0?'white':'#fafafa',cursor:'pointer'}} onClick={()=>{setSelectedDate(d);setTab('hoy')}}>
                    <td style={{padding:'7px 8px',fontWeight:isT?'600':'400',color:isT?'#1a1a2e':'#666'}}>{dn} {fmtShort(d)}{isT?' ←':''}</td>
                    {MACROS.filter(m=>m.key!=='fiber').map(m=>{
                      const v=dt[m.key]||0,goal=goals[m.goalKey]||DEFAULT_GOALS[m.goalKey]
                      return<td key={m.key} style={{padding:'7px 8px',textAlign:'center',color:v>0?(v>=goal*0.9?'#1D9E75':m.color):'#ddd',fontWeight:v>0?'500':'400'}}>{v>0?`${Math.round(v)}${m.unit}`:'—'}</td>
                    })}
                  </tr>)
                })}</tbody>
              </table>
            </div>
          </div>
          <MicrosSummary microAvgs={weekMicroAvgs} label="Promedio semanal — micros"/>
        </>}

        {tab==='mes'&&<>
          <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'14px'}}>
            <button onClick={()=>setMonthOffset(o=>o-1)} style={{padding:'5px 12px',border:'0.5px solid #e0e0e0',borderRadius:'8px',background:'white',cursor:'pointer',fontSize:'14px'}}>‹</button>
            <div style={{fontSize:'14px',fontWeight:'600'}}>{MONTH_NAMES[heatMonth]} {heatYear}</div>
            <button onClick={()=>setMonthOffset(o=>Math.min(o+1,0))} style={{padding:'5px 12px',border:'0.5px solid #e0e0e0',borderRadius:'8px',background:'white',cursor:'pointer',fontSize:'14px'}}>›</button>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:'8px',marginBottom:'14px'}}>
            {monthAvgs.filter(m=>m.key!=='fiber').map(m=>{
              const goal=goals[m.goalKey]||DEFAULT_GOALS[m.goalKey],dev=m.avg-goal
              return(<div key={m.key} style={{background:'white',borderRadius:'12px',border:'0.5px solid #e8e8e8',padding:'12px',textAlign:'center'}}>
                <div style={{fontSize:'9px',color:'#bbb',marginBottom:'2px'}}>Prom. mensual</div>
                <div style={{fontSize:'11px',fontWeight:'600',color:m.color,marginBottom:'2px'}}>{m.label}</div>
                <div style={{fontSize:'20px',fontWeight:'600'}}>{m.avg||'—'}</div>
                <div style={{fontSize:'9px',color:'#bbb'}}>{m.unit}</div>
                {m.avg>0&&<div style={{fontSize:'10px',color:Math.abs(dev)<goal*0.1?'#1D9E75':m.color,fontWeight:'500',marginTop:'3px'}}>{dev>=0?`+${Math.round(dev)}`:`${Math.round(dev)}`}{m.unit} vs obj</div>}
              </div>)
            })}
          </div>
          {/* Balance calórico acumulado */}
          {monthCalBalance.days>0&&(
            <div style={{background:'white',borderRadius:'14px',border:'0.5px solid #e8e8e8',padding:'14px 16px',marginBottom:'14px'}}>
              <div style={{fontSize:'12px',fontWeight:'600',color:'#666',marginBottom:'10px'}}>⚖️ Balance calórico acumulado — {MONTH_NAMES[heatMonth]}</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'8px'}}>
                {[
                  {label:'Acumulado',value:`${monthCalBalance.total>=0?'+':''}${monthCalBalance.total.toLocaleString('es-AR')} kcal`,color:monthCalBalance.total<=0?'#1D9E75':monthCalBalance.total<500?'#EF9F27':'#E24B4A'},
                  {label:'Prom. diario',value:`${monthCalBalance.avg>=0?'+':''}${monthCalBalance.avg} kcal/día`,color:Math.abs(monthCalBalance.avg)<100?'#1D9E75':Math.abs(monthCalBalance.avg)<300?'#EF9F27':'#E24B4A'},
                  {label:'Días con datos',value:`${monthCalBalance.days}d`,color:'#7F77DD'},
                ].map(s=>(
                  <div key={s.label} style={{textAlign:'center',padding:'10px 6px',background:'#fafafa',borderRadius:'10px',border:'0.5px solid #f0f0f0'}}>
                    <div style={{fontSize:'15px',fontWeight:'700',color:s.color,lineHeight:1,marginBottom:'4px'}}>{s.value}</div>
                    <div style={{fontSize:'9px',color:'#aaa',fontWeight:'500'}}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={{fontSize:'10px',color:'#bbb',marginTop:'8px',textAlign:'center'}}>Positivo = superávit · Negativo = déficit vs objetivo diario de {(goals.calories||DEFAULT_GOALS.calories).toLocaleString('es-AR')} kcal</div>
            </div>
          )}

          <div style={{marginBottom:'16px'}}>
            <div style={{fontSize:'12px',fontWeight:'600',color:'#666',marginBottom:'10px'}}>📊 Evolución semanal — promedio diario por semana</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:'12px'}}>
              {MACROS.filter(m=>m.key!=='fiber').map(m=>{
                const goal=goals[m.goalKey]||DEFAULT_GOALS[m.goalKey]
                const avg=monthAvgs.find(x=>x.key===m.key)?.avg||0,dev=avg-goal
                const weeks=getWeekBuckets(heatYear,heatMonth).map(w=>({...w,value:getWeekDayAvg(dayMap,heatYear,heatMonth,w.start,w.end,m.key)}))
                return(<div key={m.key} style={{background:'white',borderRadius:'14px',border:'0.5px solid #e8e8e8',padding:'14px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:'6px'}}>
                    <div style={{fontSize:'12px',fontWeight:'600',color:m.color}}>{m.label}</div>
                    <div style={{fontSize:'10px',color:'#bbb'}}>Prom: <span style={{color:m.color,fontWeight:'600'}}>{avg||'—'}{m.unit}</span>{avg>0&&<span style={{color:Math.abs(dev)<goal*0.1?'#1D9E75':m.color,marginLeft:'6px',fontWeight:'500'}}>{dev>=0?`+${Math.round(dev)}`:`${Math.round(dev)}`}{m.unit}</span>}</div>
                  </div>
                  <WeekBarChart weeks={weeks} goal={goal} color={m.color} unit={m.unit}/>
                  <div style={{display:'flex',alignItems:'center',gap:'4px',marginTop:'2px'}}>
                    <div style={{width:'14px',height:'0',borderTop:`1.5px dashed ${m.color}`,opacity:0.4}}/>
                    <span style={{fontSize:'9px',color:'#bbb'}}>Objetivo diario</span>
                  </div>
                </div>)
              })}
            </div>
          </div>
          <div style={{marginBottom:'16px'}}>
            <div style={{fontSize:'12px',fontWeight:'600',color:'#666',marginBottom:'10px'}}>🍽 Promedio mensual por comida</div>
            <div style={{background:'white',borderRadius:'14px',border:'0.5px solid #e8e8e8',padding:'14px'}}>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:'11px',minWidth:'520px'}}>
                  <thead>
                    <tr style={{borderBottom:'0.5px solid #e8e8e8'}}>
                      <th style={{padding:'7px 8px',textAlign:'left',color:'#aaa',fontWeight:'600'}}>Comida</th>
                      <th style={{padding:'7px 8px',textAlign:'center',color:'#aaa',fontWeight:'600'}}>Días</th>
                      {MACROS.map(m=><th key={m.key} style={{padding:'7px 8px',textAlign:'center',color:m.color,fontWeight:'600'}}>{m.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {mealAvgs.map((meal,i)=>(
                      <tr key={meal.key} style={{background:i%2===0?'white':'#fafafa',borderBottom:'0.5px solid #f0f0f0'}}>
                        <td style={{padding:'8px'}}>
                          <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
                            <div style={{width:'22px',height:'22px',borderRadius:'6px',background:meal.color+'18',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px'}}>{meal.icon}</div>
                            <span style={{fontWeight:'500',color:'#444'}}>{meal.label}</span>
                          </div>
                        </td>
                        <td style={{padding:'8px',textAlign:'center',color:'#bbb',fontSize:'10px'}}>{meal.count>0?`${meal.count}d`:'—'}</td>
                        {MACROS.map(m=>(
                          <td key={m.key} style={{padding:'8px',textAlign:'center',fontWeight:meal.count>0?'500':'400',color:meal.count>0?m.color:'#ddd'}}>
                            {meal.count>0?`${meal.avgs[m.key]}${m.unit}`:'—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <MicrosSummary microAvgs={monthMicroAvgs} label="Promedio mensual — micros"/>
        </>}

        {tab==='tendencias'&&<>
          {/* Period selector */}
          <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'16px'}}>
            <div style={{fontSize:'12px',fontWeight:'600',color:'#666',marginRight:'4px'}}>📈 Período:</div>
            {[30,60,90].map(p=>(
              <button key={p} onClick={()=>setTendPeriod(p)} style={{padding:'6px 16px',borderRadius:'20px',fontFamily:'inherit',border:`1.5px solid ${tendPeriod===p?'#1a1a2e':'#e0e0e0'}`,background:tendPeriod===p?'#1a1a2e':'white',color:tendPeriod===p?'white':'#666',cursor:'pointer',fontSize:'12px',fontWeight:'500'}}>{p}d</button>
            ))}
          </div>

          {/* Stats row */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'8px',marginBottom:'16px'}}>
            {[
              {icon:'📅',label:'Días registrados',value:`${periodWeeks.reduce((a,w)=>a+w.logged,0)}/${tendPeriod}`,color:'#378ADD'},
              {icon:'✅',label:'Adherencia',value:`${periodAdherence}%`,color:periodAdherence>=80?'#1D9E75':periodAdherence>=60?'#EF9F27':'#E24B4A'},
              {icon:'📆',label:'Semanas',value:`${periodWeeks.length}`,color:'#7F77DD'},
            ].map(s=>(
              <div key={s.label} style={{background:'white',borderRadius:'12px',border:'0.5px solid #e8e8e8',padding:'12px',textAlign:'center'}}>
                <div style={{fontSize:'18px',marginBottom:'4px'}}>{s.icon}</div>
                <div style={{fontSize:'18px',fontWeight:'700',color:s.color}}>{s.value}</div>
                <div style={{fontSize:'9px',color:'#aaa',marginTop:'2px'}}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Macro trend charts */}
          <div style={{fontSize:'12px',fontWeight:'600',color:'#666',marginBottom:'10px'}}>Evolución semanal — promedio diario por semana</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:'12px'}}>
            {MACROS.filter(m=>m.key!=='fiber').map(m=>{
              const goal=goals[m.goalKey]||DEFAULT_GOALS[m.goalKey]
              const weeks=getPeriodWeekMacro(dayMap,periodWeeks,m.key)
              const validVals=weeks.filter(w=>w.value>0).map(w=>w.value)
              const avg=validVals.length?Math.round(validVals.reduce((a,b)=>a+b,0)/validVals.length):0
              const dev=avg-goal
              const trend=validVals.length>=2?(validVals[validVals.length-1]-validVals[0]>0?'↑':'↓'):'—'
              return(
                <div key={m.key} style={{background:'white',borderRadius:'14px',border:'0.5px solid #e8e8e8',padding:'14px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:'2px'}}>
                    <div style={{fontSize:'12px',fontWeight:'600',color:m.color}}>{m.label}</div>
                    <div style={{fontSize:'11px',fontWeight:'600',color:'#ccc'}}>{trend}</div>
                  </div>
                  <div style={{display:'flex',alignItems:'baseline',gap:'6px',marginBottom:'8px'}}>
                    <div style={{fontSize:'20px',fontWeight:'600',color:m.color}}>{avg||'—'}</div>
                    {avg>0&&<><div style={{fontSize:'11px',color:'#bbb'}}>{m.unit} prom.</div>
                    <div style={{fontSize:'10px',color:Math.abs(dev)<goal*0.1?'#1D9E75':m.color,fontWeight:'500'}}>{dev>=0?`+${Math.round(dev)}`:`${Math.round(dev)}`}{m.unit}</div></>}
                  </div>
                  <TrendLineChart weeks={weeks} goal={goal} color={m.color} unit={m.unit}/>
                </div>
              )
            })}
          </div>

          {/* Micros trend summary */}
          <div style={{background:'white',borderRadius:'14px',border:'0.5px solid #e8e8e8',padding:'14px',marginTop:'12px'}}>
            <div style={{fontSize:'12px',fontWeight:'600',color:'#666',marginBottom:'12px'}}>🔬 Promedio de micros — últimos {tendPeriod}d</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:'8px'}}>
              {MICROS.map(m=>{
                const vals=periodWeeks.flatMap(w=>w.dates.map(d=>getDayMicroTotals(dayMap,d)[m.key]||0)).filter(v=>v>0)
                const avg=vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length):0
                const sc=microStatusColor(avg,m.goal,m.type)
                const pct=avg>0?Math.min(Math.round((avg/m.goal)*100),150):0
                const typeLabel=m.type==='max'?'límite':m.type==='min'?'mínimo':'objetivo'
                return(
                  <div key={m.key} style={{background:'#fafafa',borderRadius:'10px',border:'0.5px solid #f0f0f0',padding:'10px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:'4px'}}>
                      <div style={{fontSize:'10px',fontWeight:'600',color:'#555'}}>{m.label}</div>
                      <div style={{fontSize:'9px',color:'#bbb'}}>{m.goal}{m.unit}</div>
                    </div>
                    <div style={{fontSize:'16px',fontWeight:'600',color:avg>0?sc:'#ccc',lineHeight:1,marginBottom:'5px'}}>
                      {avg>0?avg:'—'}<span style={{fontSize:'10px',fontWeight:'400',color:'#bbb'}}> {m.unit}</span>
                    </div>
                    <div style={{background:'#e8e8e8',borderRadius:'4px',height:'3px'}}>
                      <div style={{background:avg>0?sc:'#e8e8e8',borderRadius:'4px',height:'3px',width:`${Math.min((avg/m.goal)*100,100)}%`,transition:'width 0.6s ease'}}/>
                    </div>
                    <div style={{fontSize:'9px',color:avg>0?sc:'#ccc',marginTop:'3px',fontWeight:'500'}}>{avg>0?`${pct}% del ${typeLabel}`:'Sin datos'}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </>}
      </div>
    </div>
  )
}
