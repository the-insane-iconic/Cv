/* ================================================================
   SUPABASE-CONFIG.JS
   Supabase Configuration & Cloud Client Initialization
   ================================================================ */

window.SUPABASE_CONFIG = {
  url: "https://eikxrpaakhhmpgtjrlhq.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpa3hycGFha2hobXBndGpybGhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4NDc1NTYsImV4cCI6MjEwMzQyMzU1Nn0.uRDnnmhRwCsLBrYdFdczv3Zjws_UAnau7F5auV5jbtg"
};

// Initialize Supabase Client if script & credentials exist
window.getSupabaseClient = function() {
  if (window.supabaseClient) return window.supabaseClient;

  const url = localStorage.getItem('supabase_url') || window.SUPABASE_CONFIG.url;
  const key = localStorage.getItem('supabase_anon_key') || window.SUPABASE_CONFIG.anonKey;

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