import { Product, DeliveryLocation } from '../types';

export const INDIAN_STATES: string[] = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  // Union Territories
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry'
];

export const POPULAR_INDIAN_STATES = [
  'Delhi',
  'Uttar Pradesh',
  'Maharashtra',
  'Bihar',
  'Rajasthan',
  'Haryana',
  'Punjab',
  'West Bengal',
  'Karnataka',
  'Gujarat',
  'Madhya Pradesh'
];

export const INDIAN_DISTRICTS_BY_STATE: Record<string, string[]> = {
  'Uttar Pradesh': [
    'Agra', 'Aligarh', 'Ambedkar Nagar', 'Amethi', 'Amroha', 'Auraiya', 'Ayodhya', 'Azamgarh', 
    'Baghpat', 'Bahraich', 'Ballia', 'Balrampur', 'Banda', 'Barabanki', 'Bareilly', 'Basti', 
    'Bhadohi', 'Bijnor', 'Budaun', 'Bulandshahr', 'Chandauli', 'Chitrakoot', 'Deoria', 'Etah', 
    'Etawah', 'Farrukhabad', 'Fatehpur', 'Firozabad', 'Gautam Buddha Nagar (Noida)', 'Ghaziabad', 
    'Ghazipur', 'Gonda', 'Gorakhpur', 'Hamirpur', 'Hapur', 'Hardoi', 'Hathras', 'Jalaun', 
    'Jaunpur', 'Jhansi', 'Kannauj', 'Kanpur Dehat', 'Kanpur Nagar', 'Kasganj', 'Kaushambi', 
    'Kheri', 'Kushinagar', 'Lalitpur', 'Lucknow', 'Maharajganj', 'Mahoba', 'Mainpuri', 'Mathura', 
    'Mau', 'Meerut', 'Mirzapur', 'Moradabad', 'Muzaffarnagar', 'Pilibhit', 'Pratapgarh', 'Prayagraj (Allahabad)', 
    'Raebareli', 'Rampur', 'Saharanpur', 'Sambhal', 'Sant Kabir Nagar', 'Shahjahanpur', 'Shamli', 
    'Shravasti', 'Siddharthnagar', 'Sitapur', 'Sonbhadra', 'Sultanpur', 'Unnao', 'Varanasi'
  ],
  'Delhi': [
    'Central Delhi', 'East Delhi', 'New Delhi', 'North Delhi', 'North East Delhi', 
    'North West Delhi', 'Shahdara', 'South Delhi', 'South East Delhi', 'South West Delhi', 'West Delhi'
  ],
  'Bihar': [
    'Araria', 'Arwal', 'Aurangabad', 'Banka', 'Begusarai', 'Bhagalpur', 'Bhojpur (Arrah)', 
    'Buxar', 'Darbhanga', 'East Champaran (Motihari)', 'Gaya', 'Gopalganj', 'Jamui', 'Jehanabad', 
    'Kaimur (Bhabua)', 'Katihar', 'Khagaria', 'Kishanganj', 'Lakhisarai', 'Madhepura', 'Madhubani', 
    'Munger', 'Muzaffarpur', 'Nalanda (Bihar Sharif)', 'Nawada', 'Patna', 'Purnia', 'Rohtas (Sasaram)', 
    'Saharsa', 'Samastipur', 'Saran (Chhapra)', 'Sheikhpura', 'Sheohar', 'Sitamarhi', 'Siwan', 
    'Supaul', 'Vaishali (Hajipur)', 'West Champaran (Bettiah)'
  ],
  'Maharashtra': [
    'Ahmednagar', 'Akola', 'Amravati', 'Chhatrapati Sambhaji Nagar (Aurangabad)', 'Beed', 'Bhandara', 
    'Buldhana', 'Chandrapur', 'Dhule', 'Gadchiroli', 'Gondia', 'Hingoli', 'Jalgaon', 'Jalna', 
    'Kolhapur', 'Latur', 'Mumbai City', 'Mumbai Suburban', 'Nagpur', 'Nanded', 'Nandurbar', 
    'Nashik', 'Navi Mumbai', 'Osmanabad (Dharashiv)', 'Palghar', 'Parbhani', 'Pune', 'Raigad', 
    'Ratnagiri', 'Sangli', 'Satara', 'Sindhudurg', 'Solapur', 'Thane', 'Wardha', 'Washim', 'Yavatmal'
  ],
  'Rajasthan': [
    'Ajmer', 'Alwar', 'Banswara', 'Baran', 'Barmer', 'Bharatpur', 'Bhilwara', 'Bikaner', 
    'Bundi', 'Chittorgarh', 'Churu', 'Dausa', 'Dholpur', 'Dungarpur', 'Hanumangarh', 'Jaipur', 
    'Jaisalmer', 'Jalore', 'Jhalawar', 'Jhunjhunu', 'Jodhpur', 'Karauli', 'Kota', 'Nagaur', 
    'Pali', 'Pratapgarh', 'Rajsamand', 'Sawai Madhopur', 'Sikar', 'Sirohi', 'Sri Ganganagar', 
    'Tonk', 'Udaipur'
  ],
  'Haryana': [
    'Ambala', 'Bhiwani', 'Charkhi Dadri', 'Faridabad', 'Fatehabad', 'Gurugram (Gurgaon)', 
    'Hisar', 'Jhajjar', 'Jind', 'Kaithal', 'Karnal', 'Kurukshetra', 'Mahendragarh', 'Nuh', 
    'Palwal', 'Panchkula', 'Panipat', 'Rewari', 'Rohtak', 'Sirsa', 'Sonipat', 'Yamunanagar'
  ],
  'Punjab': [
    'Amritsar', 'Barnala', 'Bathinda', 'Faridkot', 'Fatehgarh Sahib', 'Fazilka', 'Ferozepur', 
    'Gurdaspur', 'Hoshiarpur', 'Jalandhar', 'Kapurthala', 'Ludhiana', 'Malerkotla', 'Mansa', 
    'Moga', 'Mohali (SAS Nagar)', 'Muktsar', 'Pathankot', 'Patiala', 'Rupnagar', 'Sangrur', 
    'Shaheed Bhagat Singh Nagar (Nawanshahr)', 'Tarn Taran'
  ],
  'West Bengal': [
    'Alipurduar', 'Bankura', 'Birbhum', 'Cooch Behar', 'Dakshin Dinajpur', 'Darjeeling', 
    'Hooghly', 'Howrah', 'Jalpaiguri', 'Jhargram', 'Kalimpong', 'Kolkata', 'Malda', 
    'Murshidabad', 'Nadia', 'North 24 Parganas', 'Paschim Bardhaman', 'Paschim Medinipur', 
    'Purba Bardhaman', 'Purba Medinipur', 'Purulia', 'South 24 Parganas', 'Uttar Dinajpur'
  ],
  'Madhya Pradesh': [
    'Agar Malwa', 'Alirajpur', 'Anuppur', 'Ashoknagar', 'Balaghat', 'Barwani', 'Betul', 
    'Bhind', 'Bhopal', 'Burhanpur', 'Chhatarpur', 'Chhindwara', 'Damoh', 'Datia', 'Dewas', 
    'Dhar', 'Dindori', 'Guna', 'Gwalior', 'Harda', 'Hoshangabad (Narmadapuram)', 'Indore', 
    'Jabalpur', 'Jhabua', 'Katni', 'Khandwa', 'Khargone', 'Mandla', 'Mandsaur', 'Morena', 
    'Narsinghpur', 'Neemuch', 'Niwari', 'Panna', 'Raisen', 'Rajgarh', 'Ratlam', 'Rewa', 
    'Sagar', 'Satna', 'Sehore', 'Seoni', 'Shahdol', 'Shajapur', 'Sheopur', 'Shivpuri', 
    'Sidhi', 'Singrauli', 'Tikamgarh', 'Ujjain', 'Umaria', 'Vidisha'
  ],
  'Gujarat': [
    'Ahmedabad', 'Amreli', 'Anand', 'Aravalli', 'Banaskantha', 'Bharuch', 'Bhavnagar', 
    'Botad', 'Chhota Udaipur', 'Dahod', 'Dang', 'Devbhoomi Dwarka', 'Gandhinagar', 'Gir Somnath', 
    'Jamnagar', 'Junagadh', 'Kheda', 'Kutch', 'Mahisagar', 'Mehsana', 'Morbi', 'Narmada', 
    'Navsari', 'Panchmahal', 'Patan', 'Porbandar', 'Rajkot', 'Sabarkantha', 'Surat', 
    'Surendranagar', 'Tapi', 'Vadodara', 'Valsad'
  ],
  'Karnataka': [
    'Bagalkote', 'Ballari', 'Belagavi', 'Bengaluru Rural', 'Bengaluru Urban', 'Bidar', 
    'Chamarajanagar', 'Chikkaballapura', 'Chikkamagaluru', 'Chitradurga', 'Dakshina Kannada (Mangaluru)', 
    'Davanagere', 'Dharwad (Hubballi)', 'Gadag', 'Hassan', 'Haveri', 'Kalaburagi', 'Kodagu', 
    'Kolar', 'Koppal', 'Mandya', 'Mysuru', 'Raichur', 'Ramanagara', 'Shivamogga', 'Tumakuru', 
    'Udupi', 'Uttara Kannada', 'Vijayapura', 'Yadgir'
  ],
  'Tamil Nadu': [
    'Ariyalur', 'Chengalpattu', 'Chennai', 'Coimbatore', 'Cuddalore', 'Dharmapuri', 'Dindigul', 
    'Erode', 'Kallakurichi', 'Kanchipuram', 'Kanyakumari', 'Karur', 'Krishnagiri', 'Madurai', 
    'Mayiladuthurai', 'Nagapattinam', 'Namakkal', 'Nilgiris', 'Perambalur', 'Pudukkottai', 
    'Ramanathapuram', 'Ranipet', 'Salem', 'Sivaganga', 'Tenkasi', 'Thanjavur', 'Theni', 
    'Thoothukudi', 'Tiruchirappalli', 'Tirunelveli', 'Tirupathur', 'Tiruppur', 'Tiruvallur', 
    'Tiruvannamalai', 'Tiruvarur', 'Vellore', 'Viluppuram', 'Virudhunagar'
  ],
  'Telangana': [
    'Adilabad', 'Bhadradri Kothagudem', 'Hyderabad', 'Jagtial', 'Jangaon', 'Jayashankar Bhupalpally', 
    'Jogulamba Gadwal', 'Kamareddy', 'Karimnagar', 'Khammam', 'Komaram Bheem', 'Mahabubabad', 
    'Mahbubnagar', 'Mancherial', 'Medak', 'Medchal-Malkajgiri', 'Mulugu', 'Nagarkurnool', 
    'Nalgonda', 'Narayanpet', 'Nirmal', 'Nizamabad', 'Peddapalli', 'Rajanna Sircilla', 
    'Ranga Reddy', 'Sangareddy', 'Siddipet', 'Suryapet', 'Vikarabad', 'Wanaparthy', 'Warangal', 
    'Hanamkonda', 'Yadadri Bhuvanagiri'
  ],
  'Andhra Pradesh': [
    'Alluri Sitharama Raju', 'Anakapalli', 'Ananthapuramu', 'Annamayya', 'Bapatla', 'Chittoor', 
    'Dr. B.R. Ambedkar Konaseema', 'East Godavari (Rajamahendravaram)', 'Eluru', 'Guntur', 
    'Kakinada', 'Krishna (Machilipatnam)', 'Kurnool', 'Nandyal', 'NTR (Vijayawada)', 'Palnadu', 
    'Parvathipuram Manyam', 'Prakasam (Ongole)', 'Sri Potti Sriramulu Nellore', 'Sri Sathya Sai', 
    'Srikakulam', 'Tirupati', 'Visakhapatnam', 'Vizianagaram', 'West Godavari (Bhimavaram)', 'YSR Kadapa'
  ],
  'Kerala': [
    'Alappuzha', 'Ernakulam (Kochi)', 'Idukki', 'Kannur', 'Kasaragod', 'Kollam', 'Kottayam', 
    'Kozhikode', 'Malappuram', 'Palakkad', 'Pathanamthitta', 'Thiruvananthapuram', 'Thrissur', 'Wayanad'
  ],
  'Jharkhand': [
    'Bokaro', 'Chatra', 'Deoghar', 'Dhanbad', 'Dumka', 'East Singhbhum (Jamshedpur)', 
    'Garhwa', 'Giridih', 'Godda', 'Gumla', 'Hazaribagh', 'Jamtara', 'Khunti', 'Koderma', 
    'Latehar', 'Lohardaga', 'Pakur', 'Palamu', 'Ramgarh', 'Ranchi', 'Sahebganj', 
    'Seraikela Kharsawan', 'Simdega', 'West Singhbhum (Chaibasa)'
  ],
  'Chhattisgarh': [
    'Balod', 'Baloda Bazar', 'Balrampur', 'Bastar (Jagdalpur)', 'Bemetara', 'Bijapur', 
    'Bilaspur', 'Dantewada', 'Dhamtari', 'Durg (Bhilai)', 'Gariaband', 'Gaurela-Pendra-Marwahi', 
    'Janjgir-Champa', 'Jashpur', 'Kabirdham', 'Kanker', 'Kondagaon', 'Korba', 'Koriya', 
    'Mahasamund', 'Manendragarh', 'Mohla-Manpur', 'Mungeli', 'Narayanpur', 'Raigarh', 
    'Raipur', 'Rajnandgaon', 'Sakti', 'Sarangarh-Bilaigarh', 'Sukma', 'Surajpur', 'Surguja (Ambikapur)'
  ],
  'Odisha': [
    'Angul', 'Balangir', 'Balasore', 'Bargarh', 'Bhadrak', 'Boudh', 'Cuttack', 'Deogarh', 
    'Dhenkanal', 'Gajapati', 'Ganjam (Berhampur)', 'Jagatsinghpur', 'Jajpur', 'Jharsuguda', 
    'Kalahandi', 'Kandhamal', 'Kendrapara', 'Kendujhar', 'Khordha (Bhubaneswar)', 'Koraput', 
    'Malkangiri', 'Mayurbhanj', 'Nabarangpur', 'Nayagarh', 'Nuapada', 'Puri', 'Rayagada', 
    'Sambalpur', 'Subarnapur', 'Sundargarh (Rourkela)'
  ],
  'Assam': [
    'Baksa', 'Barpeta', 'Biswanath', 'Bongaigaon', 'Cachar (Silchar)', 'Charaideo', 
    'Chirang', 'Darrang', 'Dhemaji', 'Dhubri', 'Dibrugarh', 'Dima Hasao', 'Goalpara', 
    'Golaghat', 'Hailakandi', 'Hojai', 'Jorhat', 'Kamrup', 'Kamrup Metropolitan (Guwahati)', 
    'Karbi Anglong', 'Karimganj', 'Kokrajhar', 'Lakhimpur', 'Majuli', 'Morigaon', 'Nagaon', 
    'Nalbari', 'Sivasagar', 'Sonitpur (Tezpur)', 'South Salmara-Mankachar', 'Tinsukia', 'Udalguri', 'West Karbi Anglong'
  ],
  'Uttarakhand': [
    'Almora', 'Bageshwar', 'Chamoli', 'Champawat', 'Dehradun', 'Haridwar', 'Nainital', 
    'Pauri Garhwal', 'Pithoragarh', 'Rudraprayag', 'Tehri Garhwal', 'Udham Singh Nagar', 'Uttarkashi'
  ],
  'Himachal Pradesh': [
    'Bilaspur', 'Chamba', 'Hamirpur', 'Kangra (Dharamshala)', 'Kinnaur', 'Kullu', 
    'Lahaul and Spiti', 'Mandi', 'Shimla', 'Sirmaur', 'Solan', 'Una'
  ],
  'Goa': [
    'North Goa', 'South Goa'
  ],
  'Chandigarh': [
    'Chandigarh'
  ],
  'Jammu and Kashmir': [
    'Anantnag', 'Bandipora', 'Baramulla', 'Budgam', 'Doda', 'Ganderbal', 'Jammu', 
    'Kathua', 'Kishtwar', 'Kulgam', 'Kupwara', 'Poonch', 'Pulwama', 'Rajouri', 
    'Ramban', 'Reasi', 'Samba', 'Shopian', 'Srinagar', 'Udhampur'
  ],
  'Ladakh': [
    'Kargil', 'Leh'
  ],
  'Puducherry': [
    'Karaikal', 'Mahe', 'Puducherry', 'Yanam'
  ],
  'Sikkim': [
    'Gangtok', 'Gyalshing', 'Mangan', 'Namchi', 'Pakyong', 'Soreng'
  ],
  'Tripura': [
    'Agartala (West Tripura)', 'Dhalai', 'Gomati', 'Khowai', 'North Tripura', 'Sepahijala', 'South Tripura', 'Unakoti'
  ],
  'Meghalaya': [
    'East Khasi Hills (Shillong)', 'West Khasi Hills', 'South West Khasi Hills', 'Ri-Bhoi', 
    'East Garo Hills', 'West Garo Hills', 'South Garo Hills', 'North Garo Hills', 
    'South West Garo Hills', 'Eastern West Khasi Hills', 'West Jaintia Hills', 'East Jaintia Hills'
  ],
  'Manipur': [
    'Imphal East', 'Imphal West', 'Bishnupur', 'Thoubal', 'Kakching', 'Ukhrul', 
    'Churachandpur', 'Chandel', 'Senapati', 'Tamenglong', 'Jiribam', 'Kangpokpi', 'Kamjong', 'Tengnoupal', 'Noney', 'Pherzawl'
  ],
  'Mizoram': [
    'Aizawl', 'Lunglei', 'Champhai', 'Kolasib', 'Serchhip', 'Lawngtlai', 'Mamit', 'Saiha', 'Hnahthial', 'Khawzawl', 'Saitual'
  ],
  'Nagaland': [
    'Kohima', 'Dimapur', 'Mokokchung', 'Tuensang', 'Wokha', 'Zunheboto', 'Mon', 'Phek', 'Kiphire', 'Longleng', 'Peren', 'Noklak', 'Chumoukedima', 'Niuland', 'Tseminyu', 'Shamator'
  ],
  'Arunachal Pradesh': [
    'Itanagar', 'Papum Pare', 'Tawang', 'West Kameng', 'East Kameng', 'Pakke Kessang', 'Kurung Kumey', 'Kra Daadi', 'Lower Subansiri', 'Upper Subansiri', 'West Siang', 'Siang', 'East Siang', 'Upper Siang', 'Lower Siang', 'Lepa Rada', 'Shi Yomi', 'Dibang Valley', 'Lower Dibang Valley', 'Lohit', 'Anjaw', 'Namsai', 'Changlang', 'Tirap', 'Longding', 'Kamle'
  ],
  'Andaman and Nicobar Islands': [
    'South Andaman (Port Blair)', 'North and Middle Andaman', 'Nicobar'
  ],
  'Dadra and Nagar Haveli and Daman and Diu': [
    'Daman', 'Diu', 'Dadra and Nagar Haveli (Silvassa)'
  ],
  'Lakshadweep': [
    'Kavaratti', 'Agatti', 'Amini', 'Andrott', 'Minicoy', 'Kalpeni'
  ]
};

// Mapping of India Post 2-digit pincode prefixes to State / Union Territory names
export const PINCODE_PREFIX_MAP: Record<string, string> = {
  '11': 'Delhi',
  '12': 'Haryana',
  '13': 'Haryana',
  '14': 'Punjab',
  '15': 'Punjab',
  '16': 'Chandigarh',
  '17': 'Himachal Pradesh',
  '18': 'Jammu and Kashmir',
  '19': 'Jammu and Kashmir',
  '20': 'Uttar Pradesh',
  '21': 'Uttar Pradesh',
  '22': 'Uttar Pradesh',
  '23': 'Uttar Pradesh',
  '24': 'Uttar Pradesh',
  '25': 'Uttar Pradesh',
  '26': 'Uttarakhand',
  '27': 'Uttar Pradesh',
  '28': 'Uttar Pradesh',
  '30': 'Rajasthan',
  '31': 'Rajasthan',
  '32': 'Rajasthan',
  '33': 'Rajasthan',
  '34': 'Rajasthan',
  '36': 'Gujarat',
  '37': 'Gujarat',
  '38': 'Gujarat',
  '39': 'Gujarat',
  '40': 'Maharashtra',
  '41': 'Maharashtra',
  '42': 'Maharashtra',
  '43': 'Maharashtra',
  '44': 'Maharashtra',
  '45': 'Madhya Pradesh',
  '46': 'Madhya Pradesh',
  '47': 'Madhya Pradesh',
  '48': 'Madhya Pradesh',
  '49': 'Chhattisgarh',
  '50': 'Telangana',
  '51': 'Andhra Pradesh',
  '52': 'Andhra Pradesh',
  '53': 'Andhra Pradesh',
  '56': 'Karnataka',
  '57': 'Karnataka',
  '58': 'Karnataka',
  '59': 'Karnataka',
  '60': 'Tamil Nadu',
  '61': 'Tamil Nadu',
  '62': 'Tamil Nadu',
  '63': 'Tamil Nadu',
  '64': 'Tamil Nadu',
  '67': 'Kerala',
  '68': 'Kerala',
  '69': 'Kerala',
  '70': 'West Bengal',
  '71': 'West Bengal',
  '72': 'West Bengal',
  '73': 'West Bengal',
  '74': 'West Bengal',
  '75': 'Odisha',
  '76': 'Odisha',
  '77': 'Odisha',
  '78': 'Assam',
  '79': 'North Eastern States',
  '80': 'Bihar',
  '81': 'Bihar',
  '82': 'Jharkhand',
  '83': 'Jharkhand',
  '84': 'Bihar',
  '85': 'Bihar'
};

export function getDistrictsForState(stateName: string): string[] {
  if (!stateName) return [];
  const foundKey = Object.keys(INDIAN_DISTRICTS_BY_STATE).find(
    k => k.trim().toLowerCase() === stateName.trim().toLowerCase()
  );
  return foundKey ? INDIAN_DISTRICTS_BY_STATE[foundKey] : [];
}

export function getStateFromPincode(pincode: string): string | null {
  if (!pincode) return null;
  const clean = pincode.replace(/\D/g, '').trim();
  if (clean.length < 2) return null;
  const prefix = clean.substring(0, 2);
  return PINCODE_PREFIX_MAP[prefix] || null;
}

export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Check if a product is deliverable to a given location (pincode, state, and/or district)
 */
export function isProductDeliverable(
  product: Product,
  location: DeliveryLocation | null
): { deliverable: boolean; reason?: string } {
  // If no delivery location is selected by user, product is shown (All India / Default view)
  if (!location || (!location.pincode && !location.state && !location.district)) {
    return { deliverable: true };
  }

  const availabilityType = product.availabilityType || 'all';

  // 1. Pan-India / All States available product
  if (
    availabilityType === 'all' ||
    (!product.availableStates?.length && !product.availableDistricts?.length && !product.availablePincodes?.length)
  ) {
    return { deliverable: true };
  }

  const userPincode = location.pincode?.replace(/\D/g, '').trim();
  const userState = location.state?.trim();
  const userDistrict = location.district?.trim();
  const inferredState = userPincode ? getStateFromPincode(userPincode) : null;

  // 2. District-restricted product
  if (availabilityType === 'districts' && product.availableDistricts && product.availableDistricts.length > 0) {
    if (userDistrict) {
      const normUserDistrict = normalizeName(userDistrict);
      const isMatched = product.availableDistricts.some(d => {
        const normD = normalizeName(d);
        return normD.includes(normUserDistrict) || normUserDistrict.includes(normD);
      });
      if (isMatched) return { deliverable: true };
    }

    // If user hasn't selected a district yet, but selected the parent state
    if (userState) {
      const normUserState = normalizeName(userState);
      const isStateInProductStates = product.availableStates?.some(s => normalizeName(s) === normUserState);
      const stateDistricts = getDistrictsForState(userState).map(normalizeName);
      const hasDistrictInThisState = isStateInProductStates || product.availableDistricts.some(d => {
        const normD = normalizeName(d);
        return normD.includes(normUserState) || stateDistricts.some(sd => sd.includes(normD) || normD.includes(sd));
      });
      if (hasDistrictInThisState) {
        // Allow browsing when entire state is selected
        return { deliverable: true };
      }
    }

    return {
      deliverable: false,
      reason: `Available only in select districts: ${product.availableDistricts.slice(0, 3).join(', ')}${product.availableDistricts.length > 3 ? '...' : ''}`
    };
  }

  // 3. State-restricted product
  if (availabilityType === 'states' && product.availableStates && product.availableStates.length > 0) {
    const normTargetStates = product.availableStates.map(normalizeName);
    
    // Check direct state match
    if (userState && normTargetStates.includes(normalizeName(userState))) {
      return { deliverable: true };
    }

    // Check inferred state from user's pincode
    if (inferredState && normTargetStates.includes(normalizeName(inferredState))) {
      return { deliverable: true };
    }

    return {
      deliverable: false,
      reason: `Available only in: ${product.availableStates.join(', ')}`
    };
  }

  // 4. Pincode-restricted product
  if (availabilityType === 'pincodes' && product.availablePincodes && product.availablePincodes.length > 0) {
    if (userPincode) {
      const cleanPincodes = product.availablePincodes.map(p => p.replace(/\D/g, '').trim());
      if (cleanPincodes.includes(userPincode)) {
        return { deliverable: true };
      }
      return {
        deliverable: false,
        reason: `Available only in select pincodes (${product.availablePincodes.slice(0, 3).join(', ')}${product.availablePincodes.length > 3 ? '...' : ''})`
      };
    } else {
      return {
        deliverable: false,
        reason: `Requires specific pincode delivery check`
      };
    }
  }

  return { deliverable: true };
}

/**
 * Filter an array of products based on the current delivery location
 */
export function filterProductsByLocation(
  products: Product[],
  location: DeliveryLocation | null
): Product[] {
  if (!location || (!location.pincode && !location.state && !location.district)) {
    return products;
  }
  return products.filter(p => isProductDeliverable(p, location).deliverable);
}

const STORAGE_KEY = 'user_delivery_location';

export function getStoredDeliveryLocation(): DeliveryLocation | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DeliveryLocation;
  } catch (e) {
    console.error('Failed to parse delivery location from storage', e);
    return null;
  }
}

export function setStoredDeliveryLocation(location: DeliveryLocation | null): void {
  try {
    if (!location || (!location.pincode && !location.state && !location.district)) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(location));
    }
  } catch (e) {
    console.error('Failed to save delivery location to storage', e);
  }
}
