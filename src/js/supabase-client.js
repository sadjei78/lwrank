// Supabase client for LWRank
// Version: 1.1.12 - Fixed connection detection
let supabase;

// Import local config for development
import { config } from './config.js';

// Supabase configuration
// Try environment variables first (production), fall back to local config (development)
let supabaseUrl, supabaseAnonKey;

try {
  // Try to get from environment variables (works in Vite builds)
  supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    // Fall back to local config
    supabaseUrl = config.supabaseUrl;
    supabaseAnonKey = config.supabaseAnonKey;
  }
} catch (error) {
  // Fall back to local config
  supabaseUrl = config.supabaseUrl;
  supabaseAnonKey = config.supabaseAnonKey;
}

// Create initial dummy client
supabase = {
  from: () => ({
    select: () => Promise.resolve({ data: null, error: { message: 'Supabase initializing...' } }),
    insert: () => Promise.resolve({ data: null, error: { message: 'Supabase initializing...' } }),
    delete: () => Promise.resolve({ data: null, error: { message: 'Supabase initializing...' } }),
    update: () => Promise.resolve({ data: null, error: { message: 'Supabase initializing...' } }),
    upsert: () => Promise.resolve({ data: null, error: { message: 'Supabase initializing...' } })
  })
};

// Initialize the Supabase client
export async function initializeSupabase() {
  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.trim() === '' || supabaseAnonKey.trim() === '') {
    console.warn('Supabase configuration missing. Please set up your environment variables.');
    // Keep dummy client
    return;
  }

  try {
    // Validate URL format before creating client
    const url = new URL(supabaseUrl);
    if (!url.protocol || !url.hostname) {
      throw new Error('Invalid URL format');
    }
    
    // Create real Supabase client
    console.log('Creating real Supabase client with URL:', supabaseUrl);
    
    // Use dynamic import without top-level await
    import('@supabase/supabase-js').then(({ createClient }) => {
      supabase = createClient(supabaseUrl, supabaseAnonKey);
      
      // Test the connection
      supabase.from('rankings').select('count').limit(1).then(({ data, error }) => {
        if (error) {
          console.warn('Supabase connection test failed, using dummy client:', error);
          // Fall back to dummy client
          supabase = {
            from: () => ({
              select: () => Promise.resolve({ data: null, error: { message: 'Supabase connection failed' } }),
              insert: () => Promise.resolve({ data: null, error: { message: 'Supabase connection failed' } }),
              delete: () => Promise.resolve({ data: null, error: { message: 'Supabase connection failed' } }),
              update: () => Promise.resolve({ data: null, error: { message: 'Supabase connection failed' } }),
              upsert: () => Promise.resolve({ data: null, error: { message: 'Supabase connection failed' } })
            })
          };
        } else {
          console.log('Supabase client created successfully');
        }
      }).catch(error => {
        console.error('Supabase connection test failed:', error);
        // Fall back to dummy client
        supabase = {
          from: () => ({
            select: () => Promise.resolve({ data: null, error: { message: 'Supabase connection failed' } }),
            insert: () => Promise.resolve({ data: null, error: { message: 'Supabase connection failed' } }),
            delete: () => Promise.resolve({ data: null, error: { message: 'Supabase connection failed' } }),
            update: () => Promise.resolve({ data: null, error: { message: 'Supabase connection failed' } }),
            upsert: () => Promise.resolve({ data: null, error: { message: 'Supabase connection failed' } })
          })
        };
      });
    }).catch(error => {
      console.error('Error importing Supabase client:', error);
      // Keep dummy client
    });
  } catch (error) {
    console.error('Error creating Supabase client:', error);
    // Keep dummy client
  }
}

export { supabase };

// Test connection
export async function testConnection() {
  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.trim() === '' || supabaseAnonKey.trim() === '') {
    console.log('Supabase not configured, using offline mode');
    return false;
  }
  
  try {
    // Test actual connection to Supabase
    const { data, error } = await supabase.from('rankings').select('count').limit(1);
    if (error) {
      console.error('Supabase connection test failed:', error);
      return false;
    }
    
    console.log('Supabase connection test successful');
    return true;
  } catch (error) {
    console.error('Supabase connection failed:', error);
    return false;
  }
}