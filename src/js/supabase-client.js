// For local development, use a dummy client
// In production, this should be bundled with the build process
// Version: 1.1.5 - Local dev mode
let supabase;

console.log('Supabase client loaded - Local development mode');

// Supabase configuration
// For local development, use fallback values if environment variables aren't available
let supabaseUrl, supabaseAnonKey;

try {
  // Try to get from environment variables (works in Vite builds)
  supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
} catch (error) {
  // Fallback for local development
  console.log('Environment variables not available, using local development mode');
  supabaseUrl = '';
  supabaseAnonKey = '';
}

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
  try {
    // Validate URL format before creating client
    const url = new URL(supabaseUrl);
    if (!url.protocol || !url.hostname) {
      throw new Error('Invalid URL format');
    }
    
    // For local development, use dummy client
    console.log('Local development mode - using dummy Supabase client');
    supabase = {
      from: () => ({
        select: () => Promise.resolve({ data: null, error: { message: 'Local development mode' } }),
        insert: () => Promise.resolve({ data: null, error: { message: 'Local development mode' } }),
        delete: () => Promise.resolve({ data: null, error: { message: 'Local development mode' } }),
        update: () => Promise.resolve({ data: null, error: { message: 'Local development mode' } }),
        upsert: () => Promise.resolve({ data: null, error: { message: 'Local development mode' } })
      })
    };
  } catch (error) {
    console.error('Invalid Supabase URL:', supabaseUrl, error);
    // Fall back to dummy client
    supabase = {
      from: () => ({
        select: () => Promise.resolve({ data: null, error: { message: 'Invalid Supabase URL' } }),
        insert: () => Promise.resolve({ data: null, error: { message: 'Invalid Supabase URL' } }),
        delete: () => Promise.resolve({ data: null, error: { message: 'Invalid Supabase URL' } }),
        update: () => Promise.resolve({ data: null, error: { message: 'Invalid Supabase URL' } }),
        upsert: () => Promise.resolve({ data: null, error: { message: 'Invalid Supabase URL' } })
      })
    };
  }
}

export { supabase };

// Test connection
export async function testConnection() {
  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.trim() === '' || supabaseAnonKey.trim() === '') {
    console.log('Local development mode - Supabase not configured, using offline mode');
    return false;
  }
  
  try {
    // Validate URL format first
    const url = new URL(supabaseUrl);
    if (!url.protocol || !url.hostname) {
      console.error('Invalid Supabase URL format:', supabaseUrl);
      return false;
    }
    
    // For local development, return false to indicate offline mode
    console.log('Local development mode - Supabase offline');
    return false;
  } catch (error) {
    console.error('Supabase connection failed:', error);
    return false;
  }
}