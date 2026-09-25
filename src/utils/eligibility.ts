export const ELIGIBILITY_OPTIONS = [
  { value: 'BOTH', label: 'All Categories (Both)'  },
  { value: 'PLUS_TWO_ONLY', label: '+2 Students Only' },
  { value: 'DEGREE_ONLY', label: 'Degree Students Only' },
];
export function eligibilityLabel(value?: string, category?: { name: string }) {
  if (category) return `${category.name} Only`;
  return ELIGIBILITY_OPTIONS.find(option => option.value === value)?.label ?? 'Both Categories';
}

export function educationLabel(value?: string, category?: { name: string }) {
  if (category) return category.name;
  return value === 'PLUS_TWO' ? '+2 Completed' : value === 'DEGREE' ? 'Degree Completed' : 'Not set';
}
