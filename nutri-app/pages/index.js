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
function heatColor(value,goal,colors) {
  if(!value)return'#f5f5f5'
  const r=value/goal
  if(r<0.5)return colors[0]; if(r<0.75)return colors[1]; if(r<0.9)return colors[2]; if(r<1.1)return colors[3]; return colors[4]
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

export default function Home() {
  const [rawMeals,setRawMeals]=useState([])
  const [goals,setGoals]=useState(DEFAULT_GOALS)
  const [loading,setLoading]=useState(true)
  const [tab,setTab]=useState('hoy')
  const [selectedDate,setSelectedDate]=useState(todayStr())
  const [monthOffset,setMonthOffset]=useState(0)

  const fetchData=async()=>{
    try{
      const res=await fetch(SUPABASE_FN)
      const data=await res.json()
      setRawMeals(data.meals||[])
      if(data.goals)setGoals(data.goals)
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
            <button onClick={fetchData} style={{background:'rgba(255,255,255,0.1)',border:'none',color:'white',padding:'6px 14px',borderRadius:'8px',cursor:'pointer',fontSize:'12px',fontFamily:'inherit'}}>↻ Actualizar</button>
          </div>
          <div style={{display:'flex',gap:'4px'}}>
            {[{id:'hoy',label:'Hoy'},{id:'semana',label:'Semana'},{id:'mes',label:'Mes'}].map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:'10px 20px',border:'none',cursor:'pointer',fontFamily:'inherit',fontSize:'13px',fontWeight:'500',borderRadius:'8px 8px 0 0',background:tab===t.id?'#f8f9fc':'transparent',color:tab===t.id?'#1a1a2e':'rgba(255,255,255,0.5)'}}>{t.label}</button>
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
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:'10px'}}>
            {MEALS.map(meal=>{
              const data=dayMeals[meal.key]
              return(<div key={meal.key} style={{background:'white',borderRadius:'12px',padding:'13px',border:`0.5px solid ${data?meal.color+'40':'#e8e8e8'}`,borderLeft:`3px solid ${data?meal.color:'#e8e8e8'}`}}>
                <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'8px'}}>
                  <div style={{width:'32px',height:'32px',borderRadius:'8px',background:data?meal.color+'18':'#f5f5f5',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'15px'}}>{meal.icon}</div>
                  <div><div style={{fontSize:'12px',fontWeight:'600'}}>{meal.label}</div><div style={{fontSize:'11px',fontWeight:'500',color:data?meal.color:'#ccc'}}>{data?`${Math.round(data.calories)} kcal`:'Sin cargar'}</div></div>
                </div>
                {data?<><div style={{fontSize:'11px',color:'#888',fontStyle:'italic',marginBottom:'8px',lineHeight:'1.4'}}>{data.food}</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'4px'}}>
                  {[{l:'Prot',v:data.protein,c:'#378ADD'},{l:'Carbs',v:data.carbs,c:'#EF9F27'},{l:'Grasas',v:data.fat,c:'#7F77DD'},{l:'Fibra',v:data.fiber,c:'#1D9E75'}].map(mac=>(
                    <div key={mac.l} style={{background:mac.c+'12',borderRadius:'6px',padding:'4px 2px',textAlign:'center'}}>
                      <div style={{fontSize:'11px',fontWeight:'600',color:mac.c}}>{Math.round(mac.v)}g</div>
                      <div style={{fontSize:'8px',color:'#aaa'}}>{mac.l}</div>
                    </div>
                  ))}
                </div></>:<div style={{fontSize:'11px',color:'#ccc',fontStyle:'italic'}}>Todavía no cargaste esta comida</div>}
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
          <div style={{display:'flex',justifyContent:'flex-end',alignItems:'center',gap:'6px',marginBottom:'12px'}}>
            <span style={{fontSize:'9px',color:'#bbb'}}>Bajo</span>
            {MACROS[0].heatColors.map((c,i)=><div key={i} style={{width:'13px',height:'13px',borderRadius:'3px',background:c}}/>)}
            <span style={{fontSize:'9px',color:'#bbb'}}>≥ Obj</span>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:'12px'}}>
            {MACROS.filter(m=>m.key!=='fiber').map(m=>{
              const avg=monthAvgs.find(x=>x.key===m.key)?.avg||0,goal=goals[m.goalKey]||DEFAULT_GOALS[m.goalKey],dev=avg-goal
              return(<div key={m.key} style={{background:'white',borderRadius:'14px',border:'0.5px solid #e8e8e8',padding:'14px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:'10px'}}>
                  <div style={{fontSize:'12px',fontWeight:'600',color:m.color}}>{m.label}</div>
                  <div style={{fontSize:'10px',color:'#bbb'}}>Prom: <span style={{color:m.color,fontWeight:'600'}}>{avg||'—'}{m.unit}</span>{avg>0&&<span style={{color:Math.abs(dev)<goal*0.1?'#1D9E75':m.color,marginLeft:'6px',fontWeight:'500'}}>{dev>=0?`+${Math.round(dev)}`:`${Math.round(dev)}`}{m.unit}</span>}</div>
                </div>
                <Heatmap macro={m} dayMap={dayMap} goals={goals} year={heatYear} month={heatMonth}/>
                <div style={{fontSize:'9px',color:'#bbb',marginTop:'6px'}}>Más oscuro = más cerca del objetivo · borde = hoy</div>
              </div>)
            })}
          </div>
        </>}
      </div>
    </div>
  )
}
