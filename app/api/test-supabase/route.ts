import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    console.log('🧪 Testing Supabase connection...');
    
    // Test 1: Productos
    const { data: productos, error: productosError } = await supabase
      .from('productos')
      .select('*')
      .limit(5);
    
    console.log('📦 Productos test:', { count: productos?.length, error: productosError?.message });
    
    // Test 2: Movimientos
    const { data: movimientos, error: movimientosError } = await supabase
      .from('movimientos')
      .select('*')
      .limit(5);
    
    console.log('📊 Movimientos test:', { count: movimientos?.length, error: movimientosError?.message });
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      tests: {
        productos: {
          count: productos?.length || 0,
          error: productosError?.message || null,
          sample: productos?.[0] || null
        },
        movimientos: {
          count: movimientos?.length || 0,
          error: movimientosError?.message || null,
          sample: movimientos?.[0] || null
        }
      },
      supabaseConfig: {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'configured' : 'missing',
        key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'configured' : 'missing'
      }
    });
  } catch (error: any) {
    console.error('❌ Test failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}