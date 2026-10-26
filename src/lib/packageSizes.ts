export interface PackageSizeOption {
  code: string;
  name: string;
  rangeLabel: string;
  shortRangeLabel?: string;
  description: string;
  defaultWeight: string;
  defaultLength: string;
  defaultWidth: string;
  defaultHeight: string;
  color: string;
  bg: string;
  border: string;
  activeBg: string;
  activeBorder: string;
}

export const PACKAGE_SIZE_OPTIONS: PackageSizeOption[] = [
  {
    code: 'SMALL',
    name: 'Small',
    rangeLabel: 'Max 25 × 20 × 10 cm',
    shortRangeLabel: '25×20×10 cm',
    description: 'Pouches, cosmetics, accessories, small gadgets',
    defaultWeight: '1.0',
    defaultLength: '25.0',
    defaultWidth: '20.0',
    defaultHeight: '10.0',
    color: '#059669',
    bg: '#ecfdf5',
    border: '#a7f3d0',
    activeBg: '#d1fae5',
    activeBorder: '#10b981',
  },
  {
    code: 'MEDIUM',
    name: 'Med',
    rangeLabel: 'Max 40 × 30 × 20 cm',
    shortRangeLabel: '40×30×20 cm',
    description: 'Shoeboxes, small electronics, folded apparel packs',
    defaultWeight: '5.0',
    defaultLength: '40.0',
    defaultWidth: '30.0',
    defaultHeight: '20.0',
    color: '#2563eb',
    bg: '#eff6ff',
    border: '#bfdbfe',
    activeBg: '#dbeafe',
    activeBorder: '#3b82f6',
  },
  {
    code: 'LARGE',
    name: 'Large',
    rangeLabel: 'Max 60 × 45 × 35 cm',
    shortRangeLabel: '60×45×35 cm',
    description: 'Microwaves, bulk groceries, kitchen appliances',
    defaultWeight: '15.0',
    defaultLength: '60.0',
    defaultWidth: '45.0',
    defaultHeight: '35.0',
    color: '#7c3aed',
    bg: '#f5f3ff',
    border: '#ddd6fe',
    activeBg: '#ede9fe',
    activeBorder: '#8b5cf6',
  },
  {
    code: 'EXTRA_LARGE',
    name: 'XL',
    rangeLabel: 'Max 100 × 70 × 60 cm',
    shortRangeLabel: '100×70×60 cm',
    description: 'TVs, medium furniture, multi-item cartons',
    defaultWeight: '30.0',
    defaultLength: '100.0',
    defaultWidth: '70.0',
    defaultHeight: '60.0',
    color: '#d97706',
    bg: '#fffbeb',
    border: '#fde68a',
    activeBg: '#fef3c7',
    activeBorder: '#f59e0b',
  },
  {
    code: 'OVERSIZED',
    name: 'Oversized',
    rangeLabel: 'Max 180 × 120 × 100 cm',
    shortRangeLabel: '180×120×100 cm',
    description: 'Refrigerators, heavy appliances, large crates',
    defaultWeight: '80.0',
    defaultLength: '180.0',
    defaultWidth: '120.0',
    defaultHeight: '100.0',
    color: '#e11d48',
    bg: '#fff1f2',
    border: '#fecdd3',
    activeBg: '#ffe4e6',
    activeBorder: '#f43f5e',
  },
  {
    code: 'FREIGHT_CARGO',
    name: 'Freight / Cargo',
    rangeLabel: 'Pallet / Cargo (> 180 cm)',
    shortRangeLabel: 'Pallet / Cargo',
    description: 'Palletized cargo, industrial equipment, construction materials',
    defaultWeight: '250.0',
    defaultLength: '200.0',
    defaultWidth: '150.0',
    defaultHeight: '120.0',
    color: '#475569',
    bg: '#f1f5f9',
    border: '#cbd5e1',
    activeBg: '#e2e8f0',
    activeBorder: '#64748b',
  },
];

export function detectPackageTierCode(
  weight?: number | string | null,
  length?: number | string | null,
  width?: number | string | null,
  height?: number | string | null
): string {
  const l = Number(length) || 0;
  const wi = Number(width) || 0;
  const h = Number(height) || 0;

  if (l <= 0 && wi <= 0 && h <= 0) return '';

  const sorted = [l, wi, h].sort((a, b) => a - b);
  const maxDim = sorted[2];

  if (maxDim <= 25 && sorted[1] <= 20 && sorted[0] <= 10) return 'SMALL';
  if (maxDim <= 40 && sorted[1] <= 30 && sorted[0] <= 20) return 'MEDIUM';
  if (maxDim <= 60 && sorted[1] <= 45 && sorted[0] <= 35) return 'LARGE';
  if (maxDim <= 100 && sorted[1] <= 70 && sorted[0] <= 60) return 'EXTRA_LARGE';
  if (maxDim <= 180 && sorted[1] <= 120 && sorted[0] <= 100) return 'OVERSIZED';
  return 'FREIGHT_CARGO';
}
