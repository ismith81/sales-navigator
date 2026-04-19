import React from 'react';
import {
  Briefcase, Crown, Users, User, UserCog, Target,
  BarChart3, LineChart, Database, Server, Cpu, Cog,
  Code2, Rocket, Lightbulb, Brain, Shield, Scale,
  Compass, Flag, Handshake, DollarSign, TrendingUp,
  Presentation, ClipboardList, Headphones, Megaphone,
  Wrench, GraduationCap, Building2,
} from 'lucide-react';

/**
 * Curated set Lucide-icons die passen bij persona-rollen in een B2B data-
 * sales context. Stroke-SVG 2px round — lijnt met de rest van de app.
 *
 * Opgeslagen in Supabase als string-key (bv. "briefcase"). Backwards-compat:
 * oude waardes (emoji of losse letters) blijven gewoon renderen als tekst.
 */
export const PERSONA_ICONS = {
  briefcase: { label: 'Executive', Icon: Briefcase },
  crown: { label: 'Leider', Icon: Crown },
  users: { label: 'Team', Icon: Users },
  user: { label: 'Persoon', Icon: User },
  usercog: { label: 'Manager', Icon: UserCog },
  target: { label: 'Doel', Icon: Target },
  barchart: { label: 'Analyse', Icon: BarChart3 },
  linechart: { label: 'Trend', Icon: LineChart },
  database: { label: 'Data', Icon: Database },
  server: { label: 'Infra', Icon: Server },
  cpu: { label: 'Architect', Icon: Cpu },
  cog: { label: 'Operatie', Icon: Cog },
  code: { label: 'Developer', Icon: Code2 },
  rocket: { label: 'Innovatie', Icon: Rocket },
  lightbulb: { label: 'Strategie', Icon: Lightbulb },
  brain: { label: 'AI / ML', Icon: Brain },
  shield: { label: 'Security', Icon: Shield },
  scale: { label: 'Compliance', Icon: Scale },
  compass: { label: 'Navigator', Icon: Compass },
  flag: { label: 'Ambitie', Icon: Flag },
  handshake: { label: 'Sales', Icon: Handshake },
  dollar: { label: 'Finance', Icon: DollarSign },
  trending: { label: 'Groei', Icon: TrendingUp },
  presentation: { label: 'Presentatie', Icon: Presentation },
  clipboard: { label: 'Planning', Icon: ClipboardList },
  headphones: { label: 'Support', Icon: Headphones },
  megaphone: { label: 'Marketing', Icon: Megaphone },
  wrench: { label: 'Engineer', Icon: Wrench },
  graduation: { label: 'Training', Icon: GraduationCap },
  building: { label: 'Organisatie', Icon: Building2 },
};

export const PERSONA_ICON_KEYS = Object.keys(PERSONA_ICONS);

/**
 * Backwards-compat: map veelgebruikte emoji's naar de dichtstbijzijnde
 * Lucide-key. Zodat bestaande personas in Supabase (die nog emoji-strings
 * als icon opgeslagen hebben) automatisch renderen in de nieuwe stijl.
 */
const EMOJI_TO_KEY = {
  '🧭': 'compass',
  '🛠️': 'wrench',
  '🛠': 'wrench',
  '📊': 'barchart',
  '📈': 'trending',
  '⚙️': 'cog',
  '⚙': 'cog',
  '👤': 'user',
  '👥': 'users',
  '👔': 'briefcase',
  '💼': 'briefcase',
  '🎯': 'target',
  '💡': 'lightbulb',
  '🚀': 'rocket',
  '🧠': 'brain',
  '🛡️': 'shield',
  '🛡': 'shield',
  '⚖️': 'scale',
  '⚖': 'scale',
  '🤝': 'handshake',
  '💰': 'dollar',
  '💻': 'code',
  '🖥️': 'server',
  '🖥': 'server',
  '🏢': 'building',
  '🎓': 'graduation',
  '🎤': 'megaphone',
  '📋': 'clipboard',
  '🎧': 'headphones',
  '👑': 'crown',
  '🚩': 'flag',
  '🔧': 'wrench',
};

/**
 * Render een persona-icon. Accepteert:
 *  - een bekende key uit PERSONA_ICONS → Lucide SVG
 *  - een oude waarde (emoji/losse letter) → gewoon als tekst renderen
 *  - niets → fallback User-icon
 */
export function PersonaIcon({
  name,
  size = 18,
  strokeWidth = 2,
  className,
  style,
}) {
  const resolved = name && (PERSONA_ICONS[name] ? name : EMOJI_TO_KEY[name]);
  const entry = resolved && PERSONA_ICONS[resolved];
  if (entry) {
    const { Icon } = entry;
    return (
      <Icon
        size={size}
        strokeWidth={strokeWidth}
        className={className}
        style={style}
        aria-hidden="true"
      />
    );
  }
  if (name) {
    return (
      <span className={className} style={style} aria-hidden="true">
        {name}
      </span>
    );
  }
  return (
    <User
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      style={style}
      aria-hidden="true"
    />
  );
}
