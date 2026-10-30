// Worldwide Geographical Data Service for Country -> State/Province -> City/Place Hierarchy

export interface CountryItem {
  code: string;
  name: string;
}

// Comprehensive Worldwide Countries List (ISO-3166)
export const WORLD_COUNTRIES: CountryItem[] = [
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'IN', name: 'India' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'QA', name: 'Qatar' },
  { code: 'KW', name: 'Kuwait' },
  { code: 'BH', name: 'Bahrain' },
  { code: 'OM', name: 'Oman' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'SG', name: 'Singapore' },
  { code: 'EG', name: 'Egypt' },
  { code: 'JO', name: 'Jordan' },
  { code: 'LB', name: 'Lebanon' },
  { code: 'TR', name: 'Turkey' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'KE', name: 'Kenya' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'TH', name: 'Thailand' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'PH', name: 'Philippines' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'LK', name: 'Sri Lanka' },
  { code: 'CN', name: 'China' },
  { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'South Korea' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'DK', name: 'Denmark' },
  { code: 'FI', name: 'Finland' },
  { code: 'IE', name: 'Ireland' },
  { code: 'BE', name: 'Belgium' },
  { code: 'AT', name: 'Austria' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'PT', name: 'Portugal' },
  { code: 'PL', name: 'Poland' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'RO', name: 'Romania' },
  { code: 'GR', name: 'Greece' },
  { code: 'HU', name: 'Hungary' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
  { code: 'AR', name: 'Argentina' },
  { code: 'CL', name: 'Chile' },
  { code: 'CO', name: 'Colombia' },
  { code: 'PE', name: 'Peru' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'RU', name: 'Russia' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'IL', name: 'Israel' },
  { code: 'IQ', name: 'Iraq' },
  { code: 'DZ', name: 'Algeria' },
  { code: 'MA', name: 'Morocco' },
  { code: 'TN', name: 'Tunisia' },
  { code: 'GH', name: 'Ghana' },
  { code: 'ET', name: 'Ethiopia' },
  { code: 'TZ', name: 'Tanzania' },
  { code: 'UG', name: 'Uganda' },
  { code: 'AF', name: 'Afghanistan' },
  { code: 'AL', name: 'Albania' },
  { code: 'AD', name: 'Andorra' },
  { code: 'AO', name: 'Angola' },
  { code: 'AG', name: 'Antigua and Barbuda' },
  { code: 'AM', name: 'Armenia' },
  { code: 'AZ', name: 'Azerbaijan' },
  { code: 'BS', name: 'Bahamas' },
  { code: 'BB', name: 'Barbados' },
  { code: 'BY', name: 'Belarus' },
  { code: 'BZ', name: 'Belize' },
  { code: 'BJ', name: 'Benin' },
  { code: 'BT', name: 'Bhutan' },
  { code: 'BO', name: 'Bolivia' },
  { code: 'BA', name: 'Bosnia and Herzegovina' },
  { code: 'BW', name: 'Botswana' },
  { code: 'BN', name: 'Brunei' },
  { code: 'BG', name: 'Bulgaria' },
  { code: 'BF', name: 'Burkina Faso' },
  { code: 'BI', name: 'Burundi' },
  { code: 'CV', name: 'Cabo Verde' },
  { code: 'KH', name: 'Cambodia' },
  { code: 'CM', name: 'Cameroon' },
  { code: 'CF', name: 'Central African Republic' },
  { code: 'TD', name: 'Chad' },
  { code: 'KM', name: 'Comoros' },
  { code: 'CG', name: 'Congo' },
  { code: 'CR', name: 'Costa Rica' },
  { code: 'HR', name: 'Croatia' },
  { code: 'CU', name: 'Cuba' },
  { code: 'CY', name: 'Cyprus' },
  { code: 'DJ', name: 'Djibouti' },
  { code: 'DM', name: 'Dominica' },
  { code: 'DO', name: 'Dominican Republic' },
  { code: 'EC', name: 'Ecuador' },
  { code: 'SV', name: 'El Salvador' },
  { code: 'GQ', name: 'Equatorial Guinea' },
  { code: 'ER', name: 'Eritrea' },
  { code: 'EE', name: 'Estonia' },
  { code: 'SZ', name: 'Eswatini' },
  { code: 'FJ', name: 'Fiji' },
  { code: 'GA', name: 'Gabon' },
  { code: 'GM', name: 'Gambia' },
  { code: 'GE', name: 'Georgia' },
  { code: 'GD', name: 'Grenada' },
  { code: 'GT', name: 'Guatemala' },
  { code: 'GN', name: 'Guinea' },
  { code: 'GW', name: 'Guinea-Bissau' },
  { code: 'GY', name: 'Guyana' },
  { code: 'HT', name: 'Haiti' },
  { code: 'HN', name: 'Honduras' },
  { code: 'IS', name: 'Iceland' },
  { code: 'IR', name: 'Iran' },
  { code: 'JM', name: 'Jamaica' },
  { code: 'KZ', name: 'Kazakhstan' },
  { code: 'KG', name: 'Kyrgyzstan' },
  { code: 'LA', name: 'Laos' },
  { code: 'LV', name: 'Latvia' },
  { code: 'LR', name: 'Liberia' },
  { code: 'LY', name: 'Libya' },
  { code: 'LI', name: 'Liechtenstein' },
  { code: 'LT', name: 'Lithuania' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'MG', name: 'Madagascar' },
  { code: 'MW', name: 'Malawi' },
  { code: 'MV', name: 'Maldives' },
  { code: 'ML', name: 'Mali' },
  { code: 'MT', name: 'Malta' },
  { code: 'MR', name: 'Mauritania' },
  { code: 'MU', name: 'Mauritius' },
  { code: 'MD', name: 'Moldova' },
  { code: 'MC', name: 'Monaco' },
  { code: 'MN', name: 'Mongolia' },
  { code: 'ME', name: 'Montenegro' },
  { code: 'MZ', name: 'Mozambique' },
  { code: 'MM', name: 'Myanmar' },
  { code: 'NA', name: 'Namibia' },
  { code: 'NP', name: 'Nepal' },
  { code: 'NI', name: 'Nicaragua' },
  { code: 'NE', name: 'Niger' },
  { code: 'MK', name: 'North Macedonia' },
  { code: 'PA', name: 'Panama' },
  { code: 'PG', name: 'Papua New Guinea' },
  { code: 'PY', name: 'Paraguay' },
  { code: 'RW', name: 'Rwanda' },
  { code: 'SN', name: 'Senegal' },
  { code: 'RS', name: 'Serbia' },
  { code: 'SC', name: 'Seychelles' },
  { code: 'SL', name: 'Sierra Leone' },
  { code: 'SK', name: 'Slovakia' },
  { code: 'SI', name: 'Slovenia' },
  { code: 'SO', name: 'Somalia' },
  { code: 'SS', name: 'South Sudan' },
  { code: 'SD', name: 'Sudan' },
  { code: 'SR', name: 'Suriname' },
  { code: 'SY', name: 'Syria' },
  { code: 'TW', name: 'Taiwan' },
  { code: 'TJ', name: 'Tajikistan' },
  { code: 'TG', name: 'Togo' },
  { code: 'TT', name: 'Trinidad and Tobago' },
  { code: 'TM', name: 'Turkmenistan' },
  { code: 'UY', name: 'Uruguay' },
  { code: 'UZ', name: 'Uzbekistan' },
  { code: 'VE', name: 'Venezuela' },
  { code: 'YE', name: 'Yemen' },
  { code: 'ZM', name: 'Zambia' },
  { code: 'ZW', name: 'Zimbabwe' },
];

// Rich state and city data dictionary indexed by canonical country name (lowercase)
export const STATE_CITY_DATABASE: Record<string, Record<string, string[]>> = {
  'india': {
    'Kerala': [
      'Kochi', 'Kozhikode', 'Thrissur', 'Malappuram', 'Thiruvananthapuram', 
      'Kollam', 'Palakkad', 'Alappuzha', 'Kannur', 'Kottayam', 
      'Kasaragod', 'Pathanamthitta', 'Idukki', 'Wayanad', 'Manjeri', 
      'Ponnani', 'Vatakara', 'Kanhangad', 'Payyanur', 'Thalassery', 'Changanassery'
    ],
    'Karnataka': [
      'Bengaluru', 'Mysuru', 'Mangaluru', 'Hubballi', 'Belagavi', 
      'Davanagere', 'Ballari', 'Vijayapura', 'Shivamogga', 'Tumakuru', 
      'Bidar', 'Hosapete', 'Gadag', 'Udupi', 'Hassan', 'Bhadravati'
    ],
    'Tamil Nadu': [
      'Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 
      'Tiruppur', 'Erode', 'Tirunelveli', 'Vellore', 'Thoothukudi', 
      'Dindigul', 'Thanjavur', 'Ranipet', 'Sivakasi', 'Karur', 'Udhagamandalam'
    ],
    'Maharashtra': [
      'Mumbai', 'Pune', 'Nagpur', 'Thane', 'Nashik', 'Chhatrapati Sambhajinagar', 
      'Solapur', 'Navi Mumbai', 'Kolhapur', 'Amravati', 'Nanded', 
      'Sangli', 'Jalgaon', 'Akola', 'Latur', 'Dhule', 'Ahmednagar'
    ],
    'Gujarat': [
      'Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 
      'Jamnagar', 'Gandhinagar', 'Junagadh', 'Gandhidham', 'Anand', 
      'Navsari', 'Morbi', 'Nadiad', 'Surendranagar', 'Bharuch'
    ],
    'Delhi': [
      'New Delhi', 'North Delhi', 'South Delhi', 'West Delhi', 'East Delhi', 
      'Central Delhi', 'South West Delhi', 'North West Delhi', 'Dwarka', 'Saket'
    ],
    'Telangana': [
      'Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Ramagundam', 
      'Khammam', 'Mahbubnagar', 'Nalgonda', 'Adilabad', 'Siddipet'
    ],
    'Andhra Pradesh': [
      'Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Kurnool', 
      'Rajahmundry', 'Tirupati', 'Kakinada', 'Kadapa', 'Anantapur', 'Eluru'
    ],
    'Uttar Pradesh': [
      'Lucknow', 'Kanpur', 'Noida', 'Greater Noida', 'Ghaziabad', 
      'Agra', 'Varanasi', 'Prayagraj', 'Meerut', 'Bareilly', 
      'Aligarh', 'Moradabad', 'Saharanpur', 'Gorakhpur', 'Jhansi'
    ],
    'West Bengal': [
      'Kolkata', 'Howrah', 'Siliguri', 'Durgapur', 'Asansol', 
      'Bardhaman', 'Malda', 'Kharagpur', 'Haldia', 'Darjeeling'
    ],
    'Rajasthan': [
      'Jaipur', 'Jodhpur', 'Kota', 'Bikaner', 'Ajmer', 
      'Udaipur', 'Bhilwara', 'Alwar', 'Bharatpur', 'Sikar'
    ],
    'Punjab': [
      'Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda', 
      'Mohali', 'Hoshiarpur', 'Pathankot', 'Moga', 'Batala'
    ],
    'Haryana': [
      'Gurugram', 'Faridabad', 'Panipat', 'Ambala', 'Yamunanagar', 
      'Rohtak', 'Hisar', 'Karnal', 'Sonipat', 'Panchkula'
    ],
    'Madhya Pradesh': [
      'Indore', 'Bhopal', 'Jabalpur', 'Gwalior', 'Ujjain', 
      'Sagar', 'Dewas', 'Satna', 'Ratlam', 'Rewa'
    ],
    'Bihar': [
      'Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Purnia', 
      'Darbhanga', 'Bihar Sharif', 'Arrah', 'Begusarai', 'Katihar'
    ],
    'Odisha': [
      'Bhubaneswar', 'Cuttack', 'Rourkela', 'Berhampur', 'Sambalpur', 
      'Puri', 'Balasore', 'Bhadrak', 'Baripada', 'Jharsuguda'
    ],
    'Assam': [
      'Guwahati', 'Silchar', 'Dibrugarh', 'Jorhat', 'Nagaon', 
      'Tinsukia', 'Tezpur', 'Bongaigaon', 'Karimganj'
    ],
    'Goa': [
      'Panaji', 'Margao', 'Vasco da Gama', 'Mapusa', 'Ponda'
    ],
    'Chandigarh': ['Chandigarh'],
    'Himachal Pradesh': ['Shimla', 'Dharamshala', 'Mandi', 'Solan', 'Kullu', 'Manali'],
    'Jammu and Kashmir': ['Srinagar', 'Jammu', 'Anantnag', 'Baramulla', 'Udhampur'],
    'Uttarakhand': ['Dehradun', 'Haridwar', 'Roorkee', 'Haldwani', 'Rishikesh', 'Nainital'],
    'Jharkhand': ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro', 'Deoghar', 'Hazaribagh'],
    'Chhattisgarh': ['Raipur', 'Bhilai', 'Bilaspur', 'Korba', 'Durg', 'Rajnandgaon'],
    'Puducherry': ['Puducherry', 'Karaikal', 'Mahe', 'Yanam'],
    'Tripura': ['Agartala', 'Dharmanagar', 'Udaipur'],
    'Meghalaya': ['Shillong', 'Tura', 'Jowai'],
    'Manipur': ['Imphal', 'Churachandpur', 'Thoubal'],
    'Nagaland': ['Kohima', 'Dimapur', 'Mokokchung'],
    'Mizoram': ['Aizawl', 'Lunglei', 'Champhai'],
    'Arunachal Pradesh': ['Itanagar', 'Naharlagun', 'Pasighat'],
    'Sikkim': ['Gangtok', 'Namchi', 'Gyalshing']
  },

  'united states': {
    'California': [
      'Los Angeles', 'San Francisco', 'San Diego', 'San Jose', 'Sacramento', 
      'Fresno', 'Oakland', 'Long Beach', 'Bakersfield', 'Anaheim', 
      'Santa Ana', 'Riverside', 'Stockton', 'Irvine', 'Fremont', 
      'San Bernardino', 'Modesto', 'Fontana', 'Santa Clara', 'Pasadena'
    ],
    'Texas': [
      'Houston', 'San Antonio', 'Dallas', 'Austin', 'Fort Worth', 
      'El Paso', 'Arlington', 'Corpus Christi', 'Plano', 'Lubbock', 
      'Laredo', 'Irving', 'Garland', 'Frisco', 'McKinney', 'Amarillo'
    ],
    'Florida': [
      'Miami', 'Orlando', 'Tampa', 'Jacksonville', 'St. Petersburg', 
      'Hialeah', 'Tallahassee', 'Fort Lauderdale', 'Port St. Lucie', 'Cape Coral', 
      'Pembroke Pines', 'Hollywood', 'Gainesville', 'Miramar', 'Coral Springs'
    ],
    'New York': [
      'New York City', 'Buffalo', 'Rochester', 'Yonkers', 'Syracuse', 
      'Albany', 'New Rochelle', 'Mount Vernon', 'Schenectady', 'Utica', 'White Plains'
    ],
    'Washington': [
      'Seattle', 'Spokane', 'Tacoma', 'Vancouver', 'Bellevue', 
      'Kent', 'Everett', 'Renton', 'Spokane Valley', 'Federal Way', 'Redmond'
    ],
    'Illinois': [
      'Chicago', 'Aurora', 'Naperville', 'Joliet', 'Rockford', 
      'Springfield', 'Elgin', 'Peoria', 'Champaign', 'Waukegan'
    ],
    'Pennsylvania': [
      'Philadelphia', 'Pittsburgh', 'Allentown', 'Reading', 'Erie', 
      'Scranton', 'Bethlehem', 'Lancaster', 'Harrisburg', 'York'
    ],
    'Ohio': [
      'Columbus', 'Cleveland', 'Cincinnati', 'Toledo', 'Akron', 
      'Dayton', 'Parma', 'Canton', 'Youngstown', 'Lorain'
    ],
    'Georgia': [
      'Atlanta', 'Augusta', 'Columbus', 'Macon', 'Savannah', 
      'Athens', 'Sandy Springs', 'Roswell', 'Johns Creek', 'Albany'
    ],
    'North Carolina': [
      'Charlotte', 'Raleigh', 'Greensboro', 'Durham', 'Winston-Salem', 
      'Fayetteville', 'Cary', 'Wilmington', 'High Point', 'Concord'
    ],
    'Michigan': [
      'Detroit', 'Grand Rapids', 'Warren', 'Sterling Heights', 'Ann Arbor', 
      'Lansing', 'Dearborn', 'Livonia', 'Troy', 'Westland'
    ],
    'New Jersey': [
      'Newark', 'Jersey City', 'Paterson', 'Elizabeth', 'Lakewood', 
      'Edison', 'Woodbridge', 'Toms River', 'Hamilton', 'Trenton'
    ],
    'Virginia': [
      'Virginia Beach', 'Chesapeake', 'Norfolk', 'Richmond', 'Newport News', 
      'Alexandria', 'Hampton', 'Roanoke', 'Portsmouth', 'Suffolk'
    ],
    'Massachusetts': [
      'Boston', 'Worcester', 'Springfield', 'Cambridge', 'Lowell', 
      'Brockton', 'New Bedford', 'Quincy', 'Lynn', 'Fall River'
    ],
    'Colorado': [
      'Denver', 'Colorado Springs', 'Aurora', 'Fort Collins', 'Lakewood', 
      'Thornton', 'Arvada', 'Westminster', 'Pueblo', 'Boulder'
    ],
    'Arizona': ['Phoenix', 'Tucson', 'Mesa', 'Chandler', 'Scottsdale', 'Glendale', 'Gilbert', 'Tempe'],
    'Indiana': ['Indianapolis', 'Fort Wayne', 'Evansville', 'South Bend', 'Carmel', 'Fishers'],
    'Tennessee': ['Nashville', 'Memphis', 'Knoxville', 'Chattanooga', 'Clarksville', 'Murfreesboro'],
    'Missouri': ['Kansas City', 'St. Louis', 'Springfield', 'Columbia', 'Independence'],
    'Maryland': ['Baltimore', 'Frederick', 'Rockville', 'Gaithersburg', 'Bowie', 'Annapolis'],
    'Wisconsin': ['Milwaukee', 'Madison', 'Green Bay', 'Kenosha', 'Racine', 'Appleton'],
    'Minnesota': ['Minneapolis', 'Saint Paul', 'Rochester', 'Bloomington', 'Duluth', 'Brooklyn Park'],
    'Oregon': ['Portland', 'Salem', 'Eugene', 'Gresham', 'Hillsboro', 'Beaverton', 'Bend'],
    'Utah': ['Salt Lake City', 'West Valley City', 'Provo', 'West Jordan', 'Orem', 'Sandy'],
    'Nevada': ['Las Vegas', 'Henderson', 'Reno', 'North Las Vegas', 'Sparks', 'Carson City']
  },

  'saudi arabia': {
    'Riyadh Region': [
      'Riyadh', 'Al-Kharj', 'Diriyah', 'Al Majma\'ah', 'Ad Dawadimi', 
      'Wadi ad-Dawasir', 'Afif', 'Zulfi', 'Shaqra', 'Hotat Bani Tamim', 
      'Huraymila', 'Al Ghat', 'Rumaah', 'Thadiq', 'Al Quway\'iyah'
    ],
    'Makkah Region': [
      'Jeddah', 'Makkah', 'Taif', 'Rabigh', 'Al Qunfudhah', 
      'Khulays', 'Al Lith', 'Turubah', 'Ranyah', 'Al Khurmah', 'Adham'
    ],
    'Eastern Province': [
      'Dammam', 'Khobar', 'Dhahran', 'Jubail', 'Al-Ahsa', 
      'Hofuf', 'Mubarraz', 'Qatif', 'Ras Tanura', 'Khafji', 
      'Hafar Al-Batin', 'Buqayq', 'Nariyah', 'Qaryat al-Ulya'
    ],
    'Madinah Region': [
      'Madinah', 'Yanbu', 'Badr', 'Al-Ula', 'Khaybar', 'Mahd adh Dhahab', 'Al Hinakiyah'
    ],
    'Al-Qassim Region': [
      'Buraidah', 'Unaizah', 'Ar Rass', 'Al Bukayriyah', 'Al Badayea', 
      'Al Mithnab', 'Riyadh Al Khabra', 'Uglat Asugour', 'Dhariya'
    ],
    'Asir Region': [
      'Abha', 'Khamis Mushait', 'Bisha', 'Muhayil Asir', 'Ahad Rafidah', 
      'Zahran Al Janub', 'Tanomah', 'Al Majardah', 'Sarat Abida', 'Bariq'
    ],
    'Tabuk Region': [
      'Tabuk', 'Duba', 'Haql', 'Umluj', 'Al Wajh', 'Tayma', 'Al Bada\'a'
    ],
    'Hail Region': [
      'Hail', 'Baq\'a', 'Al Ghazalah', 'Ash Shinan', 'Mawqaq', 'As Sulaymi'
    ],
    'Jazan Region': [
      'Jazan', 'Sabya', 'Abu Arish', 'Samtah', 'Baish', 
      'Farasan', 'Ad Darb', 'Ahad Al Masarihah', 'Al Eidabi'
    ],
    'Najran Region': [
      'Najran', 'Sharurah', 'Hubuna', 'Badr Al Janub', 'Yadamah', 'Thar', 'Khubash'
    ],
    'Al-Bahah Region': [
      'Al-Bahah', 'Baljurashi', 'Al Mandaq', 'Al Makhwah', 'Qilwah', 'Al Aqiq'
    ],
    'Al-Jawf Region': [
      'Sakaka', 'Qurayyat', 'Dumat Al-Jandal', 'Tabarjal'
    ],
    'Northern Borders Region': [
      'Arar', 'Rafha', 'Turaif', 'Al Uwayqilah'
    ]
  },

  'united arab emirates': {
    'Dubai': [
      'Dubai City', 'Deira', 'Bur Dubai', 'Business Bay', 'Downtown Dubai', 
      'Dubai Marina', 'Jumeirah', 'Al Barsha', 'Al Quoz', 'Jebel Ali', 'Mirdif'
    ],
    'Abu Dhabi': [
      'Abu Dhabi City', 'Al Ain', 'Al Dhafra', 'Ruwais', 'Khalifa City', 
      'Mussafah', 'Yas Island', 'Saadiyat Island', 'Madinat Zayed'
    ],
    'Sharjah': [
      'Sharjah City', 'Khor Fakkan', 'Kalba', 'Al Dhaid', 'Dibba Al-Hisn', 'Hamriyah'
    ],
    'Ajman': ['Ajman City', 'Masfout', 'Manama'],
    'Ras Al Khaimah': ['Ras Al Khaimah City', 'Al Nakheel', 'Al Hamra', 'Digdaga'],
    'Fujairah': ['Fujairah City', 'Dibba Al-Fujairah', 'Qidfa', 'Mirbah'],
    'Umm Al Quwain': ['Umm Al Quwain City', 'Falaj Al Mualla']
  },

  'united kingdom': {
    'England': [
      'London', 'Manchester', 'Birmingham', 'Leeds', 'Liverpool', 
      'Bristol', 'Newcastle upon Tyne', 'Sheffield', 'Oxford', 'Cambridge', 
      'Nottingham', 'Southampton', 'Brighton', 'Leicester', 'Reading'
    ],
    'Scotland': ['Edinburgh', 'Glasgow', 'Aberdeen', 'Dundee', 'Inverness', 'Stirling', 'Perth'],
    'Wales': ['Cardiff', 'Swansea', 'Newport', 'Wrexham', 'Bangor', 'St Davids'],
    'Northern Ireland': ['Belfast', 'Derry', 'Lisburn', 'Newry', 'Armagh', 'Bangor']
  },

  'canada': {
    'Ontario': ['Toronto', 'Ottawa', 'Mississauga', 'Brampton', 'Hamilton', 'London', 'Markham', 'Vaughan', 'Kitchener', 'Windsor'],
    'Quebec': ['Montreal', 'Quebec City', 'Laval', 'Gatineau', 'Longueuil', 'Sherbrooke', 'Levis', 'Trois-Rivieres'],
    'British Columbia': ['Vancouver', 'Surrey', 'Burnaby', 'Richmond', 'Victoria', 'Kelowna', 'Abbotsford', 'Coquitlam', 'Nanaimo'],
    'Alberta': ['Calgary', 'Edmonton', 'Red Deer', 'Lethbridge', 'St. Albert', 'Medicine Hat', 'Grande Prairie'],
    'Manitoba': ['Winnipeg', 'Brandon', 'Steinbach', 'Thompson', 'Portage la Prairie'],
    'Saskatchewan': ['Saskatoon', 'Regina', 'Prince Albert', 'Moose Jaw', 'Swift Current'],
    'Nova Scotia': ['Halifax', 'Dartmouth', 'Sydney', 'Truro', 'New Glasgow']
  },

  'australia': {
    'New South Wales': ['Sydney', 'Newcastle', 'Central Coast', 'Wollongong', 'Maitland', 'Tweed Heads', 'Wagga Wagga', 'Albury'],
    'Victoria': ['Melbourne', 'Geelong', 'Ballarat', 'Bendigo', 'Shepparton', 'Mildura', 'Warrnambool'],
    'Queensland': ['Brisbane', 'Gold Coast', 'Sunshine Coast', 'Townsville', 'Cairns', 'Toowoomba', 'Mackay', 'Rockhampton'],
    'Western Australia': ['Perth', 'Mandurah', 'Bunbury', 'Geraldton', 'Kalgoorlie', 'Albany', 'Busselton'],
    'South Australia': ['Adelaide', 'Mount Gambier', 'Whyalla', 'Murray Bridge', 'Port Augusta', 'Port Pirie'],
    'Tasmania': ['Hobart', 'Launceston', 'Devonport', 'Burnie'],
    'Australian Capital Territory': ['Canberra']
  },

  'germany': {
    'Bavaria': ['Munich', 'Nuremberg', 'Augsburg', 'Würzburg', 'Regensburg', 'Ingolstadt', 'Fürth', 'Erlangen'],
    'North Rhine-Westphalia': ['Cologne', 'Düsseldorf', 'Dortmund', 'Essen', 'Duisburg', 'Bochum', 'Wuppertal', 'Bonn', 'Münster', 'Aachen'],
    'Baden-Württemberg': ['Stuttgart', 'Mannheim', 'Karlsruhe', 'Freiburg', 'Heidelberg', 'Ulm', 'Heilbronn', 'Pforzheim'],
    'Hesse': ['Frankfurt am Main', 'Wiesbaden', 'Kassel', 'Darmstadt', 'Offenbach', 'Hanau', 'Gießen'],
    'Berlin': ['Berlin'],
    'Hamburg': ['Hamburg'],
    'Lower Saxony': ['Hanover', 'Braunschweig', 'Osnabrück', 'Oldenburg', 'Göttingen', 'Wolfsburg'],
    'Saxony': ['Leipzig', 'Dresden', 'Chemnitz', 'Zwickau', 'Plauen']
  },

  'france': {
    'Île-de-France': ['Paris', 'Boulogne-Billancourt', 'Saint-Denis', 'Argenteuil', 'Montreuil', 'Créteil', 'Nanterre', 'Versailles'],
    'Auvergne-Rhône-Alpes': ['Lyon', 'Saint-Étienne', 'Grenoble', 'Villeurbanne', 'Clermont-Ferrand', 'Annecy', 'Chambéry'],
    'Provence-Alpes-Côte d\'Azur': ['Marseille', 'Nice', 'Toulon', 'Aix-en-Provence', 'Avignon', 'Cannes', 'Antibes'],
    'Occitanie': ['Toulouse', 'Montpellier', 'Nîmes', 'Perpignan', 'Béziers', 'Montauban', 'Tarbes'],
    'Nouvelle-Aquitaine': ['Bordeaux', 'Limoges', 'Poitiers', 'Pau', 'La Rochelle', 'Mérignac', 'Pessac']
  },

  'qatar': {
    'Doha': ['Doha', 'West Bay', 'The Pearl', 'Lusail', 'Al Sadd', 'Al Dafna'],
    'Al Rayyan': ['Al Rayyan', 'Education City', 'Al Gharrafa', 'Muaither', 'Al Shahaniya'],
    'Al Wakrah': ['Al Wakrah', 'Mesaieed', 'Al Wukair'],
    'Al Khor': ['Al Khor', 'Ras Laffan', 'Al Dhakira']
  },

  'kuwait': {
    'Al Asimah (Capital)': ['Kuwait City', 'Dasman', 'Sharq', 'Mirgab', 'Salhiya', 'Qibla'],
    'Hawalli': ['Hawalli', 'Salmiya', 'Rumaithiya', 'Jabriya', 'Bayan', 'Mishref'],
    'Al Farwaniyah': ['Farwaniyah', 'Khaitan', 'Andalous', 'Rabiya', 'Jleeb Al-Shuyoukh'],
    'Al Ahmadi': ['Ahmadi', 'Fahaheel', 'Mangaf', 'Mahboula', 'Egaila', 'Sabah Al Ahmad'],
    'Al Jahra': ['Jahra', 'Oyoun', 'Waha', 'Qasr'],
    'Mubarak Al-Kabeer': ['Mubarak Al-Kabeer', 'Sabah Al-Salem', 'Messila', 'Abu Al Hasaniya']
  },

  'bahrain': {
    'Capital Governorate': ['Manama', 'Juffair', 'Seef', 'Sanabis', 'Gudaibiya', 'Zinj'],
    'Muharraq Governorate': ['Muharraq', 'Busaiteen', 'Hidd', 'Amwaj Islands', 'Diyar Al Muharraq'],
    'Northern Governorate': ['Budaiya', 'Saar', 'Janabiyah', 'Hamad Town', 'A\'ali', 'Jasra'],
    'Southern Governorate': ['Riffa', 'Isa Town', 'Zallaq', 'Awali', 'Sakhir', 'Durrat Al Bahrain']
  },

  'oman': {
    'Muscat': ['Muscat', 'Muttrah', 'Bawshar', 'Seeb', 'Al Amarat', 'Qurum', 'Ruwi', 'Al Khuwair'],
    'Dhofar': ['Salalah', 'Taqah', 'Mirbat', 'Thumrait', 'Sadah'],
    'Al Batinah North': ['Sohar', 'Shinas', 'Liwa', 'Saham', 'Al Khaburah', 'As Suwayq'],
    'Ad Dakhiliyah': ['Nizwa', 'Samail', 'Bahla', 'Adam', 'Izki'],
    'Al Batinah South': ['Rustaq', 'Barka', 'Al Musanaah', 'Nakhal']
  },

  'egypt': {
    'Cairo Governorate': ['Cairo', 'New Cairo', 'Maadi', 'Nasr City', 'Heliopolis', 'Zamalek', 'Shubra'],
    'Giza Governorate': ['Giza', '6th of October City', 'Sheikh Zayed City', 'Dokki', 'Agouza', 'Haram'],
    'Alexandria Governorate': ['Alexandria', 'Borg El Arab', 'Montaza', 'Sidi Gaber', 'Smouha'],
    'Dakahlia Governorate': ['Mansoura', 'Talkha', 'Mit Ghamr', 'Dikirnis'],
    'Red Sea Governorate': ['Hurghada', 'El Gouna', 'Safaga', 'Marsa Alam']
  },

  'singapore': {
    'Central Region': ['Downtown Core', 'Marina South', 'Newton', 'Orchard', 'Outram', 'River Valley', 'Rochor', 'Singapore River'],
    'East Region': ['Bedok', 'Changi', 'Pasir Ris', 'Tampines'],
    'North Region': ['Central Water Catchment', 'Lim Chu Kang', 'Mandai', 'Sembawang', 'Simpang', 'Sunsei Kadut', 'Woodlands', 'Yishun'],
    'North-East Region': ['Ang Mo Kio', 'Hougang', 'North-Eastern Islands', 'Punggol', 'Seletar', 'Sengkang', 'Serangoon'],
    'West Region': ['Boon Lay', 'Bukit Batok', 'Bukit Panjang', 'Choa Chu Kang', 'Clementi', 'Jurong East', 'Jurong West', 'Pioneer']
  }
};

/**
 * Normalizes a country query or name to find the canonical country name.
 */
export function normalizeCountryName(countryInput?: string): string {
  if (!countryInput) return '';
  const clean = countryInput.trim().toLowerCase();
  
  // Direct match by code
  const byCode = WORLD_COUNTRIES.find(c => c.code.toLowerCase() === clean);
  if (byCode) return byCode.name;

  // Direct match by name
  const byName = WORLD_COUNTRIES.find(c => c.name.toLowerCase() === clean);
  if (byName) return byName.name;

  // Substring or common alias match
  if (clean === 'usa' || clean === 'us' || clean === 'america') return 'United States';
  if (clean === 'uk' || clean === 'britain' || clean === 'great britain') return 'United Kingdom';
  if (clean === 'ksa' || clean === 'saudi') return 'Saudi Arabia';
  if (clean === 'uae' || clean === 'emirates') return 'United Arab Emirates';

  return countryInput.trim();
}

/**
 * Get all worldwide countries list
 */
export function getAllCountries(): CountryItem[] {
  return WORLD_COUNTRIES;
}

/**
 * Get states or provinces available for a given country.
 * Returns empty array if no predefined states exist, which allows seamless manual entry.
 */
export function getStatesForCountry(countryInput?: string): string[] {
  if (!countryInput) return [];
  const canonical = normalizeCountryName(countryInput).toLowerCase();
  const countryDict = STATE_CITY_DATABASE[canonical];
  if (!countryDict) return [];
  return Object.keys(countryDict).sort();
}

/**
 * Get cities or places available for a given country and state.
 * Returns empty array if no predefined cities exist, which allows seamless manual entry.
 */
export function getCitiesForState(countryInput?: string, stateInput?: string): string[] {
  if (!countryInput || !stateInput) return [];
  const canonicalCountry = normalizeCountryName(countryInput).toLowerCase();
  const countryDict = STATE_CITY_DATABASE[canonicalCountry];
  if (!countryDict) return [];

  // Match state (case-insensitive)
  const cleanState = stateInput.trim().toLowerCase();
  const matchedStateKey = Object.keys(countryDict).find(
    s => s.toLowerCase() === cleanState || s.toLowerCase().includes(cleanState) || cleanState.includes(s.toLowerCase())
  );

  if (matchedStateKey && countryDict[matchedStateKey]) {
    return countryDict[matchedStateKey];
  }

  return [];
}
