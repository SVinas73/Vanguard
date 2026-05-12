'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, Sparkles, ShieldCheck, BarChart3, Brain, Warehouse,
  Wrench, Users, Zap, Globe, Lock, FileText, CheckCircle2,
  Activity, Boxes, MessageCircle, GitBranch, Truck, ChevronDown,
} from 'lucide-react';
import { Logo } from '@/components/ui/Logo';

// =====================================================
// Landing Page — Vanguard
// =====================================================
// Pensada para conversión: hero con CTA, prueba social,
// features ordenadas por importancia, demos visuales,
// pricing simple, CTA final. Animaciones discretas via
// IntersectionObserver (sin librerías externas).
// =====================================================

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => e.isIntersecting && setVisible(true)),
      { threshold: 0.15 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

const FEATURES = [
  { icon: Warehouse, title: 'WMS Enterprise',     desc: 'Recepción, picking por olas, pack y dispatch con métricas por operador.',         color: 'blue' },
  { icon: Brain,     title: 'IA omnisciente',     desc: 'Asistente que lee todo el sistema y responde como un experto. Predicciones reales.', color: 'violet' },
  { icon: ShieldCheck, title: 'Seguridad bancaria', desc: 'Rate limiting, hash chain anti-tampering, RBAC granular, auditoría completa.',   color: 'emerald' },
  { icon: BarChart3, title: 'Reportes ejecutivos', desc: 'Dashboards multi-almacén, KPIs en vivo, exportación a PDF/Excel.',                color: 'cyan' },
  { icon: Wrench,    title: 'Post-venta integral',desc: 'Taller, garantías, tickets y RMA conectados con trazabilidad serial.',             color: 'amber' },
  { icon: Users,     title: 'RRHH integrado',     desc: 'Equipo, asistencia, licencias y vacaciones desde el mismo panel.',                 color: 'pink' },
  { icon: FileText,  title: 'Facturación electrónica', desc: 'CFE Uruguay incluido. NF-e Brasil, AFIP Argentina via integración.',          color: 'orange' },
  { icon: Globe,     title: 'API-First & Webhooks',desc: 'REST documentada con OpenAPI 3.1. Webhooks con reintentos exponenciales.',        color: 'sky' },
];

const STATS = [
  { value: '50+',  label: 'módulos integrados' },
  { value: '13+',  label: 'migraciones de base' },
  { value: '99.9%', label: 'uptime objetivo' },
  { value: '<200ms', label: 'queries promedio' },
];

const MODULES = [
  'Stock & Movimientos', 'WMS Enterprise', 'Comercial (CRM + Ventas)',
  'Compras & Proveedores', 'Facturación electrónica', 'Taller & Garantías',
  'Tickets de soporte', 'RMA & Devoluciones', 'Cliente 360°', 'Proyectos',
  'BOM & Ensamblajes', 'QMS (Calidad)', 'Seriales & Trazabilidad', 'Aprobaciones',
  'Demand Planning IA', 'Analytics IA', 'Reportes ejecutivos',
  'RRHH (Equipo, asistencia, licencias)', 'Costos FIFO', 'Auditoría inmutable',
  'API REST + Webhooks', 'Integraciones eCommerce',
];

const PLANS = [
  {
    name: 'Starter', price: 'US$ 149', period: '/mes', highlight: false,
    desc: 'Equipos hasta 10 usuarios',
    features: ['Stock + Movimientos', 'Ventas + Compras', 'Hasta 2 almacenes', '5GB storage', 'Soporte por email'],
  },
  {
    name: 'Business', price: 'US$ 449', period: '/mes', highlight: true,
    desc: 'Equipos hasta 50 usuarios',
    features: ['Todo de Starter', 'WMS Enterprise', 'IA & Analytics', 'Almacenes ilimitados', 'Facturación electrónica', 'API REST', 'Soporte prioritario'],
  },
  {
    name: 'Enterprise', price: 'A medida', period: '', highlight: false,
    desc: 'Operaciones complejas',
    features: ['Todo de Business', 'RRHH integrado', 'Webhooks ilimitados', 'SLA 99.9%', 'On-premise opcional', 'Implementación dedicada'],
  },
];

const COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
  blue:    { bg: 'bg-blue-500/10',    text: 'text-blue-300',    border: 'border-blue-500/30' },
  violet:  { bg: 'bg-violet-500/10',  text: 'text-violet-300',  border: 'border-violet-500/30' },
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-300', border: 'border-emerald-500/30' },
  cyan:    { bg: 'bg-cyan-500/10',    text: 'text-cyan-300',    border: 'border-cyan-500/30' },
  amber:   { bg: 'bg-amber-500/10',   text: 'text-amber-300',   border: 'border-amber-500/30' },
  pink:    { bg: 'bg-pink-500/10',    text: 'text-pink-300',    border: 'border-pink-500/30' },
  orange:  { bg: 'bg-orange-500/10',  text: 'text-orange-300',  border: 'border-orange-500/30' },
  sky:     { bg: 'bg-sky-500/10',     text: 'text-sky-300',     border: 'border-sky-500/30' },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 overflow-x-hidden">
      {/* Animated grid background */}
      <div className="fixed inset-0 -z-10 opacity-[0.04]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }} />
      {/* Radial glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] -z-10"
        style={{ background: 'radial-gradient(ellipse at center, rgba(59,130,246,0.15) 0%, transparent 70%)' }} />

      <Nav />
      <Hero />
      <Stats />
      <Features />
      <ModulesSection />
      <Showcase />
      <Pricing />
      <FinalCTA />
      <Footer />
    </div>
  );
}

// =====================================================
// NAV
// =====================================================
function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/50' : ''}`}>
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <Logo size={36} />
          <span className="text-lg font-semibold tracking-tight">Vanguard</span>
        </Link>
        <div className="hidden md:flex items-center gap-8 text-sm text-slate-400">
          <a href="#features" className="hover:text-white transition-colors">Características</a>
          <a href="#modules"  className="hover:text-white transition-colors">Módulos</a>
          <a href="#pricing"  className="hover:text-white transition-colors">Precios</a>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors">
            Ingresar
          </Link>
          <Link href="/login" className="px-4 py-2 bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-400 hover:to-emerald-400 text-white rounded-lg text-sm font-medium transition-all hover:scale-105 shadow-lg shadow-blue-500/20">
            Probar gratis
          </Link>
        </div>
      </div>
    </nav>
  );
}

// =====================================================
// HERO
// =====================================================
function Hero() {
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  return (
    <section className="relative min-h-screen flex items-center justify-center pt-24 pb-12"
      onMouseMove={e => setMouse({ x: e.clientX, y: e.clientY })}>
      {/* Spotlight que sigue el mouse */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          background: `radial-gradient(600px circle at ${mouse.x}px ${mouse.y}px, rgba(59,130,246,0.08), transparent 80%)`,
        }}
      />

      <div className="relative max-w-5xl mx-auto px-6 text-center">
        {/* Pre-headline */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-700/50 bg-slate-900/50 backdrop-blur mb-8 animate-fade-in-up">
          <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-xs text-slate-300">Plataforma de gestión de nueva generación</span>
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-7xl font-bold tracking-tighter leading-[1.05] mb-6 animate-fade-in-up animation-delay-100">
          <span className="block text-slate-100">El ERP que tu equipo</span>
          <span className="block bg-gradient-to-r from-blue-400 via-cyan-300 to-emerald-400 bg-clip-text text-transparent">
            quiere usar
          </span>
        </h1>

        <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in-up animation-delay-200">
          Inventario, WMS, ventas, post-venta y RRHH en una sola plataforma.
          Con IA omnisciente, seguridad bancaria y API completa.
          Hecha para PyMEs que quieren operar como Fortune 500.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16 animate-fade-in-up animation-delay-300">
          <Link href="/login" className="group inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-400 hover:to-emerald-400 text-white rounded-xl font-semibold transition-all hover:scale-105 shadow-2xl shadow-blue-500/30">
            Empezar gratis
            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <a href="#features" className="inline-flex items-center gap-2 px-6 py-3 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white rounded-xl font-medium transition-all">
            Ver características
          </a>
        </div>

        {/* Hero visual: mock card */}
        <div className="relative max-w-4xl mx-auto animate-fade-in-up animation-delay-500">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-cyan-500/20 to-emerald-500/20 blur-3xl rounded-3xl" />
          <div className="relative rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl p-6 shadow-2xl">
            <div className="flex items-center gap-2 mb-4 pb-4 border-b border-slate-800">
              <span className="w-3 h-3 rounded-full bg-red-500/60" />
              <span className="w-3 h-3 rounded-full bg-amber-500/60" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/60" />
              <span className="ml-3 text-xs text-slate-500">vanguard.app — Dashboard</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[
                { icon: Activity, label: 'Movimientos hoy', value: '247', accent: 'text-emerald-300' },
                { icon: Boxes,    label: 'Valor inventario', value: '$ 1.2M', accent: 'text-blue-300' },
                { icon: Zap,      label: 'Predicciones IA', value: '18', accent: 'text-violet-300' },
              ].map((s) => {
                const I = s.icon;
                return (
                  <div key={s.label} className="p-4 rounded-xl border border-slate-800 bg-slate-950/60">
                    <I className={`h-4 w-4 mb-2 ${s.accent}`} />
                    <div className="text-2xl font-bold text-slate-100">{s.value}</div>
                    <div className="text-xs text-slate-500 mt-1">{s.label}</div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 h-32 rounded-xl bg-slate-950/60 border border-slate-800 relative overflow-hidden">
              <svg viewBox="0 0 400 100" className="absolute inset-0 w-full h-full">
                <defs>
                  <linearGradient id="chart-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"  stopColor="#10b981" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M 0 80 Q 50 70, 100 60 T 200 40 T 300 30 T 400 20 L 400 100 L 0 100 Z"
                      fill="url(#chart-grad)" />
                <path d="M 0 80 Q 50 70, 100 60 T 200 40 T 300 30 T 400 20"
                      stroke="#10b981" strokeWidth="2" fill="none" />
              </svg>
            </div>
          </div>
        </div>

        {/* Scroll hint */}
        <a href="#features" className="absolute bottom-8 left-1/2 -translate-x-1/2 text-slate-600 hover:text-slate-400 transition-colors animate-bounce">
          <ChevronDown className="h-6 w-6" />
        </a>
      </div>
    </section>
  );
}

// =====================================================
// STATS BANNER
// =====================================================
function Stats() {
  const { ref, visible } = useReveal();
  return (
    <section ref={ref} className={`py-16 border-y border-slate-800/50 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
        {STATS.map((s, i) => (
          <div key={s.label} style={{ transitionDelay: `${i * 80}ms` }} className="space-y-1">
            <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
              {s.value}
            </div>
            <div className="text-xs text-slate-500 uppercase tracking-wider">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// =====================================================
// FEATURES GRID
// =====================================================
function Features() {
  return (
    <section id="features" className="py-24">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tighter mb-4">
            Todo lo que necesitás. <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">Sin compromisos.</span>
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Diseñada como las plataformas de Fortune 500, pero pensada para PyMEs que recién arrancan.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((f, i) => <FeatureCard key={f.title} feature={f} index={i} />)}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ feature, index }: { feature: typeof FEATURES[number]; index: number }) {
  const { ref, visible } = useReveal();
  const Icon = feature.icon;
  const c = COLOR_MAP[feature.color];
  return (
    <div
      ref={ref}
      className={`group p-6 rounded-2xl border border-slate-800 bg-slate-900/40 hover:bg-slate-900/70 backdrop-blur transition-all duration-500 hover:-translate-y-1 hover:shadow-xl ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
      style={{ transitionDelay: `${index * 60}ms` }}
    >
      <div className={`inline-flex p-3 rounded-xl ${c.bg} ${c.text} mb-4 group-hover:scale-110 transition-transform`}>
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-lg font-semibold text-slate-100 mb-2">{feature.title}</h3>
      <p className="text-sm text-slate-400 leading-relaxed">{feature.desc}</p>
    </div>
  );
}

// =====================================================
// MODULES LIST
// =====================================================
function ModulesSection() {
  const { ref, visible } = useReveal();
  return (
    <section id="modules" ref={ref} className={`py-24 transition-all duration-700 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tighter mb-4">
            <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">22 módulos</span> integrados
          </h2>
          <p className="text-slate-400">Un solo sistema. Una sola base de datos. Cero silos de información.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {MODULES.map((m, i) => (
            <div
              key={m}
              className="flex items-center gap-2 p-3 rounded-lg border border-slate-800 bg-slate-900/30 hover:bg-slate-900/60 hover:border-slate-700 transition-colors"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
              <span className="text-sm text-slate-300">{m}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// =====================================================
// SHOWCASE — destacados gráficos
// =====================================================
function Showcase() {
  const items = [
    {
      title: 'IA omnisciente que entiende tu negocio',
      desc: 'Pregúntale al asistente "¿qué productos van a faltar la semana próxima?" y consulta el sistema en tiempo real para responderte con datos.',
      icon: Brain, accent: 'violet',
      visual: (
        <div className="space-y-2 text-xs font-mono text-slate-300">
          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
            <span className="text-violet-300">{'>'}</span> ¿Cuál es el margen real del producto X?
          </div>
          <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
            <span className="text-emerald-300">IA:</span> Margen bruto 34.2% (FIFO). Aumentó 4.1pp vs mes anterior por baja de costo del proveedor Y.
          </div>
        </div>
      ),
    },
    {
      title: 'Anti-estrés inteligente',
      desc: 'El sistema detecta cuando estás sobrecargado y te sugiere activar Focus Mode. Nunca lo activa solo — siempre pregunta primero.',
      icon: Sparkles, accent: 'pink',
      visual: (
        <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-pink-300" />
            <span className="text-sm font-semibold text-pink-200">Notamos mucha actividad...</span>
            <span className="ml-auto text-xs px-2 py-0.5 rounded bg-red-500/30 text-red-200 font-bold">87/100</span>
          </div>
          <p className="text-xs text-slate-400">8 notificaciones críticas · 6 aprobaciones · 180 min sin pausa</p>
        </div>
      ),
    },
    {
      title: 'Multi-almacén nativo',
      desc: 'Stock, costos y valuación independientes por almacén. Transferencias internas con trazabilidad y reportes consolidados.',
      icon: Warehouse, accent: 'blue',
      visual: (
        <div className="space-y-1.5 text-xs">
          {[
            { name: 'Casa central',    pct: 64, color: 'bg-blue-500' },
            { name: 'Sucursal Norte',  pct: 23, color: 'bg-cyan-500' },
            { name: 'Depósito',        pct: 13, color: 'bg-emerald-500' },
          ].map(a => (
            <div key={a.name}>
              <div className="flex justify-between mb-0.5">
                <span className="text-slate-300">{a.name}</span>
                <span className="text-slate-500 font-mono">{a.pct}%</span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full ${a.color}`} style={{ width: `${a.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      ),
    },
  ];

  return (
    <section className="py-24">
      <div className="max-w-7xl mx-auto px-6 space-y-16">
        {items.map((item, idx) => <ShowcaseRow key={item.title} item={item} flipped={idx % 2 === 1} />)}
      </div>
    </section>
  );
}

function ShowcaseRow({ item, flipped }: { item: any; flipped: boolean }) {
  const { ref, visible } = useReveal();
  const Icon = item.icon;
  const c = COLOR_MAP[item.accent];
  return (
    <div
      ref={ref}
      className={`grid grid-cols-1 md:grid-cols-2 gap-8 items-center transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
    >
      <div className={flipped ? 'md:order-2' : ''}>
        <div className={`inline-flex p-2.5 rounded-xl ${c.bg} ${c.text} mb-4`}>
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="text-3xl font-bold tracking-tight mb-3">{item.title}</h3>
        <p className="text-slate-400 leading-relaxed">{item.desc}</p>
      </div>
      <div className={`relative ${flipped ? 'md:order-1' : ''}`}>
        <div className={`absolute -inset-4 ${c.bg} blur-3xl rounded-3xl`} />
        <div className="relative p-6 rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur">
          {item.visual}
        </div>
      </div>
    </div>
  );
}

// =====================================================
// PRICING
// =====================================================
function Pricing() {
  return (
    <section id="pricing" className="py-24">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tighter mb-4">
            Planes simples. <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">Sin sorpresas.</span>
          </h2>
          <p className="text-slate-400">Empezá gratis. Pagás solo cuando el sistema te ahorra más que su costo.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {PLANS.map(p => (
            <div key={p.name}
              className={`relative p-6 rounded-2xl border transition-all hover:-translate-y-1
                ${p.highlight
                  ? 'border-blue-500/50 bg-gradient-to-br from-blue-500/10 to-emerald-500/5 shadow-2xl shadow-blue-500/10'
                  : 'border-slate-800 bg-slate-900/40'}`}>
              {p.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 text-white text-xs font-bold">
                  Más popular
                </div>
              )}
              <h3 className="text-xl font-bold text-slate-100">{p.name}</h3>
              <p className="text-sm text-slate-500 mt-1">{p.desc}</p>
              <div className="mt-4 mb-6">
                <span className="text-4xl font-bold text-slate-100">{p.price}</span>
                <span className="text-sm text-slate-500">{p.period}</span>
              </div>
              <ul className="space-y-2 mb-6">
                {p.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
                    <CheckCircle2 className={`h-4 w-4 mt-0.5 flex-shrink-0 ${p.highlight ? 'text-emerald-300' : 'text-emerald-400'}`} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/login"
                className={`block w-full text-center py-2.5 rounded-xl font-medium transition-all
                  ${p.highlight
                    ? 'bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-400 hover:to-emerald-400 text-white'
                    : 'border border-slate-700 hover:border-slate-600 text-slate-200'}`}>
                Empezar
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// =====================================================
// FINAL CTA
// =====================================================
function FinalCTA() {
  const { ref, visible } = useReveal();
  return (
    <section ref={ref} className={`py-24 transition-all duration-700 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
      <div className="max-w-4xl mx-auto px-6">
        <div className="relative rounded-3xl overflow-hidden border border-slate-800 bg-gradient-to-br from-blue-500/10 via-cyan-500/10 to-emerald-500/10 p-12 text-center">
          <div className="absolute inset-0 -z-10"
            style={{ background: 'radial-gradient(ellipse at center, rgba(59,130,246,0.15) 0%, transparent 70%)' }} />
          <h2 className="text-4xl md:text-5xl font-bold tracking-tighter mb-4">
            Listos para empezar?
          </h2>
          <p className="text-slate-300 mb-8 max-w-xl mx-auto">
            Sin tarjeta, sin compromiso. Probá Vanguard hoy y conocé cómo opera tu negocio el resto de tus días.
          </p>
          <Link href="/login" className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-400 hover:to-emerald-400 text-white rounded-xl font-semibold text-lg transition-all hover:scale-105 shadow-2xl shadow-blue-500/30">
            Empezar gratis
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

// =====================================================
// FOOTER
// =====================================================
function Footer() {
  return (
    <footer className="border-t border-slate-800/50 py-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Logo size={28} />
            <span className="text-sm font-semibold">Vanguard</span>
            <span className="text-xs text-slate-600">© {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-slate-500">
            <a href="#features" className="hover:text-slate-300 transition-colors">Características</a>
            <a href="#pricing"  className="hover:text-slate-300 transition-colors">Precios</a>
            <Link href="/login" className="hover:text-slate-300 transition-colors">Ingresar</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
