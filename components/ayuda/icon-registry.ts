// =====================================================
// Icon registry — mapea string names a componentes Lucide
// =====================================================
// Cada doc en docs-content.ts especifica su `icon` como
// string. Acá lo resolvemos al componente real.
//
// Si agregás un icono nuevo, importalo arriba y agregalo al map.
// =====================================================

import {
  Rocket,
  Network,
  LayoutDashboard,
  Briefcase,
  Package,
  ArrowLeftRight,
  ShoppingCart,
  Truck,
  Wallet,
  FileBarChart,
  Calculator,
  Warehouse,
  Building2,
  Building,
  Receipt,
  UserCircle2,
  Wrench,
  Kanban,
  Boxes,
  Cog,
  TrendingUp,
  Sparkles,
  RefreshCw,
  Activity,
  Bot,
  MessageCircle,
  MessageSquare,
  ShieldCheck,
  ShieldAlert,
  RotateCcw,
  CheckCircle2,
  QrCode,
  GitBranch,
  BadgeCheck,
  FileSearch,
  Plug,
  Users,
  Lock,
  AlertTriangle,
  HelpCircle,
  type LucideIcon,
} from 'lucide-react';

export const ICONS: Record<string, LucideIcon> = {
  Rocket, Network, LayoutDashboard, Briefcase, Package, ArrowLeftRight,
  ShoppingCart, Truck, Wallet, FileBarChart, Calculator, Warehouse,
  Building2, Building, Receipt, UserCircle2, Wrench, Kanban, Boxes, Cog,
  TrendingUp, Sparkles, RefreshCw, Activity, Bot, MessageCircle,
  MessageSquare, ShieldCheck, ShieldAlert, RotateCcw, CheckCircle2,
  QrCode, GitBranch, BadgeCheck, FileSearch, Plug, Users, Lock,
  AlertTriangle,
};

export function resolveIcon(name: string): LucideIcon {
  return ICONS[name] || HelpCircle;
}
