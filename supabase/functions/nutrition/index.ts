// Copia versionada de la Edge Function `nutrition` (versión 5 desplegada en Supabase).
// Desplegar cambios con el conector de Supabase o `supabase functions deploy nutrition`.
import { createClient } from 'jsr:@supabase/supabase-js@2'

// La versión desplegada tiene la clave escrita en el código; acá se lee de un secret
// de Supabase (NUTRI_SECRET) para no versionarla. Configurarlo antes de redesplegar.
const SECRET = Deno.env.get('NUTRI_SECRET') ?? ''

Deno.serve(async (req: Request) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // GET — fetch all data
  if (req.method === 'GET') {
    const { data: meals } = await supabase.from('nutrition_meals').select('*').order('date', { ascending: true })
    const { data: goals } = await supabase.from('nutrition_goals').select('*').eq('id', 1).single()
    const { data: fitness } = await supabase.from('daily_fitness').select('*').order('date', { ascending: true })
    return new Response(JSON.stringify({ meals: meals ?? [], goals: goals ?? {}, fitness: fitness ?? [] }), { headers: cors })
  }

  // POST — add/update a meal OR log steps/workout
  if (req.method === 'POST') {
    const body = await req.json()
    if (body.secret !== SECRET) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors })

    // Steps / fitness / workout logging
    if (body.type === 'steps') {
      const { date, steps, steps_goal, workout_minutes, workout_intensity, workout_type } = body
      const upsertData: Record<string, unknown> = { date, steps: steps ?? 0 }
      if (steps_goal !== undefined) upsertData.steps_goal = steps_goal
      if (workout_minutes !== undefined) upsertData.workout_minutes = workout_minutes
      if (workout_intensity !== undefined) upsertData.workout_intensity = workout_intensity
      if (workout_type !== undefined) upsertData.workout_type = workout_type
      const { data, error } = await supabase.from('daily_fitness').upsert(upsertData, { onConflict: 'date' }).select().single()
      if (error) return new Response(JSON.stringify({ error }), { status: 500, headers: cors })
      return new Response(JSON.stringify({ ok: true, data }), { headers: cors })
    }

    // Meal logging
    const {
      date, meal, food,
      calories, protein, carbs, fat, fiber,
      sodium, potassium, sugar, sat_fat, mono_fat, poly_fat,
      accumulate
    } = body

    if (accumulate) {
      const { data: existing } = await supabase.from('nutrition_meals').select('*').eq('date', date).eq('meal', meal).single()
      if (existing) {
        const { data, error } = await supabase.from('nutrition_meals').update({
          food:      existing.food + ' + ' + food,
          calories:  existing.calories  + (calories  ?? 0),
          protein:   existing.protein   + (protein   ?? 0),
          carbs:     existing.carbs     + (carbs     ?? 0),
          fat:       existing.fat       + (fat       ?? 0),
          fiber:     existing.fiber     + (fiber     ?? 0),
          sodium:    existing.sodium    + (sodium    ?? 0),
          potassium: existing.potassium + (potassium ?? 0),
          sugar:     existing.sugar     + (sugar     ?? 0),
          sat_fat:   existing.sat_fat   + (sat_fat   ?? 0),
          mono_fat:  existing.mono_fat  + (mono_fat  ?? 0),
          poly_fat:  existing.poly_fat  + (poly_fat  ?? 0),
          updated_at: new Date().toISOString()
        }).eq('date', date).eq('meal', meal).select().single()
        return new Response(JSON.stringify({ ok: true, data }), { headers: cors })
      }
    }

    const { data, error } = await supabase.from('nutrition_meals').upsert({
      date, meal, food,
      calories:  calories  ?? 0,
      protein:   protein   ?? 0,
      carbs:     carbs     ?? 0,
      fat:       fat       ?? 0,
      fiber:     fiber     ?? 0,
      sodium:    sodium    ?? 0,
      potassium: potassium ?? 0,
      sugar:     sugar     ?? 0,
      sat_fat:   sat_fat   ?? 0,
      mono_fat:  mono_fat  ?? 0,
      poly_fat:  poly_fat  ?? 0,
      updated_at: new Date().toISOString()
    }, { onConflict: 'date,meal' }).select().single()

    if (error) return new Response(JSON.stringify({ error }), { status: 500, headers: cors })
    return new Response(JSON.stringify({ ok: true, data }), { headers: cors })
  }

  // PUT — update goals
  if (req.method === 'PUT') {
    const body = await req.json()
    if (body.secret !== SECRET) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors })

    if (body.type === 'steps_goal') {
      const { data, error } = await supabase.from('daily_fitness').upsert({ date: '__goal__', steps: 0, steps_goal: body.steps_goal }, { onConflict: 'date' }).select().single()
      if (error) return new Response(JSON.stringify({ error }), { status: 500, headers: cors })
      return new Response(JSON.stringify({ ok: true, data }), { headers: cors })
    }

    const { calories, protein, carbs, fat, fiber } = body
    const { data, error } = await supabase.from('nutrition_goals').update({ calories, protein, carbs, fat, fiber, updated_at: new Date().toISOString() }).eq('id', 1).select().single()
    if (error) return new Response(JSON.stringify({ error }), { status: 500, headers: cors })
    return new Response(JSON.stringify({ ok: true, data }), { headers: cors })
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: cors })
})
