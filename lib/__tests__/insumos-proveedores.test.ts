import { describe, it, expect } from 'vitest';
import {
  puedeAprobarProveedor,
  aprobadorRequerido,
  labelProveedor,
  APROBADOR_GONZALO,
} from '@/lib/insumos/proveedores';

describe('reglas de aprobación de proveedores de insumos', () => {
  it('Mercado Libre y Ynter Industrial exigen a Gonzalo', () => {
    expect(aprobadorRequerido('MERCADO LIBRE')).toBe(APROBADOR_GONZALO);
    expect(aprobadorRequerido('YNTER INDUSTRIAL')).toBe(APROBADOR_GONZALO);
  });

  it('el resto de proveedores no exige aprobador puntual', () => {
    expect(aprobadorRequerido('TYT DE MARTINI')).toBeNull();
    expect(aprobadorRequerido('ESTACION HOGAR')).toBeNull();
    expect(aprobadorRequerido('OTRO')).toBeNull();
    expect(aprobadorRequerido(null)).toBeNull();
  });

  it('solo Gonzalo aprueba Mercado Libre / Ynter (case-insensitive)', () => {
    expect(puedeAprobarProveedor('MERCADO LIBRE', APROBADOR_GONZALO)).toBe(true);
    expect(puedeAprobarProveedor('MERCADO LIBRE', 'GDecia@ingcotools.com.uy')).toBe(true);
    expect(puedeAprobarProveedor('MERCADO LIBRE', 'otro@empresa.com')).toBe(false);
    expect(puedeAprobarProveedor('YNTER INDUSTRIAL', 'otro@empresa.com')).toBe(false);
  });

  it('cualquiera aprueba Estación Hogar / Otros / TyT', () => {
    expect(puedeAprobarProveedor('ESTACION HOGAR', 'cualquiera@empresa.com')).toBe(true);
    expect(puedeAprobarProveedor('OTRO', 'cualquiera@empresa.com')).toBe(true);
    expect(puedeAprobarProveedor('TYT DE MARTINI', 'cualquiera@empresa.com')).toBe(true);
    expect(puedeAprobarProveedor(null, 'cualquiera@empresa.com')).toBe(true);
  });

  it('labelProveedor usa el nombre libre cuando es OTRO', () => {
    expect(labelProveedor('OTRO', 'Proveedor X')).toBe('Proveedor X');
    expect(labelProveedor('MERCADO LIBRE')).toBe('Mercado Libre');
    expect(labelProveedor(null)).toBe('—');
  });
});
