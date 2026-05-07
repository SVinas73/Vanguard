import { NextResponse } from 'next/server';

// =====================================================
// GET /api/v1/openapi.json
// =====================================================
// Schema OpenAPI 3.1 que documenta los endpoints públicos
// para que clientes terceros puedan auto-descubrir la API
// e importarla en Postman / Insomnia / Swagger UI.
// =====================================================

export async function GET(request: Request) {
  const host = request.headers.get('host') || 'localhost:3000';
  const proto = host.includes('localhost') ? 'http' : 'https';
  const baseUrl = `${proto}://${host}`;

  const spec = {
    openapi: '3.1.0',
    info: {
      title: 'Vanguard API',
      version: '1.0.0',
      description: `
API REST de Vanguard ERP/WMS. Acceso vía API key con scopes.

## Autenticación
Enviá tu API key en uno de estos headers:
- \`X-Vanguard-Api-Key: ak_live_xxx\`
- \`Authorization: Bearer ak_live_xxx\`

## Rate limit
Configurable por API key (default 120 req/min). Cuando se
excede devolvemos \`429\` con \`Retry-After\`.

## Webhooks
Configurá endpoints que recibirán eventos en tiempo real.
Cada payload va firmado con HMAC-SHA256 en el header
\`X-Vanguard-Signature\`.
`.trim(),
      contact: { name: 'Soporte Vanguard' },
    },
    servers: [{ url: `${baseUrl}/api/v1`, description: 'Producción / Test' }],
    components: {
      securitySchemes: {
        ApiKeyHeader: { type: 'apiKey', in: 'header', name: 'X-Vanguard-Api-Key' },
        BearerAuth: { type: 'http', scheme: 'bearer' },
      },
      schemas: {
        Producto: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            codigo: { type: 'string' },
            descripcion: { type: 'string' },
            categoria: { type: 'string', nullable: true },
            stock: { type: 'number' },
            stock_minimo: { type: 'number' },
            precio: { type: 'number' },
          },
        },
        Cliente: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            codigo: { type: 'string', nullable: true },
            nombre: { type: 'string' },
            email: { type: 'string', format: 'email', nullable: true },
            telefono: { type: 'string', nullable: true },
            saldo_pendiente: { type: 'number' },
            limite_credito: { type: 'number' },
          },
        },
        OrdenVenta: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            numero: { type: 'string' },
            cliente_id: { type: 'string', format: 'uuid' },
            total: { type: 'number' },
            estado: { type: 'string' },
            estado_pago: { type: 'string' },
            fecha_orden: { type: 'string', format: 'date-time' },
          },
        },
        Ticket: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            numero: { type: 'string' },
            asunto: { type: 'string' },
            categoria: { type: 'string' },
            prioridad: { type: 'string', enum: ['baja', 'normal', 'alta', 'critica'] },
            estado: { type: 'string' },
            sla_vencimiento: { type: 'string', format: 'date-time', nullable: true },
          },
        },
        Paginacion: {
          type: 'object',
          properties: {
            limit: { type: 'integer' },
            offset: { type: 'integer' },
            total: { type: 'integer' },
          },
        },
        Error: {
          type: 'object',
          properties: { error: { type: 'string' } },
        },
      },
    },
    security: [{ ApiKeyHeader: [] }, { BearerAuth: [] }],
    paths: {
      '/productos': {
        get: {
          summary: 'Listar productos',
          parameters: [
            { name: 'codigo', in: 'query', schema: { type: 'string' } },
            { name: 'categoria', in: 'query', schema: { type: 'string' } },
            { name: 'solo_criticos', in: 'query', schema: { type: 'boolean' } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 50, maximum: 200 } },
            { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
          ],
          responses: {
            '200': {
              description: 'Lista de productos',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: { type: 'array', items: { $ref: '#/components/schemas/Producto' } },
                      paginacion: { $ref: '#/components/schemas/Paginacion' },
                    },
                  },
                },
              },
            },
            '401': { description: 'API key inválida' },
            '429': { description: 'Rate limit excedido' },
          },
          'x-scope': 'productos:read',
        },
      },
      '/clientes': {
        get: {
          summary: 'Listar clientes',
          parameters: [
            { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Búsqueda por nombre / código / email' },
            { name: 'limit', in: 'query', schema: { type: 'integer' } },
            { name: 'offset', in: 'query', schema: { type: 'integer' } },
          ],
          responses: { '200': { description: 'OK' } },
          'x-scope': 'clientes:read',
        },
        post: {
          summary: 'Crear cliente',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['nombre'],
                  properties: {
                    nombre: { type: 'string' },
                    email: { type: 'string', format: 'email' },
                    telefono: { type: 'string' },
                    rut: { type: 'string' },
                    direccion: { type: 'string' },
                    limite_credito: { type: 'number' },
                  },
                },
              },
            },
          },
          responses: { '201': { description: 'Cliente creado' } },
          'x-scope': 'clientes:write',
        },
      },
      '/ordenes-venta': {
        get: {
          summary: 'Listar órdenes de venta',
          parameters: [
            { name: 'estado', in: 'query', schema: { type: 'string' } },
            { name: 'cliente_id', in: 'query', schema: { type: 'string' } },
            { name: 'limit', in: 'query', schema: { type: 'integer' } },
            { name: 'offset', in: 'query', schema: { type: 'integer' } },
          ],
          responses: { '200': { description: 'OK' } },
          'x-scope': 'ordenes_venta:read',
        },
        post: {
          summary: 'Crear orden de venta',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['cliente_id', 'items'],
                  properties: {
                    cliente_id: { type: 'string', format: 'uuid' },
                    fecha_entrega_esperada: { type: 'string', format: 'date' },
                    notas: { type: 'string' },
                    items: {
                      type: 'array',
                      minItems: 1,
                      items: {
                        type: 'object',
                        required: ['producto_codigo', 'cantidad', 'precio_unitario'],
                        properties: {
                          producto_codigo: { type: 'string' },
                          cantidad: { type: 'number' },
                          precio_unitario: { type: 'number' },
                          descuento: { type: 'number' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: { '201': { description: 'Orden creada' } },
          'x-scope': 'ordenes_venta:write',
        },
      },
      '/tickets': {
        get: {
          summary: 'Listar tickets de soporte',
          parameters: [
            { name: 'estado', in: 'query', schema: { type: 'string' } },
            { name: 'cliente_email', in: 'query', schema: { type: 'string' } },
          ],
          responses: { '200': { description: 'OK' } },
          'x-scope': 'tickets:read',
        },
        post: {
          summary: 'Crear ticket de soporte',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['asunto'],
                  properties: {
                    asunto: { type: 'string' },
                    descripcion: { type: 'string' },
                    cliente_email: { type: 'string', format: 'email' },
                    cliente_nombre: { type: 'string' },
                    canal: { type: 'string', enum: ['web', 'email', 'telefono', 'whatsapp', 'presencial'] },
                    categoria: { type: 'string', enum: ['consulta', 'falla_producto', 'reclamo', 'pedido_info', 'cambio', 'devolucion', 'instalacion', 'otro'] },
                    prioridad: { type: 'string', enum: ['baja', 'normal', 'alta', 'critica'] },
                  },
                },
              },
            },
          },
          responses: { '201': { description: 'Ticket creado' } },
          'x-scope': 'tickets:write',
        },
      },
    },
    'x-webhooks': {
      eventos: [
        'orden_venta.creada', 'orden_venta.confirmada', 'orden_venta.entregada',
        'orden_compra.creada', 'orden_compra.recibida',
        'cotizacion.creada', 'cotizacion.aprobada', 'cotizacion.rechazada',
        'cliente.creado',
        'producto.bajo_stock', 'producto.sin_stock',
        'ticket.abierto', 'ticket.resuelto', 'ticket.sla_breached',
        'garantia.creada', 'garantia.por_vencer', 'garantia.reclamada',
        'cfe.aceptado', 'cfe.rechazado',
        'aprobacion.creada', 'aprobacion.aprobada',
      ],
      verificacion: {
        descripcion: 'Cada payload viene firmado con HMAC-SHA256(secret, body) en el header X-Vanguard-Signature.',
        ejemplo_node: 'crypto.createHmac("sha256", secret).update(req.body).digest("hex")',
      },
    },
  };

  return NextResponse.json(spec, {
    headers: {
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
