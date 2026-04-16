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
