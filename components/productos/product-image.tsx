'use client';

import React, { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { ImagePlus, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductImageProps {
  productoCodigo: string;
  imageUrl?: string | null;
  onImageChange?: (url: string | null) => void;
  size?: 'sm' | 'md' | 'lg';
  editable?: boolean;
}

export function ProductImage({ 
  productoCodigo, 
  imageUrl, 
  onImageChange,
  size = 'md',
  editable = true 
}: ProductImageProps) {
  const [uploading, setUploading] = useState(false);
  const [currentImage, setCurrentImage] = useState<string | null>(imageUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-20 h-20',
    lg: 'w-32 h-32',
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo
    if (!file.type.startsWith('image/')) {
      alert('Solo se permiten imágenes');
      return;
    }

    // Validar tamaño (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('La imagen no puede superar 2MB');
      return;
    }

    setUploading(true);

    try {
      // Generar nombre único
      const fileExt = file.name.split('.').pop();
      const fileName = `${productoCodigo}-${Date.now()}.${fileExt}`;
      const filePath = `productos/${fileName}`;

      // Subir a Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('productos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Obtener URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('productos')
        .getPublicUrl(filePath);

      // Guardar en tabla imagenes_productos
      await supabase.from('imagenes_productos').upsert({
        producto_codigo: productoCodigo,
        url: publicUrl,
        es_principal: true,
      }, {
        onConflict: 'producto_codigo',
      });

      // Si ya había una imagen anterior, eliminarla del storage
      if (currentImage) {
        const oldPath = currentImage.split('/').pop();
        if (oldPath) {
          await supabase.storage.from('productos').remove([`productos/${oldPath}`]);
        }
      }

      setCurrentImage(publicUrl);
      onImageChange?.(publicUrl);
    } catch (error: any) {
      console.error('Error uploading:', error);
      alert('Error al subir la imagen');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!currentImage) return;
    if (!confirm('¿Eliminar esta imagen?')) return;

    try {
      // Eliminar de la tabla
      await supabase
        .from('imagenes_productos')
        .delete()
        .eq('producto_codigo', productoCodigo);

      // Eliminar del storage
      const fileName = currentImage.split('/').pop();
      if (fileName) {
        await supabase.storage.from('productos').remove([`productos/${fileName}`]);
      }

      setCurrentImage(null);
      onImageChange?.(null);
    } catch (error) {
      console.error('Error removing:', error);
    }
  };

  return (
    <div className={cn('relative group', sizeClasses[size])}>
      {currentImage ? (
        <>
          <img
            src={currentImage}
            alt={productoCodigo}
            className={cn(
              'rounded-lg object-cover border border-slate-700',
              sizeClasses[size]
            )}
          />
          {editable && (
            <button
              onClick={handleRemove}
              className="absolute -top-2 -right-2 p-1 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X size={14} />
            </button>
          )}
        </>
      ) : (
        <button
          onClick={() => editable && fileInputRef.current?.click()}
          disabled={uploading || !editable}
          className={cn(
            'rounded-lg border-2 border-dashed border-slate-700 flex items-center justify-center transition-colors',
            sizeClasses[size],
            editable && 'hover:border-emerald-500/50 hover:bg-slate-800/50 cursor-pointer',
            !editable && 'cursor-default'
          )}
        >
          {uploading ? (
            <Loader2 size={20} className="text-slate-500 animate-spin" />
          ) : (
            <ImagePlus size={20} className="text-slate-500" />
          )}
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleUpload}
        className="hidden"
      />
    </div>
  );
}

// Componente para mostrar imagen en lista (solo lectura)
export function ProductThumbnail({ 
  imageUrl, 
  size = 'sm' 
}: { 
  imageUrl?: string | null; 
  size?: 'sm' | 'md';
}) {
  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-14 h-14',
  };

  if (!imageUrl) {
    return (
      <div className={cn(
        'rounded-lg bg-slate-800 flex items-center justify-center',
        sizeClasses[size]
      )}>
        <ImagePlus size={16} className="text-slate-600" />
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt=""
      className={cn(
        'rounded-lg object-cover border border-slate-700',
        sizeClasses[size]
      )}
    />
  );
}