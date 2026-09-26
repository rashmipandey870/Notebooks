/**
 * Supported Indian State & Central Boards Configuration
 * Maps API board codes to DIKSHA Sunbird framework board filter values.
 */

const BOARDS = [
  {
    code: 'CBSE',
    name: 'Central Board of Secondary Education (CBSE / NCERT)',
    dikshaFilter: 'CBSE',
    shortName: 'CBSE / NCERT',
    state: 'National',
    badgeColor: '#2563eb',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['English', 'Hindi', 'Urdu']
  },
  {
    code: 'UP',
    name: 'Uttar Pradesh Madhyamik Shiksha Parishad (UP Board)',
    dikshaFilter: 'State (Uttar Pradesh)',
    shortName: 'UP Board',
    state: 'Uttar Pradesh',
    badgeColor: '#dc2626',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['Hindi', 'English']
  },
  {
    code: 'MP',
    name: 'Madhya Pradesh Board of Secondary Education (MPBSE)',
    dikshaFilter: 'State (Madhya Pradesh)',
    shortName: 'MP Board',
    state: 'Madhya Pradesh',
    badgeColor: '#059669',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['Hindi', 'English']
  },
  {
    code: 'MH',
    name: 'Maharashtra State Board of Secondary and Higher Secondary Education',
    dikshaFilter: 'State (Maharashtra)',
    shortName: 'Maharashtra Board',
    state: 'Maharashtra',
    badgeColor: '#7c3aed',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['Marathi', 'English', 'Hindi', 'Urdu']
  },
  {
    code: 'BIHAR',
    name: 'Bihar School Examination Board (BSEB)',
    dikshaFilter: 'State (Bihar)',
    shortName: 'Bihar Board',
    state: 'Bihar',
    badgeColor: '#d97706',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['Hindi', 'English', 'Urdu']
  },
  {
    code: 'RJ',
    name: 'Board of Secondary Education, Rajasthan (RBSE)',
    dikshaFilter: 'State (Rajasthan)',
    shortName: 'Rajasthan Board',
    state: 'Rajasthan',
    badgeColor: '#ea580c',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['Hindi', 'English']
  },
  {
    code: 'TN',
    name: 'Tamil Nadu State Board of School Examination',
    dikshaFilter: 'State (Tamil Nadu)',
    shortName: 'Tamil Nadu Board',
    state: 'Tamil Nadu',
    badgeColor: '#0891b2',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['Tamil', 'English']
  },
  {
    code: 'KA',
    name: 'Karnataka School Examination and Assessment Board (KSEAB)',
    dikshaFilter: 'State (Karnataka)',
    shortName: 'Karnataka Board',
    state: 'Karnataka',
    badgeColor: '#4f46e5',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['Kannada', 'English', 'Hindi', 'Urdu']
  },
  {
    code: 'WB',
    name: 'West Bengal Board of Secondary Education (WBBSE)',
    dikshaFilter: 'State (West Bengal)',
    shortName: 'West Bengal Board',
    state: 'West Bengal',
    badgeColor: '#be123c',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['Bengali', 'English', 'Hindi']
  },
  {
    code: 'GJ',
    name: 'Gujarat Secondary and Higher Secondary Education Board (GSEB)',
    dikshaFilter: 'State (Gujarat)',
    shortName: 'Gujarat Board',
    state: 'Gujarat',
    badgeColor: '#15803d',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['Gujarati', 'English', 'Hindi']
  },
  {
    code: 'KL',
    name: 'Kerala State Education Board (KBPE)',
    dikshaFilter: 'State (Kerala)',
    shortName: 'Kerala Board',
    state: 'Kerala',
    badgeColor: '#0369a1',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['Malayalam', 'English']
  },
  {
    code: 'AP',
    name: 'Andhra Pradesh Board of Secondary Education (BSEAP)',
    dikshaFilter: 'State (Andhra Pradesh)',
    shortName: 'AP Board',
    state: 'Andhra Pradesh',
    badgeColor: '#854d0e',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['Telugu', 'English']
  },
  {
    code: 'TS',
    name: 'Telangana State Board of Secondary Education (BSET)',
    dikshaFilter: 'State (Telangana)',
    shortName: 'Telangana Board',
    state: 'Telangana',
    badgeColor: '#6b21a8',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['Telugu', 'English', 'Urdu']
  },
  {
    code: 'PB',
    name: 'Punjab School Education Board (PSEB)',
    dikshaFilter: 'State (Punjab)',
    shortName: 'Punjab Board',
    state: 'Punjab',
    badgeColor: '#991b1b',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['Punjabi', 'English', 'Hindi']
  }
];

function getBoardByCode(code) {
  if (!code) return null;
  const upper = code.trim().toUpperCase();
  return BOARDS.find(b => b.code === upper || b.shortName.toUpperCase().includes(upper) || b.dikshaFilter.toUpperCase().includes(upper));
}

module.exports = {
  BOARDS,
  getBoardByCode
};
