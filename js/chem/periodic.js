// Periodic table data for Z = 1 to 36.
// Sources: Pauling electronegativity and first ionisation energy (kJ/mol) as tabulated in the CRC Handbook;
// covalent radii (pm) from Cordero et al., Dalton Trans. 2008 (low-spin values for Mn, Fe, Co; sp³ for C).
// Noble gases have no Pauling electronegativity (null).

// [symbol, name, group, period, category, electronegativity, ionisation energy, covalent radius]
const DATA = [
  ['H', 'Hydrogen', 1, 1, 'nonmetal', 2.20, 1312, 31],
  ['He', 'Helium', 18, 1, 'noble', null, 2372, 28],
  ['Li', 'Lithium', 1, 2, 'alkali', 0.98, 520, 128],
  ['Be', 'Beryllium', 2, 2, 'alkaline', 1.57, 900, 96],
  ['B', 'Boron', 13, 2, 'metalloid', 2.04, 801, 84],
  ['C', 'Carbon', 14, 2, 'nonmetal', 2.55, 1086, 76],
  ['N', 'Nitrogen', 15, 2, 'nonmetal', 3.04, 1402, 71],
  ['O', 'Oxygen', 16, 2, 'nonmetal', 3.44, 1314, 66],
  ['F', 'Fluorine', 17, 2, 'halogen', 3.98, 1681, 57],
  ['Ne', 'Neon', 18, 2, 'noble', null, 2081, 58],
  ['Na', 'Sodium', 1, 3, 'alkali', 0.93, 496, 166],
  ['Mg', 'Magnesium', 2, 3, 'alkaline', 1.31, 738, 141],
  ['Al', 'Aluminium', 13, 3, 'post', 1.61, 578, 121],
  ['Si', 'Silicon', 14, 3, 'metalloid', 1.90, 787, 111],
  ['P', 'Phosphorus', 15, 3, 'nonmetal', 2.19, 1012, 107],
  ['S', 'Sulfur', 16, 3, 'nonmetal', 2.58, 1000, 105],
  ['Cl', 'Chlorine', 17, 3, 'halogen', 3.16, 1251, 102],
  ['Ar', 'Argon', 18, 3, 'noble', null, 1521, 106],
  ['K', 'Potassium', 1, 4, 'alkali', 0.82, 419, 203],
  ['Ca', 'Calcium', 2, 4, 'alkaline', 1.00, 590, 176],
  ['Sc', 'Scandium', 3, 4, 'transition', 1.36, 633, 170],
  ['Ti', 'Titanium', 4, 4, 'transition', 1.54, 659, 160],
  ['V', 'Vanadium', 5, 4, 'transition', 1.63, 651, 153],
  ['Cr', 'Chromium', 6, 4, 'transition', 1.66, 653, 139],
  ['Mn', 'Manganese', 7, 4, 'transition', 1.55, 717, 139],
  ['Fe', 'Iron', 8, 4, 'transition', 1.83, 762, 132],
  ['Co', 'Cobalt', 9, 4, 'transition', 1.88, 760, 126],
  ['Ni', 'Nickel', 10, 4, 'transition', 1.91, 737, 124],
  ['Cu', 'Copper', 11, 4, 'transition', 1.90, 745, 132],
  ['Zn', 'Zinc', 12, 4, 'transition', 1.65, 906, 122],
  ['Ga', 'Gallium', 13, 4, 'post', 1.81, 579, 122],
  ['Ge', 'Germanium', 14, 4, 'metalloid', 2.01, 762, 120],
  ['As', 'Arsenic', 15, 4, 'metalloid', 2.18, 947, 119],
  ['Se', 'Selenium', 16, 4, 'nonmetal', 2.55, 941, 120],
  ['Br', 'Bromine', 17, 4, 'halogen', 2.96, 1140, 120],
  ['Kr', 'Krypton', 18, 4, 'noble', 3.00, 1351, 116],
];

export const ELEMENTS = DATA.map(([symbol, name, group, period, category, en, ie, radius], i) => ({ z: i + 1, symbol, name, group, period, category, en, ie, radius }));
export const bySymbol = (s) => ELEMENTS.find((e) => e.symbol === s);

export const PROPERTIES = {
  radius: { name: 'Atomic radius', unit: 'pm', key: 'radius', trend: 'Gets <b>smaller across</b> a period (more protons pull the same shell in) and <b>bigger down</b> a group (more shells).' },
  en: { name: 'Electronegativity', unit: '(Pauling)', key: 'en', trend: 'Rises <b>across</b> a period and falls <b>down</b> a group. Fluorine pulls shared electrons hardest of all.' },
  ie: { name: 'Ionisation energy', unit: 'kJ/mol', key: 'ie', trend: 'Energy to pull off the outermost electron. Rises <b>across</b> a period, falls <b>down</b> a group. Noble gases are highest.' },
};

export const CATEGORIES = {
  alkali: ['Alkali metal', 0xf87171], alkaline: ['Alkaline earth metal', 0xfb923c], transition: ['Transition metal', 0xfacc15],
  post: ['Post-transition metal', 0x94a3b8], metalloid: ['Metalloid', 0x2dd4bf], nonmetal: ['Non-metal', 0x60a5fa],
  halogen: ['Halogen', 0xa78bfa], noble: ['Noble gas', 0xf472b6],
};
