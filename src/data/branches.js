// Default branchelijst — gedeeld door cases (mapping.branches), team-leden
// (sectors), én de cv-parse-endpoint (enum-constraint op Gemini-extractie).
// Wordt bij eerste seed in app_config.branches gezet. Daarna beheerbaar via
// SQL (Supabase → app_config → key='branches') of later via een eigen beheer-UI.
// Platte lijst van labels — branches zijn feiten over de klant, geen
// strategische mapping, dus géén match-redenen per branche.
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
  // Toegevoegd 2026-04 — dekt NACE-secties die in NL data-consultancy
  // voorkomen maar ontbraken: ICT/Telecom/Media (NACE J), Bouw + Vastgoed
  // (NACE F+L), Agri+Food (NACE A+C deel-voedingsmiddelen), Cultuur &
  // recreatie (NACE R).
  'Telecom & media',
  'Bouw & vastgoed',
  'Agri & food',
  'Cultuur & recreatie',
];
