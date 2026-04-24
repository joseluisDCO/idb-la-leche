import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://otzxvejkxvtmmxqzqsvl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90enh2ZWpreHZ0bW14cXpxc3ZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MzMzNDAsImV4cCI6MjA5MjAwOTM0MH0.OJHHNk4y24UGSvGtyhvVT54hlR6Xwoea8P0hEitIDno';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);