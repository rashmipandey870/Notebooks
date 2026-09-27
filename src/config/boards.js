/**
 * Supported Indian State & Central Boards Configuration (All 28 States + CBSE = 29 Boards)
 * Maps API board codes to DIKSHA Sunbird framework board filter values.
 * Every board includes 2-4 verified DIKSHA aliases and medium taxonomy mappings.
 */

const BOARDS = [
  // National Board
  {
    code: 'CBSE',
    name: 'Central Board of Secondary Education (CBSE / NCERT)',
    dikshaFilter: 'CBSE',
    dikshaAliases: ['CBSE', 'NCERT', 'CBSE/NCERT'],
    shortName: 'CBSE / NCERT',
    state: 'National',
    region: 'National',
    badgeColor: '#2563eb',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['English', 'Hindi', 'Urdu', 'Sanskrit', 'Bengali', 'Gujarati', 'Punjabi', 'Tamil', 'Assamese', 'Maithili'],
    dikshaMediumAliases: ['English', 'ENGLISH', 'Hindi', 'HINDI', 'Urdu', 'URDU', 'Sanskrit', 'SANKRIT', 'Bengali', 'Bangla', 'Gujarati', 'Punjabi', 'PUNJABI', 'Tamil', 'Assamese', 'Maithili']
  },

  // Northern States
  {
    code: 'UP',
    name: 'Uttar Pradesh Madhyamik Shiksha Parishad (UP Board)',
    dikshaFilter: 'State (Uttar Pradesh)',
    dikshaAliases: ['State (Uttar Pradesh)', 'Uttar Pradesh', 'UP Board', 'UPMSP'],
    shortName: 'UP Board',
    state: 'Uttar Pradesh',
    region: 'North',
    badgeColor: '#dc2626',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['Hindi', 'English'],
    dikshaMediumAliases: ['Hindi', 'HINDI', 'English', 'ENGLISH']
  },
  {
    code: 'HR',
    name: 'Board of School Education Haryana (BSEH / HBSE)',
    dikshaFilter: 'State (Haryana)',
    dikshaAliases: ['State (Haryana)', 'Haryana', 'BSEH', 'HBSE'],
    shortName: 'Haryana Board',
    state: 'Haryana',
    region: 'North',
    badgeColor: '#b91c1c',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['Hindi', 'English', 'Urdu', 'Punjabi'],
    dikshaMediumAliases: ['Hindi', 'HINDI', 'English', 'ENGLISH', 'Urdu', 'Punjabi', 'PUNJABI']
  },
  {
    code: 'HP',
    name: 'Himachal Pradesh Board of School Education (HPBOSE)',
    dikshaFilter: 'State (Himachal Pradesh)',
    dikshaAliases: ['State (Himachal Pradesh)', 'Himachal Pradesh', 'HPBOSE'],
    shortName: 'Himachal Board',
    state: 'Himachal Pradesh',
    region: 'North',
    badgeColor: '#0284c7',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['Hindi', 'English', 'Sanskrit'],
    dikshaMediumAliases: ['Hindi', 'HINDI', 'English', 'ENGLISH', 'Sanskrit']
  },
  {
    code: 'PB',
    name: 'Punjab School Education Board (PSEB)',
    dikshaFilter: 'State (Punjab)',
    dikshaAliases: ['State (Punjab)', 'Punjab', 'PSEB'],
    shortName: 'Punjab Board',
    state: 'Punjab',
    region: 'North',
    badgeColor: '#991b1b',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['Punjabi', 'English', 'Hindi'],
    dikshaMediumAliases: ['Punjabi', 'PUNJABI', 'punjabi', 'English', 'ENGLISH', 'Hindi', 'HINDI']
  },
  {
    code: 'UK',
    name: 'Uttarakhand Board of School Education (UBSE)',
    dikshaFilter: 'State (Uttarakhand)',
    dikshaAliases: ['State (Uttarakhand)', 'Uttarakhand', 'Uttaranchal', 'UBSE'],
    shortName: 'Uttarakhand Board',
    state: 'Uttarakhand',
    region: 'North',
    badgeColor: '#047857',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['Hindi', 'English'],
    dikshaMediumAliases: ['Hindi', 'HINDI', 'English', 'ENGLISH']
  },

  // Central States
  {
    code: 'MP',
    name: 'Madhya Pradesh Board of Secondary Education (MPBSE)',
    dikshaFilter: 'State (Madhya Pradesh)',
    dikshaAliases: ['State (Madhya Pradesh)', 'Madhya Pradesh', 'MPBSE'],
    shortName: 'MP Board',
    state: 'Madhya Pradesh',
    region: 'Central',
    badgeColor: '#059669',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['Hindi', 'English'],
    dikshaMediumAliases: ['Hindi', 'HINDI', 'English', 'ENGLISH']
  },
  {
    code: 'CG',
    name: 'Chhattisgarh Board of Secondary Education (CGBSE)',
    dikshaFilter: 'State (Chhattisgarh)',
    dikshaAliases: ['State (Chhattisgarh)', 'Chhattisgarh', 'CGBSE'],
    shortName: 'Chhattisgarh Board',
    state: 'Chhattisgarh',
    region: 'Central',
    badgeColor: '#16a34a',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['Hindi', 'English'],
    dikshaMediumAliases: ['Hindi', 'HINDI', 'English', 'ENGLISH']
  },

  // Western States
  {
    code: 'MH',
    name: 'Maharashtra State Board of Secondary and Higher Secondary Education (MSBSHSE)',
    dikshaFilter: 'State (Maharashtra)',
    dikshaAliases: ['State (Maharashtra)', 'Maharashtra', 'MSBSHSE'],
    shortName: 'Maharashtra Board',
    state: 'Maharashtra',
    region: 'West',
    badgeColor: '#7c3aed',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['Marathi', 'English', 'Hindi', 'Urdu', 'Kannada', 'Bengali', 'Gujarati'],
    dikshaMediumAliases: ['Marathi', 'MARATHI', 'English', 'ENGLISH', 'Hindi', 'HINDI', 'Urdu', 'URDU', 'Kannada', 'Bengali', 'Bangla', 'Gujarati']
  },
  {
    code: 'GJ',
    name: 'Gujarat Secondary and Higher Secondary Education Board (GSEB)',
    dikshaFilter: 'State (Gujarat)',
    dikshaAliases: ['State (Gujarat)', 'Gujarat', 'GSEB'],
    shortName: 'Gujarat Board',
    state: 'Gujarat',
    region: 'West',
    badgeColor: '#15803d',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['Gujarati', 'English', 'Hindi'],
    dikshaMediumAliases: ['Gujarati', 'Gujrati', 'gujarati', 'GUJARATI', 'English', 'ENGLISH', 'Hindi', 'HINDI']
  },
  {
    code: 'GA',
    name: 'Goa Board of Secondary and Higher Secondary Education (GBSHSE)',
    dikshaFilter: 'State (Goa)',
    dikshaAliases: ['State (Goa)', 'Goa', 'GBSHSE'],
    shortName: 'Goa Board',
    state: 'Goa',
    region: 'West',
    badgeColor: '#d97706',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['English', 'Marathi', 'Konkani', 'Sanskrit'],
    dikshaMediumAliases: ['English', 'ENGLISH', 'Marathi', 'Konkani', 'konakni', 'Sanskrit']
  },
  {
    code: 'RJ',
    name: 'Board of Secondary Education, Rajasthan (RBSE)',
    dikshaFilter: 'State (Rajasthan)',
    dikshaAliases: ['State (Rajasthan)', 'Rajasthan', 'RBSE'],
    shortName: 'Rajasthan Board',
    state: 'Rajasthan',
    region: 'West',
    badgeColor: '#ea580c',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['Hindi', 'English', 'Sanskrit'],
    dikshaMediumAliases: ['Hindi', 'HINDI', 'English', 'ENGLISH', 'Sanskrit', 'SANKRIT']
  },

  // Southern States
  {
    code: 'TN',
    name: 'Tamil Nadu State Board of School Examination (TNSCERT)',
    dikshaFilter: 'State (Tamil Nadu)',
    dikshaAliases: ['State (Tamil Nadu)', 'Tamil Nadu', 'TN', 'TNSCERT'],
    shortName: 'Tamil Nadu Board',
    state: 'Tamil Nadu',
    region: 'South',
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
    region: 'South',
    badgeColor: '#4f46e5',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['Kannada', 'English', 'Hindi', 'Marathi', 'Tamil', 'Telugu', 'Urdu', 'Sanskrit'],
    dikshaMediumAliases: ['Kannada', 'KANNADA', 'English', 'ENGLISH', 'Hindi', 'HINDI', 'Marathi', 'Tamil', 'Telugu', 'Urdu', 'Sanskrit']
  },
  {
    code: 'KL',
    name: 'Kerala State Education Board (KBPE / SCERT Kerala)',
    dikshaFilter: 'State (Kerala)',
    dikshaAliases: ['State (Kerala)', 'Kerala', 'KBPE'],
    shortName: 'Kerala Board',
    state: 'Kerala',
    region: 'South',
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
    region: 'South',
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
    region: 'South',
    badgeColor: '#6b21a8',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['Telugu', 'English', 'Urdu', 'Tamil', 'Hindi', 'Kannada', 'Marathi', 'Bengali'],
    dikshaMediumAliases: ['Telugu', 'TELUGU', 'English', 'ENGLISH', 'Urdu', 'Tamil', 'Hindi', 'Kannada', 'Marathi', 'Bengali', 'Bangla']
  },

  // Eastern States
  {
    code: 'WB',
    name: 'West Bengal Board of Secondary Education (WBBSE)',
    dikshaFilter: 'State (West Bengal)',
    dikshaAliases: ['State (West Bengal)', 'West Bengal', 'WBBSE'],
    shortName: 'West Bengal Board',
    state: 'West Bengal',
    region: 'East',
    badgeColor: '#be123c',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['Bengali', 'English', 'Hindi'],
    dikshaMediumAliases: ['Bengali', 'Bangla', 'bengali', 'BENGALI', 'English', 'ENGLISH', 'Hindi', 'HINDI']
  },
  {
    code: 'BIHAR',
    name: 'Bihar School Examination Board (BSEB)',
    dikshaFilter: 'State (Bihar)',
    dikshaAliases: ['State (Bihar)', 'Bihar', 'BSEB'],
    shortName: 'Bihar Board',
    state: 'Bihar',
    region: 'East',
    badgeColor: '#d97706',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['Hindi', 'English', 'Urdu', 'Arabi', 'Pharsi'],
    dikshaMediumAliases: ['Hindi', 'HINDI', 'English', 'ENGLISH', 'Urdu', 'URDU', 'Arabi', 'Arabic', 'Pharsi', 'Persian']
  },
  {
    code: 'JH',
    name: 'Jharkhand Academic Council (JAC)',
    dikshaFilter: 'State (Jharkhand)',
    dikshaAliases: ['State (Jharkhand)', 'Jharkhand', 'JAC'],
    shortName: 'Jharkhand Board',
    state: 'Jharkhand',
    region: 'East',
    badgeColor: '#c026d3',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['Hindi', 'English', 'Urdu', 'Santali'],
    dikshaMediumAliases: ['Hindi', 'HINDI', 'English', 'ENGLISH', 'Urdu', 'Santali', 'santhali']
  },
  {
    code: 'OD',
    name: 'Board of Secondary Education, Odisha (BSE Odisha / CHSE)',
    dikshaFilter: 'State (Odisha)',
    dikshaAliases: ['State (Odisha)', 'Odisha', 'Orissa', 'State (Orissa)', 'BSE Odisha', 'CHSE'],
    shortName: 'Odisha Board',
    state: 'Odisha',
    region: 'East',
    badgeColor: '#059669',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['Odia', 'English'],
    dikshaMediumAliases: ['Odia', 'Oriya', 'odia', 'oriya', 'English', 'ENGLISH']
  },

  // Northeastern States
  {
    code: 'AS',
    name: 'Secondary Education Board of Assam (SEBA) / AHSEC',
    dikshaFilter: 'State (Assam)',
    dikshaAliases: ['State (Assam)', 'Assam', 'SEBA', 'AHSEC'],
    shortName: 'Assam Board',
    state: 'Assam',
    region: 'Northeast',
    badgeColor: '#4338ca',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['Assamese', 'English', 'Bodo', 'Hindi', 'Bengali'],
    dikshaMediumAliases: ['Assamese', 'English', 'ENGLISH', 'Bodo', 'Hindi', 'Bengali', 'Bangla']
  },
  {
    code: 'AR',
    name: 'Board of Secondary Education, Arunachal Pradesh (BOSEAP)',
    dikshaFilter: 'State (Arunachal Pradesh)',
    dikshaAliases: ['State (Arunachal Pradesh)', 'Arunachal Pradesh', 'BOSEAP'],
    shortName: 'Arunachal Board',
    state: 'Arunachal Pradesh',
    region: 'Northeast',
    badgeColor: '#0e7490',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['English', 'Hindi'],
    dikshaMediumAliases: ['English', 'ENGLISH', 'Hindi', 'HINDI']
  },
  {
    code: 'MN',
    name: 'Board of Secondary Education, Manipur (BOSEM / COHSEM)',
    dikshaFilter: 'State (Manipur)',
    dikshaAliases: ['State (Manipur)', 'Manipur', 'BOSEM', 'COHSEM'],
    shortName: 'Manipur Board',
    state: 'Manipur',
    region: 'Northeast',
    badgeColor: '#6d28d9',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['English', 'Manipuri', 'Hindi'],
    dikshaMediumAliases: ['English', 'ENGLISH', 'Manipuri', 'Hindi']
  },
  {
    code: 'ML',
    name: 'Meghalaya Board of School Education (MBOSE)',
    dikshaFilter: 'State (Meghalaya)',
    dikshaAliases: ['State (Meghalaya)', 'Meghalaya', 'MBOSE'],
    shortName: 'Meghalaya Board',
    state: 'Meghalaya',
    region: 'Northeast',
    badgeColor: '#0f766e',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['English', 'Khasi', 'Garo'],
    dikshaMediumAliases: ['English', 'ENGLISH', 'Khasi', 'Garo']
  },
  {
    code: 'MZ',
    name: 'Mizoram Board of School Education (MBSE)',
    dikshaFilter: 'State (Mizoram)',
    dikshaAliases: ['State (Mizoram)', 'Mizoram', 'MBSE'],
    shortName: 'Mizoram Board',
    state: 'Mizoram',
    region: 'Northeast',
    badgeColor: '#a21caf',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['Mizo', 'English', 'Hindi'],
    dikshaMediumAliases: ['Mizo', 'English', 'ENGLISH', 'Hindi']
  },
  {
    code: 'NL',
    name: 'Nagaland Board of School Education (NBSE)',
    dikshaFilter: 'State (Nagaland)',
    dikshaAliases: ['State (Nagaland)', 'Nagaland', 'NBSE'],
    shortName: 'Nagaland Board',
    state: 'Nagaland',
    region: 'Northeast',
    badgeColor: '#be185d',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['English'],
    dikshaMediumAliases: ['English', 'ENGLISH']
  },
  {
    code: 'SK',
    name: 'Sikkim State Board / Education Department (Sikkim / CBSE)',
    dikshaFilter: 'State (Sikkim)',
    dikshaAliases: ['State (Sikkim)', 'Sikkim', 'CBSE-Sikkim'],
    shortName: 'Sikkim Board',
    state: 'Sikkim',
    region: 'Northeast',
    badgeColor: '#b45309',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['English', 'Nepali'],
    dikshaMediumAliases: ['English', 'ENGLISH', 'Nepali']
  },
  {
    code: 'TR',
    name: 'Tripura Board of Secondary Education (TBSE)',
    dikshaFilter: 'State (Tripura)',
    dikshaAliases: ['State (Tripura)', 'Tripura', 'TBSE'],
    shortName: 'Tripura Board',
    state: 'Tripura',
    region: 'Northeast',
    badgeColor: '#1d4ed8',
    supportedClasses: ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'],
    supportedMediums: ['Bengali', 'English', 'Kokborok'],
    dikshaMediumAliases: ['Bengali', 'Bangla', 'English', 'ENGLISH', 'Kokborok']
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
