import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qfuzcgdkzcjwfrkfdsvx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmdXpjZ2RremNqd2Zya2Zkc3Z4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3ODU1MDksImV4cCI6MjA4MDM2MTUwOX0.CYvcdqwbhRpYH6laRpkNmwzKaYGhbOKmIvs0alrLhhA';

export const supabase = createClient(supabaseUrl, supabaseKey);