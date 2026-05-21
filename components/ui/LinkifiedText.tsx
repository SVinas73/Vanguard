'use client';

import React from 'react';

// Detecta URLs (http/https) y emails en texto plano y los convierte
// en <a> tags clickeables. Seguro: las URLs van a target=_blank con
// rel=noopener noreferrer.

const URL_REGEX = /(https?:\/\/[^\s<>"']+)/gi;

export function LinkifiedText({ text, className }: { text: string | null | undefined; className?: string }) {
  if (!text) return null;

  const partes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const regex = new RegExp(URL_REGEX);
  let i = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      partes.push(text.slice(lastIndex, match.index));
    }
    let href = match[0];
    // Limpieza: si la URL termina con puntuación común, separarla del link
    const ultimoChar = href.charAt(href.length - 1);
    if (['.', ',', ';', ':', ')', ']', '!', '?'].includes(ultimoChar)) {
      href = href.slice(0, -1);
      partes.push(
        <a
          key={`url-${i++}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 underline break-all"
        >
          {href}
        </a>,
      );
      partes.push(ultimoChar);
    } else {
      partes.push(
        <a
          key={`url-${i++}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 underline break-all"
        >
          {href}
        </a>,
      );
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    partes.push(text.slice(lastIndex));
  }

  return <span className={className} style={{ whiteSpace: 'pre-wrap' }}>{partes}</span>;
}
