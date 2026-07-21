import { createClient } from '@supabase/supabase-js'

// Подставь свои ключи через .env (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
// Пока ключей нет — приложение полностью работает на localStorage,
// вызовы supabase просто будут падать в catch и никого не сломают.
const url = import.meta.env.VITE_SUPABASE_URL || ''
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = url && key ? createClient(url, key) : null

export const isSupabaseConfigured = () => !!supabase
