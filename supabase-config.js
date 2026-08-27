/* ================================================================
   SUPABASE-CONFIG.JS
   Supabase Configuration & Cloud Client Initialization
   ================================================================ */

window.SUPABASE_CONFIG = {
  url: "https://eikxrpaakhhmpgtjrlhq.supabase.co",
  // Anon key will be read from localStorage (if set via Admin) or fallback to this default
  anonKey: localStorage.getItem('supabase_anon_key') || ""
};

// Initialize Supabase Client if script & credentials exist
window.getSupabaseClient = function() {
  if (window.supabaseClient) return window.supabaseClient;

  const url = window.SUPABASE_CONFIG.url;
  const key = window.SUPABASE_CONFIG.anonKey || localStorage.getItem('supabase_anon_key');

  if (window.supabase && url && key) {
    try {
      window.supabaseClient = window.supabase.createClient(url, key);
      return window.supabaseClient;
    } catch (e) {
      console.warn('[Supabase] Failed to initialize client:', e.message);
    }
  }
  return null;
};
