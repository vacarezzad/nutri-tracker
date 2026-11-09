-- Nutri Tracker: micronutrientes nuevos + función log_meal
-- Pegar completo en Supabase > SQL Editor > Run

alter table public.nutrition_meals
  add column if not exists magnesium numeric,
  add column if not exists calcium numeric,
  add column if not exists cholesterol numeric,
  add column if not exists trans_fat numeric,
  add column if not exists omega3 numeric,
  add column if not exists added_sugar numeric,
  add column if not exists iron numeric,
  add column if not exists zinc numeric,
  add column if not exists selenium numeric,
  add column if not exists vitamin_a numeric,
  add column if not exists vitamin_c numeric,
  add column if not exists vitamin_d numeric,
  add column if not exists vitamin_e numeric,
  add column if not exists vitamin_k numeric,
  add column if not exists vitamin_b12 numeric,
  add column if not exists folate numeric;

-- Micros sin dato = NULL (la app lo muestra como "Sin datos", no como 0)
alter table public.nutrition_meals
  alter column sodium drop default,
  alter column potassium drop default,
  alter column sugar drop default,
  alter column sat_fat drop default,
  alter column mono_fat drop default,
  alter column poly_fat drop default;

alter table public.nutrition_meals drop constraint if exists nutrition_meals_meal_check;
alter table public.nutrition_meals
  add constraint nutrition_meals_meal_check
  check (meal in ('desayuno','postEntreno','almuerzo','merienda','cena','colaciones'));

-- Carga una comida. p_nutrients: jsonb con macros y micros (keys = columnas).
-- p_accumulate = true suma al registro existente de esa fecha+comida (colaciones); false lo reemplaza.
create or replace function public.log_meal(
  p_date date, p_meal text, p_food text, p_nutrients jsonb, p_accumulate boolean default false
) returns public.nutrition_meals
language plpgsql
set search_path = public
as $$
declare
  v_keys text[] := array['calories','protein','carbs','fat','fiber',
    'sodium','potassium','magnesium','calcium','cholesterol','sat_fat','trans_fat',
    'mono_fat','poly_fat','omega3','added_sugar','sugar',
    'iron','zinc','selenium','vitamin_a','vitamin_c','vitamin_d','vitamin_e','vitamin_k','vitamin_b12','folate'];
  v_macros text[] := array['calories','protein','carbs','fat','fiber'];
  v_old jsonb;
  v_new jsonb := coalesce(p_nutrients, '{}'::jsonb);
  v_out jsonb := '{}'::jsonb;
  v_food text := p_food;
  k text;
  v_bad text;
  v_row public.nutrition_meals;
begin
  select key into v_bad from jsonb_object_keys(v_new) as key where key <> all(v_keys) limit 1;
  if v_bad is not null then
    raise exception 'Nutriente desconocido: %', v_bad;
  end if;

  select to_jsonb(m) into v_old from public.nutrition_meals m where m.date = p_date and m.meal = p_meal;

  foreach k in array v_keys loop
    if p_accumulate and v_old is not null then
      if jsonb_typeof(v_old->k) = 'number' or jsonb_typeof(v_new->k) = 'number' then
        v_out := v_out || jsonb_build_object(k, coalesce((v_old->>k)::numeric,0) + coalesce((v_new->>k)::numeric,0));
      end if;
    elsif jsonb_typeof(v_new->k) = 'number' then
      v_out := v_out || jsonb_build_object(k, (v_new->>k)::numeric);
    end if;
    if k = any(v_macros) and not (v_out ? k) then
      v_out := v_out || jsonb_build_object(k, 0);
    end if;
  end loop;

  if p_accumulate and v_old is not null then
    v_food := concat_ws(' + ', nullif(v_old->>'food',''), p_food);
  end if;

  delete from public.nutrition_meals where date = p_date and meal = p_meal;
  insert into public.nutrition_meals
    select * from jsonb_populate_record(null::public.nutrition_meals,
      v_out || jsonb_build_object('id', gen_random_uuid(), 'date', p_date, 'meal', p_meal,
                                  'food', v_food, 'updated_at', now()))
  returning * into v_row;
  return v_row;
end;
$$;

revoke execute on function public.log_meal(date,text,text,jsonb,boolean) from public, anon, authenticated;
