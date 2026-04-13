-- ============================================
-- RLS Policies for Chat System
-- Run this in Supabase SQL Editor to fix:
-- "new row violates row-level security policy"
-- ============================================

-- Enable RLS (may already be enabled)
ALTER TABLE chat_conversaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_mensajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_no_leidos ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (to avoid conflicts)
DROP POLICY IF EXISTS "chat_conv_all" ON chat_conversaciones;
DROP POLICY IF EXISTS "chat_msg_all" ON chat_mensajes;
DROP POLICY IF EXISTS "chat_no_leidos_all" ON chat_no_leidos;

-- Allow authenticated users full access
CREATE POLICY "chat_conv_all" ON chat_conversaciones
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "chat_msg_all" ON chat_mensajes
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "chat_no_leidos_all" ON chat_no_leidos
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Also add reacciones column if not exists (for emoji reactions)
ALTER TABLE chat_mensajes ADD COLUMN IF NOT EXISTS reacciones JSONB DEFAULT '{}';
