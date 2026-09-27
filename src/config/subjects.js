/**
 * Class 8 to Class 12 Subject Taxonomy & Mediums
 */

const CLASSES = ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'];

const SUBJECTS_BY_CLASS = {
  'Class 8': [
    { code: 'MATH', name: 'Mathematics', stream: 'General' },
    { code: 'SCI', name: 'Science', stream: 'General' },
    { code: 'SOC', name: 'Social Science', stream: 'General' },
    { code: 'ENG', name: 'English', stream: 'Languages' },
    { code: 'HIN', name: 'Hindi', stream: 'Languages' },
    { code: 'SST_HIST', name: 'History', stream: 'Social Science' },
    { code: 'SST_GEO', name: 'Geography', stream: 'Social Science' },
    { code: 'SST_CIV', name: 'Civics / Political Science', stream: 'Social Science' }
  ],
  'Class 9': [
    { code: 'MATH', name: 'Mathematics', stream: 'General' },
    { code: 'SCI', name: 'Science', stream: 'General' },
    { code: 'SOC', name: 'Social Science', stream: 'General' },
    { code: 'ENG', name: 'English', stream: 'Languages' },
    { code: 'HIN', name: 'Hindi', stream: 'Languages' },
    { code: 'HIST', name: 'India and the Contemporary World I (History)', stream: 'Social Science' },
    { code: 'GEO', name: 'Contemporary India I (Geography)', stream: 'Social Science' },
    { code: 'POL', name: 'Democratic Politics I', stream: 'Social Science' },
    { code: 'ECO', name: 'Economics', stream: 'Social Science' }
  ],
  'Class 10': [
    { code: 'MATH', name: 'Mathematics', stream: 'General' },
    { code: 'SCI', name: 'Science', stream: 'General' },
    { code: 'SOC', name: 'Social Science', stream: 'General' },
    { code: 'ENG', name: 'English', stream: 'Languages' },
    { code: 'HIN', name: 'Hindi', stream: 'Languages' },
    { code: 'HIST', name: 'India and the Contemporary World II (History)', stream: 'Social Science' },
    { code: 'GEO', name: 'Contemporary India II (Geography)', stream: 'Social Science' },
    { code: 'POL', name: 'Democratic Politics II', stream: 'Social Science' },
    { code: 'ECO', name: 'Understanding Economic Development', stream: 'Social Science' }
  ],
  'Class 11': [
    { code: 'PHY', name: 'Physics', stream: 'Science' },
    { code: 'CHEM', name: 'Chemistry', stream: 'Science' },
    { code: 'BIO', name: 'Biology', stream: 'Science' },
    { code: 'MATH', name: 'Mathematics', stream: 'Science/Commerce' },
    { code: 'CS', name: 'Computer Science / IP', stream: 'Science/Commerce' },
    { code: 'ACC', name: 'Accountancy', stream: 'Commerce' },
    { code: 'BST', name: 'Business Studies', stream: 'Commerce' },
    { code: 'ECO', name: 'Economics', stream: 'Commerce/Arts' },
    { code: 'HIST', name: 'Themes in World History', stream: 'Arts' },
    { code: 'POL', name: 'Political Theory & Indian Constitution', stream: 'Arts' },
    { code: 'ENG', name: 'English Core / Elective', stream: 'Languages' },
    { code: 'HIN', name: 'Hindi Core / Elective', stream: 'Languages' }
  ],
  'Class 12': [
    { code: 'PHY', name: 'Physics', stream: 'Science' },
    { code: 'CHEM', name: 'Chemistry', stream: 'Science' },
    { code: 'BIO', name: 'Biology', stream: 'Science' },
    { code: 'MATH', name: 'Mathematics', stream: 'Science/Commerce' },
    { code: 'CS', name: 'Computer Science / IP', stream: 'Science/Commerce' },
    { code: 'ACC', name: 'Accountancy', stream: 'Commerce' },
    { code: 'BST', name: 'Business Studies', stream: 'Commerce' },
    { code: 'ECO', name: 'Macroeconomics & Indian Economic Development', stream: 'Commerce/Arts' },
    { code: 'HIST', name: 'Themes in Indian History', stream: 'Arts' },
    { code: 'POL', name: 'Contemporary World Politics & Politics in India', stream: 'Arts' },
    { code: 'ENG', name: 'English Core / Elective', stream: 'Languages' },
    { code: 'HIN', name: 'Hindi Core / Elective', stream: 'Languages' }
  ]
};

const MEDIUMS = [
  { code: 'English', name: 'English Medium' },
  { code: 'Hindi', name: 'Hindi Medium (हिंदी माध्यम)' },
  { code: 'Marathi', name: 'Marathi Medium (मराठी माध्यम)' },
  { code: 'Tamil', name: 'Tamil Medium (தமிழ் வழி)' },
  { code: 'Telugu', name: 'Telugu Medium (తెలుగు మాధ్యమం)' },
  { code: 'Kannada', name: 'Kannada Medium (ಕನ್ನಡ ಮಾಧ್ಯಮ)' },
  { code: 'Bengali', name: 'Bengali Medium (বাংলা মাধ্যম)' },
  { code: 'Gujarati', name: 'Gujarati Medium (ગુજરાતી માધ્યમ)' },
  { code: 'Urdu', name: 'Urdu Medium (اردو ذریعہ)' },
  { code: 'Malayalam', name: 'Malayalam Medium (മലയാളം മാധ്യമം)' },
  { code: 'Punjabi', name: 'Punjabi Medium (ਪੰਜਾਬੀ ਮਾਧਿਅਮ)' },
  { code: 'Odia', name: 'Odia Medium (ଓଡ଼ିଆ ମାଧ୍ୟମ)' },
  { code: 'Assamese', name: 'Assamese Medium (অসমীয়া মাধ্যম)' },
  { code: 'Konkani', name: 'Konkani Medium (कोंकणी माध्यम)' },
  { code: 'Manipuri', name: 'Manipuri Medium (ꯃꯩꯇꯩꯂꯣꯟ)' },
  { code: 'Khasi', name: 'Khasi Medium (Ka Ktien Khasi)' },
  { code: 'Garo', name: 'Garo Medium (A·chik kusa)' },
  { code: 'Mizo', name: 'Mizo Medium (Mizo ṭawng)' },
  { code: 'Santali', name: 'Santali Medium (ᱥᱟᱱᱛᱟᱲᱤ)' },
  { code: 'Kokborok', name: 'Kokborok Medium (Kokborok)' },
  { code: 'Bodo', name: 'Bodo Medium (बर\' माध्यम)' },
  { code: 'Nepali', name: 'Nepali Medium (नेपाली माध्यम)' }
];

module.exports = {
  CLASSES,
  SUBJECTS_BY_CLASS,
  MEDIUMS
};
