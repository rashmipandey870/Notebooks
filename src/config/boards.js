/**
 * Supported Indian State & Central Boards Configuration
 * Maps API board codes to DIKSHA Sunbird framework board filter values.
 * Includes verified DIKSHA medium taxonomy aliases (e.g., Bengali/Bangla, Odia/Oriya, Arabi/Arabic, Pharsi/Persian).
 */

const BOARDS = [
  {
    code: 'CBSE',
    name: 'Central Board of Secondary Education (CBSE / NCERT)',
    dikshaFilter: 'CBSE',
    dikshaAliases: ['CBSE', 'NCERT', 'CBSE/NCERT'],
    shortName: 'CBSE / NCERT',
    state: 'National',
    badgeColor: '#2563eb',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['English', 'Hindi', 'Urdu', 'Sanskrit', 'Bengali', 'Gujarati', 'Punjabi', 'Tamil', 'Assamese', 'Maithili'],
    dikshaMediumAliases: ['English', 'ENGLISH', 'Hindi', 'HINDI', 'Urdu', 'URDU', 'Sanskrit', 'SANKRIT', 'Bengali', 'Bangla', 'Gujarati', 'Punjabi', 'PUNJABI', 'Tamil', 'Assamese', 'Maithili']
  },
  {
    code: 'UP',
    name: 'Uttar Pradesh Madhyamik Shiksha Parishad (UP Board)',
    dikshaFilter: 'State (Uttar Pradesh)',
    dikshaAliases: ['State (Uttar Pradesh)', 'Uttar Pradesh', 'UP Board'],
    shortName: 'UP Board',
    state: 'Uttar Pradesh',
    badgeColor: '#dc2626',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['Hindi', 'English'],
    dikshaMediumAliases: ['Hindi', 'HINDI', 'English', 'ENGLISH']
  },
  {
    code: 'MP',
    name: 'Madhya Pradesh Board of Secondary Education (MPBSE)',
    dikshaFilter: 'State (Madhya Pradesh)',
    dikshaAliases: ['State (Madhya Pradesh)', 'Madhya Pradesh', 'MPBSE'],
    shortName: 'MP Board',
    state: 'Madhya Pradesh',
    badgeColor: '#059669',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['Hindi', 'English'],
    dikshaMediumAliases: ['Hindi', 'HINDI', 'English', 'ENGLISH']
  },
  {
    code: 'MH',
    name: 'Maharashtra State Board of Secondary and Higher Secondary Education',
    dikshaFilter: 'State (Maharashtra)',
    dikshaAliases: ['State (Maharashtra)', 'Maharashtra', 'MSBSHSE'],
    shortName: 'Maharashtra Board',
    state: 'Maharashtra',
    badgeColor: '#7c3aed',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['Marathi', 'English', 'Hindi', 'Urdu', 'Kannada', 'Bengali', 'Gujarati'],
    dikshaMediumAliases: ['Marathi', 'MARATHI', 'English', 'ENGLISH', 'Hindi', 'HINDI', 'Urdu', 'URDU', 'Kannada', 'Bengali', 'Bangla', 'Gujarati']
  },
  {
    code: 'BIHAR',
    name: 'Bihar School Examination Board (BSEB)',
    dikshaFilter: 'State (Bihar)',
    dikshaAliases: ['State (Bihar)', 'Bihar', 'BSEB'],
    shortName: 'Bihar Board',
    state: 'Bihar',
    badgeColor: '#d97706',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['Hindi', 'English', 'Urdu', 'Arabi', 'Pharsi'],
    dikshaMediumAliases: ['Hindi', 'HINDI', 'English', 'ENGLISH', 'Urdu', 'URDU', 'Arabi', 'Arabic', 'Pharsi', 'Persian']
  },
  {
    code: 'RJ',
    name: 'Board of Secondary Education, Rajasthan (RBSE)',
    dikshaFilter: 'State (Rajasthan)',
    dikshaAliases: ['State (Rajasthan)', 'Rajasthan', 'RBSE'],
    shortName: 'Rajasthan Board',
    state: 'Rajasthan',
    badgeColor: '#ea580c',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['Hindi', 'English', 'Sanskrit'],
    dikshaMediumAliases: ['Hindi', 'HINDI', 'English', 'ENGLISH', 'Sanskrit', 'SANKRIT']
  },
  {
    code: 'TN',
    name: 'Tamil Nadu State Board of School Examination',
    dikshaFilter: 'State (Tamil Nadu)',
    dikshaAliases: ['State (Tamil Nadu)', 'Tamil Nadu', 'TN'],
    shortName: 'Tamil Nadu Board',
    state: 'Tamil Nadu',
    badgeColor: '#0891b2',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['Tamil', 'English'],
    dikshaMediumAliases: ['Tamil', 'TAMIL', 'English', 'ENGLISH']
  },
  {
    code: 'KA',
    name: 'Karnataka School Examination and Assessment Board (KSEAB)',
    dikshaFilter: 'State (Karnataka)',
    dikshaAliases: ['State (Karnataka)', 'Karnataka', 'KSEAB'],
    shortName: 'Karnataka Board',
    state: 'Karnataka',
    badgeColor: '#4f46e5',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['Kannada', 'English', 'Hindi', 'Marathi', 'Tamil', 'Telugu', 'Urdu', 'Sanskrit'],
    dikshaMediumAliases: ['Kannada', 'KANNADA', 'English', 'ENGLISH', 'Hindi', 'HINDI', 'Marathi', 'Tamil', 'Telugu', 'Urdu', 'Sanskrit']
  },
  {
    code: 'WB',
    name: 'West Bengal Board of Secondary Education (WBBSE)',
    dikshaFilter: 'State (West Bengal)',
    dikshaAliases: ['State (West Bengal)', 'West Bengal', 'WBBSE'],
    shortName: 'West Bengal Board',
    state: 'West Bengal',
    badgeColor: '#be123c',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['Bengali', 'English', 'Hindi'],
    dikshaMediumAliases: ['Bengali', 'Bangla', 'bengali', 'BENGALI', 'English', 'ENGLISH', 'Hindi', 'HINDI']
  },
  {
    code: 'GJ',
    name: 'Gujarat Secondary and Higher Secondary Education Board (GSEB)',
    dikshaFilter: 'State (Gujarat)',
    dikshaAliases: ['State (Gujarat)', 'Gujarat', 'GSEB'],
    shortName: 'Gujarat Board',
    state: 'Gujarat',
    badgeColor: '#15803d',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['Gujarati', 'English', 'Hindi'],
    dikshaMediumAliases: ['Gujarati', 'Gujrati', 'gujarati', 'GUJARATI', 'English', 'ENGLISH', 'Hindi', 'HINDI']
  },
  {
    code: 'KL',
    name: 'Kerala State Education Board (KBPE)',
    dikshaFilter: 'State (Kerala)',
    dikshaAliases: ['State (Kerala)', 'Kerala', 'KBPE'],
    shortName: 'Kerala Board',
    state: 'Kerala',
    badgeColor: '#0369a1',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['Malayalam', 'English', 'Urdu', 'Sanskrit', 'Kannada', 'Arabic'],
    dikshaMediumAliases: ['Malayalam', 'MALAYALAM', 'English', 'ENGLISH', 'Urdu', 'Sanskrit', 'Kannada', 'Arabic', 'Arabi']
  },
  {
    code: 'AP',
    name: 'Andhra Pradesh Board of Secondary Education (BSEAP)',
    dikshaFilter: 'State (Andhra Pradesh)',
    dikshaAliases: ['State (Andhra Pradesh)', 'Andhra Pradesh', 'BSEAP'],
    shortName: 'AP Board',
    state: 'Andhra Pradesh',
    badgeColor: '#854d0e',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['Telugu', 'English', 'Tamil', 'Kannada', 'Oriya', 'Urdu', 'Sanskrit'],
    dikshaMediumAliases: ['Telugu', 'TELUGU', 'English', 'ENGLISH', 'Tamil', 'Kannada', 'Oriya', 'Odia', 'Urdu', 'Sanskrit']
  },
  {
    code: 'TS',
    name: 'Telangana State Board of Secondary Education (BSET)',
    dikshaFilter: 'State (Telangana)',
    dikshaAliases: ['State (Telangana)', 'Telangana', 'BSET'],
    shortName: 'Telangana Board',
    state: 'Telangana',
    badgeColor: '#6b21a8',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['Telugu', 'English', 'Urdu', 'Tamil', 'Hindi', 'Kannada', 'Marathi', 'Bengali'],
    dikshaMediumAliases: ['Telugu', 'TELUGU', 'English', 'ENGLISH', 'Urdu', 'Tamil', 'Hindi', 'Kannada', 'Marathi', 'Bengali', 'Bangla']
  },
  {
    code: 'PB',
    name: 'Punjab School Education Board (PSEB)',
    dikshaFilter: 'State (Punjab)',
    dikshaAliases: ['State (Punjab)', 'Punjab', 'PSEB'],
    shortName: 'Punjab Board',
    state: 'Punjab',
    badgeColor: '#991b1b',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['Punjabi', 'English', 'Hindi'],
    dikshaMediumAliases: ['Punjabi', 'PUNJABI', 'punjabi', 'English', 'ENGLISH', 'Hindi', 'HINDI']
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
