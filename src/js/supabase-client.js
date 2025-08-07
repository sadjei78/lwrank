import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase;

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.trim() === '' || supabaseAnonKey.trim() === '') {
  console.warn('Supabase configuration missing. Please set up your environment variables.');
  // Create a dummy client that will always fail gracefully
  supabase = {
    from: () => ({
      select: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
      insert: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
      delete: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
      update: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } })
    })
  };
} else {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

export { supabase };

// Test connection
export async function testConnection() {
  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.trim() === '' || supabaseAnonKey.trim() === '') {
    console.warn('Supabase not configured, skipping connection test');
    return false;
  }
  
  try {
    const { data, error } = await supabase.from('rankings').select('count').limit(1);
    if (error) {
      console.error('Supabase connection error:', error);
      return false;
    }
    console.log('Supabase connected successfully');
    return true;
  } catch (error) {
    console.error('Supabase connection failed:', error);
    return false;
  }
}