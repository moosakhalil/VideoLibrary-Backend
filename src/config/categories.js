// Canonical, fixed list of construction video categories.
// Order here is the display order used everywhere (admin dropdown, customer filter).
export const CATEGORIES = [
  'Structural & Groundwork',
  'Carpentry & Formwork',
  'Waterproofing & Roofing',
  'Electrical & Smart Home',
  'Plumbing & Drainage',
  'Surfaces & Finishes',
  'Doors, Windows & Glazing',
  'HVAC & Ventilation',
  'Exterior Works & Landscaping',
  'Interior Fit-Out & Furnishing',
  'Safety, Fire Protection & Compliance',
  'Maintenance, Repair & Renovation',
  'Construction Planning & Site Management',
  'Masonry & Brickwork',
  'Sustainable & Green Building Systems',
  'Smart Building & Automation Systems',
  'Heavy Equipment & Site Operations',
  'Pools, Water Features & Outdoor Structures',
  'Industrial & Commercial Construction',
  'Estimating, Costing & Quantity Surveying',
];

// Rank used to keep DB/category rows in canonical order regardless of insert time.
export const categoryRank = (name) => {
  const i = CATEGORIES.indexOf(name);
  return i === -1 ? CATEGORIES.length : i;
};
