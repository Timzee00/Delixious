export const NIGERIAN_STATES = [
  'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River',
  'Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe','Imo','Jigawa','Kaduna','Kano',
  'Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun',
  'Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'
];
const lookup = new Map(NIGERIAN_STATES.map(state => [state.toLowerCase(), state]));
export function normalizeNigerianState(value) {
  return typeof value === 'string' ? lookup.get(value.trim().toLowerCase()) || null : null;
}
