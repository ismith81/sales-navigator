// Default branchelijst voor cases. Wordt bij eerste seed in app_config.branches gezet.
// Daarna beheerbaar via SQL (Supabase → app_config → key='branches') of later via een
// eigen beheer-UI. Platte lijst van labels — branches zijn feiten over de klant,
// geen strategische mapping, dus géén match-redenen per branche.
export const DEFAULT_BRANCHES = [
  'Financial services',
  'Onderwijs',
  'Retail & e-commerce',
  'Industrie & manufacturing',
  'Overheid & non-profit',
  'Zorg',
  'Energy & utilities',
  'Logistiek & transport',
  'Professional services',
];
