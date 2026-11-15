export const BUSINESS_TYPES = [
  { value: 'restaurant', label: 'Restaurants', singular: 'Restaurant', icon: 'utensils' },
  { value: 'bakery', label: 'Bakeries', singular: 'Bakery', icon: 'chef-hat' },
  { value: 'cakes_desserts', label: 'Cakes & desserts', singular: 'Cakes & desserts', icon: 'sparkles' },
  { value: 'parfait_yogurt', label: 'Parfait & yoghurt', singular: 'Parfait & yoghurt', icon: 'cup-soda' },
  { value: 'snacks_small_chops', label: 'Snacks & small chops', singular: 'Snacks & small chops', icon: 'sandwich' },
  { value: 'ice_cream_frozen', label: 'Ice cream & frozen treats', singular: 'Ice cream & frozen treats', icon: 'ice-cream' },
  { value: 'drinks_beverages', label: 'Drinks & beverages', singular: 'Drinks & beverages', icon: 'coffee' },
  { value: 'catering', label: 'Catering', singular: 'Catering', icon: 'cooking-pot' },
  { value: 'grocery_foods', label: 'Food essentials', singular: 'Food essentials', icon: 'store' },
];

export const BUSINESS_TYPE_LABELS = Object.freeze(
  Object.fromEntries(BUSINESS_TYPES.map(type => [type.value, type.label]))
);

export function businessTypeLabel(value) {
  return BUSINESS_TYPES.find(type => type.value === value)?.label || value;
}
