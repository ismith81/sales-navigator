export const DEFAULT_FILTERS = {
  doelen: ['Meer waarde halen uit data', 'Data als business model'],
  behoeften: ['Veilig en betrouwbaar', 'Wendbaar', 'AI ready', 'Realtime data'],
  diensten: ['Data modernisatie', 'Governance', 'Data kwaliteit', 'Training'],
};

// Kept for backward compat — components should use the dynamic filters prop instead
export const FILTERS = DEFAULT_FILTERS;

export const TAB_CONFIG = {
  doelen: { label: '🎯 Doelen', singular: 'doel' },
  behoeften: { label: '💡 Behoeften', singular: 'behoefte' },
  diensten: { label: '🔧 Diensten', singular: 'dienst' },
};

// Voorbeeld-pijnpunten per behoefte (klanttaal tegenover de abstracte behoefte).
// Gebruikt als eerste vulling zodat Gersy gelijk iets ziet — kan via Beheer aangepast worden.
export const DEFAULT_PAINPOINTS = {
  'Veilig en betrouwbaar': '<ul><li>"Data klopt niet"</li><li>"Niemand vertrouwt de cijfers"</li></ul>',
  'Wendbaar': '<ul><li>"Excel is onhoudbaar"</li><li>"Elke wijziging kost weken"</li></ul>',
  'AI ready': '<ul><li>"AI-projecten lopen vast op slechte data"</li><li>"Geen fundament voor AI"</li></ul>',
  'Realtime data': '<ul><li>"Rapportages duren dagen"</li><li>"Stuurinformatie loopt achter"</li></ul>',
};
