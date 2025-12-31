import React, { useState, useRef, useEffect } from 'react';
import { Card, Button, Input } from '@/components/ui';
import { Camera, X, Barcode, Search, Package, ArrowRightLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// BARCODE SCANNER COMPONENT
// ============================================

interface BarcodeScannerProps {
  onScan: (codigo: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');

  useEffect(() => {
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' } // Cámara trasera en móviles
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setScanning(true);
        }
      } catch (err) {
        setError('No se pudo acceder a la cámara. Usá el ingreso manual.');
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Función para detectar código de barras (simplificada)
  // En producción usarías una librería como @zxing/browser
  const handleManualSubmit = () => {
    if (manualCode.trim()) {
      onScan(manualCode.trim().toUpperCase());
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Barcode size={20} className="text-emerald-400" />
            Escanear Código
          </h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X size={20} />
          </Button>
        </div>

        {/* Visor de cámara */}
        <div className="relative bg-slate-900 rounded-xl overflow-hidden mb-4 aspect-video">
          {error ? (
            <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm p-4 text-center">
              <div>
                <Camera size={40} className="mx-auto mb-2 opacity-50" />
                {error}
              </div>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              {/* Guía de escaneo */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-3/4 h-1/3 border-2 border-emerald-400 rounded-lg opacity-70">
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-emerald-400 -translate-x-1 -translate-y-1" />
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-emerald-400 translate-x-1 -translate-y-1" />
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-emerald-400 -translate-x-1 translate-y-1" />
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-emerald-400 translate-x-1 translate-y-1" />
                </div>
              </div>
              {scanning && (
                <div className="absolute bottom-2 left-0 right-0 text-center text-xs text-emerald-400">
                  Apuntá al código de barras
                </div>
              )}
            </>
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Ingreso manual */}
        <div className="space-y-3">
          <div className="text-xs text-slate-500 text-center">
            O ingresá el código manualmente:
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Código del producto..."
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
              className="flex-1"
            />
            <Button onClick={handleManualSubmit} disabled={!manualCode.trim()}>
              <Search size={18} />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ============================================
// QUICK ACTION SCANNER (Botón flotante)
// ============================================

interface QuickScannerProps {
  products: Array<{ codigo: string; descripcion: string; stock: number }>;
  onProductFound: (product: any) => void;
  onOpenMovement: (product: any, tipo: 'entrada' | 'salida') => void;
}

export function QuickScanner({ products, onProductFound, onOpenMovement }: QuickScannerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<any>(null);

  const handleScan = (codigo: string) => {
    const product = products.find(
      p => p.codigo.toUpperCase() === codigo.toUpperCase()
    );

    if (product) {
      setScannedProduct(product);
      onProductFound(product);
    } else {
      setScannedProduct({ notFound: true, codigo });
    }
    setIsOpen(false);
  };

  const handleQuickAction = (tipo: 'entrada' | 'salida') => {
    if (scannedProduct && !scannedProduct.notFound) {
      onOpenMovement(scannedProduct, tipo);
      setScannedProduct(null);
    }
  };

  return (
    <>
      {/* Botón flotante */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full shadow-lg shadow-emerald-500/30 flex items-center justify-center text-slate-950 hover:scale-110 transition-transform z-40"
      >
        <Barcode size={24} />
      </button>

      {/* Scanner modal */}
      {isOpen && (
        <BarcodeScanner
          onScan={handleScan}
          onClose={() => setIsOpen(false)}
        />
      )}

      {/* Resultado del escaneo */}
      {scannedProduct && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm">
            {scannedProduct.notFound ? (
              <>
                <div className="text-center py-6">
                  <Package size={48} className="mx-auto mb-3 text-red-400 opacity-50" />
                  <h3 className="text-lg font-semibold text-red-400">
                    Producto no encontrado
                  </h3>
                  <p className="text-slate-500 text-sm mt-1">
                    Código: {scannedProduct.codigo}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => setScannedProduct(null)}
                  >
                    Cerrar
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => {
                      setScannedProduct(null);
                      setIsOpen(true);
                    }}
                  >
                    Escanear otro
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Package size={32} className="text-emerald-400" />
                  </div>
                  <h3 className="text-lg font-semibold">
                    {scannedProduct.descripcion}
                  </h3>
                  <p className="text-slate-500 text-sm">
                    {scannedProduct.codigo}
                  </p>
                  <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-full">
                    <span className="text-slate-400 text-sm">Stock:</span>
                    <span className={cn(
                      "font-bold",
                      scannedProduct.stock > 10 ? "text-emerald-400" : 
                      scannedProduct.stock > 0 ? "text-amber-400" : "text-red-400"
                    )}>
                      {scannedProduct.stock}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4">
                  <Button
                    variant="secondary"
                    onClick={() => handleQuickAction('entrada')}
                    className="flex items-center justify-center gap-2"
                  >
                    <ArrowRightLeft size={16} />
                    Entrada
                  </Button>
                  <Button
                    onClick={() => handleQuickAction('salida')}
                    className="flex items-center justify-center gap-2"
                  >
                    <ArrowRightLeft size={16} />
                    Salida
                  </Button>
                </div>

                <div className="flex gap-2 mt-2">
                  <Button
                    variant="ghost"
                    className="flex-1"
                    onClick={() => setScannedProduct(null)}
                  >
                    Cerrar
                  </Button>
                  <Button
                    variant="ghost"
                    className="flex-1"
                    onClick={() => {
                      setScannedProduct(null);
                      setIsOpen(true);
                    }}
                  >
                    Escanear otro
                  </Button>
                </div>
              </>
            )}
          </Card>
        </div>
      )}
    </>
  );
}