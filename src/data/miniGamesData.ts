import { GameQuestion, MiniGameDefinition } from '../types/eduworld';

export const MINI_GAME_HUB_COORDS = { x: 46, z: -112 };

export const MINI_GAMES: MiniGameDefinition[] = [
  {
    id: 'parkour',
    title: 'Parkour Challenge',
    tagline: 'Sprint, double-time jumps across moving sky platforms, hit checkpoints & beat the clock.',
    instructions: 'Use A/D or Left/Right arrows to move and Space/W/Up to jump. Reach every checkpoint flag and enter the emerald finish portal!',
    accentHex: '#F59E0B',
    badgeId: 'badge-sky-runner',
    badgeTitle: 'Skyline Runner',
    unlockItemId: 'unlock-trophy-pedestal',
    unlockItemName: 'Parkour Trophy Pillar',
    baseXp: 110,
    baseCoins: 55,
  },
  {
    id: 'treasure-hunt',
    title: 'Treasure Hunt',
    tagline: 'Decode campus clues, follow the hot/cold scanner, and unlock hidden chests with knowledge.',
    instructions: 'Click grid tiles to scan for buried treasure chests using the distance compass. Answer an educational lock question at each chest to claim loot!',
    accentHex: '#D97706',
    badgeId: 'badge-relic-seeker',
    badgeTitle: 'Relic Seeker',
    unlockItemId: 'unlock-treasure-chest',
    unlockItemName: 'Gilded Relic Chest',
    baseXp: 120,
    baseCoins: 65,
  },
  {
    id: 'quiz-battle',
    title: 'Quiz Battle',
    tagline: 'Face an AI academic rival across STEM, Coding, History & Ecology before the timer hits zero.',
    instructions: 'Pick a subject and difficulty, then answer 6 rapid questions faster and more accurately than Bot Nova to win the duel!',
    accentHex: '#0284C7',
    badgeId: 'badge-quiz-champion',
    badgeTitle: 'Arena Champion',
    unlockItemId: 'unlock-holo-quiz-kiosk',
    unlockItemName: 'Holo-Quiz Terminal',
    baseXp: 115,
    baseCoins: 60,
  },
  {
    id: 'science-challenge',
    title: 'Science Challenge',
    tagline: 'Master virtual circuits, physics launch trajectories & chemistry compound identification.',
    instructions: 'Complete 3 interactive lab stages: close the series/parallel circuit switches, dial the trajectory angle to hit the target, and identify chemical samples.',
    accentHex: '#7C3AED',
    badgeId: 'badge-lab-laureate',
    badgeTitle: 'Lab Laureate',
    unlockItemId: 'unlock-plasma-coil',
    unlockItemName: 'Tesla Plasma Coil',
    baseXp: 130,
    baseCoins: 70,
  },
  {
    id: 'network-puzzle',
    title: 'Network Puzzle',
    tagline: 'Wire network topologies, configure IPv4 subnets, and route packets across campus servers.',
    instructions: 'Click nodes to build a redundant topology connecting every workstation to the core router, then solve IP addressing & subnet mask challenges.',
    accentHex: '#2563EB',
    badgeId: 'badge-packet-master',
    badgeTitle: 'Packet Architect',
    unlockItemId: 'unlock-server-rack',
    unlockItemName: 'Quantum Server Rack',
    baseXp: 130,
    baseCoins: 70,
  },
  {
    id: 'racing',
    title: 'Racing Challenge',
    tagline: 'Pilot an electric solar kart around the circuit, hit all checkpoints, and set a lap record.',
    instructions: 'Steer with W/A/S/D or Arrow keys (or touch buttons). Pass through Checkpoints 1-4 in sequence for 2 laps before time expires!',
    accentHex: '#E11D48',
    badgeId: 'badge-solar-racer',
    badgeTitle: 'Solar Circuit Ace',
    unlockItemId: 'unlock-solar-chevron',
    unlockItemName: 'Turbo Track Arch',
    baseXp: 120,
    baseCoins: 65,
  },
  {
    id: 'farming',
    title: 'Farming Simulator',
    tagline: 'Plant sustainable crops, manage soil moisture, harvest produce & expand your garden plots.',
    instructions: 'Select seeds, plant them in tilled soil, water thirsty plots before they wilt, harvest ripe crops for coins, and unlock extra garden beds!',
    accentHex: '#059669',
    badgeId: 'badge-master-botanist',
    badgeTitle: 'Solarpunk Botanist',
    unlockItemId: 'unlock-golden-greenhouse',
    unlockItemName: 'Botanical Bloom Dome',
    baseXp: 115,
    baseCoins: 60,
  },
];

export const TREASURE_CHEST_BANK: {
  clue: string;
  question: GameQuestion;
  bonusCoins: number;
  bonusXp: number;
}[] = [
  {
    clue: 'Check near the northern solar observatory meridian where sunlight hits first.',
    bonusCoins: 25,
    bonusXp: 35,
    question: {
      question: 'Which planet in our Solar System rotates on its side at roughly 98 degrees axial tilt?',
      options: ['Uranus', 'Mercury', 'Mars', 'Venus'],
      correctIndex: 0,
      hint: 'It is an ice giant beyond Saturn with a pale cyan hue.',
      explanation: 'Uranus has an extreme axial tilt of ~97.77 degrees, causing decades-long seasons.',
    },
  },
  {
    clue: 'A signal echoes along the eastern fiber relay trunk near column 4.',
    bonusCoins: 30,
    bonusXp: 40,
    question: {
      question: 'What is the binary representation of the decimal number 13?',
      options: ['1101', '1011', '1110', '1001'],
      correctIndex: 0,
      hint: 'Add powers of 2: 8 + 4 + 0 + 1.',
      explanation: '13 = 8 + 4 + 1, which corresponds to binary 1101.',
    },
  },
  {
    clue: 'Look along the southern riverbank watershed where reeds filter the water.',
    bonusCoins: 25,
    bonusXp: 35,
    question: {
      question: 'Which gas do plants absorb during photosynthesis to build glucose?',
      options: ['Carbon Dioxide (CO2)', 'Nitrogen (N2)', 'Argon (Ar)', 'Methane (CH4)'],
      correctIndex: 0,
      hint: 'Humans exhale this gas every breath.',
      explanation: 'Chlorophyll captures light energy to combine CO2 and water into glucose and oxygen.',
    },
  },
  {
    clue: 'Ancient sandstone coordinates point toward the western archive terrace.',
    bonusCoins: 35,
    bonusXp: 45,
    question: {
      question: 'Which ancient civilization built the planned brick cities of Mohenjo-daro and Harappa?',
      options: ['Indus Valley Civilization', 'Inca Empire', 'Norse Kingdoms', 'Minoan Crete'],
      correctIndex: 0,
      hint: 'It flourished along a major river system in South Asia around 2500 BCE.',
      explanation: 'The Indus Valley Civilization engineered gridded streets and covered drainage systems.',
    },
  },
  {
    clue: 'A faint magnetic anomaly pulses beneath the central plaza tiles.',
    bonusCoins: 40,
    bonusXp: 50,
    question: {
      question: 'According to Ohm’s Law, if voltage is 12V and resistance is 4 ohms, what is the current?',
      options: ['3 Amperes', '48 Amperes', '8 Amperes', '0.33 Amperes'],
      correctIndex: 0,
      hint: 'I = V / R.',
      explanation: 'Current equals voltage divided by resistance: 12 V / 4 Ω = 3 A.',
    },
  },
];

export const QUIZ_BATTLE_BANKS: Record<'STEM' | 'Coding' | 'History' | 'Ecology', GameQuestion[]> = {
  STEM: [
    {
      question: 'What is the SI unit of electrical resistance?',
      options: ['Ohm', 'Volt', 'Watt', 'Tesla'],
      correctIndex: 0,
      hint: 'Named after physicist Georg Simon Ohm.',
      explanation: 'Resistance is measured in Ohms (Ω).',
    },
    {
      question: 'Which particle carries a negative electric charge in an atom?',
      options: ['Electron', 'Proton', 'Neutron', 'Photon'],
      correctIndex: 0,
      hint: 'It orbits outside the atomic nucleus.',
      explanation: 'Electrons carry a -1 elementary charge while protons carry +1.',
    },
    {
      question: 'What force keeps planets in stable elliptical orbits around the Sun?',
      options: ['Gravity', 'Friction', 'Buoyancy', 'Tension'],
      correctIndex: 0,
      hint: 'Newton formulated its universal inverse-square law.',
      explanation: 'Gravitational attraction provides the centripetal force for planetary orbits.',
    },
    {
      question: 'Water boils at 100 degrees Celsius at standard sea-level pressure. What is that in Kelvin?',
      options: ['373.15 K', '273.15 K', '100 K', '212 K'],
      correctIndex: 0,
      hint: 'Add 273.15 to Celsius.',
      explanation: 'T(K) = T(°C) + 273.15, so 100°C = 373.15 K.',
    },
    {
      question: 'If a car travels 150 km in 2.5 hours, what is its average speed?',
      options: ['60 km/h', '50 km/h', '75 km/h', '65 km/h'],
      correctIndex: 0,
      hint: 'Speed = Distance / Time.',
      explanation: '150 km / 2.5 h = 60 km/h.',
    },
    {
      question: 'Which chemical element has the symbol Au on the periodic table?',
      options: ['Gold', 'Silver', 'Aluminum', 'Argon'],
      correctIndex: 0,
      hint: 'Derived from the Latin word "aurum".',
      explanation: 'Au stands for gold (atomic number 79).',
    },
  ],
  Coding: [
    {
      question: 'What is the time complexity of binary search on a sorted array of N elements?',
      options: ['O(log N)', 'O(N)', 'O(N^2)', 'O(1)'],
      correctIndex: 0,
      hint: 'Each comparison halves the remaining search space.',
      explanation: 'Halving N each step takes at most log2(N) comparisons.',
    },
    {
      question: 'Which data structure follows the Last-In, First-Out (LIFO) principle?',
      options: ['Stack', 'Queue', 'Hash Table', 'Heap'],
      correctIndex: 0,
      hint: 'Think of stacking plates.',
      explanation: 'A stack pushes and pops from the same top end (LIFO).',
    },
    {
      question: 'Which HTTP status code means a resource was not found on the server?',
      options: ['404', '200', '301', '500'],
      correctIndex: 0,
      hint: 'A classic 4xx client-error code.',
      explanation: '404 indicates Not Found; 200 is OK and 500 is Internal Server Error.',
    },
    {
      question: 'In JavaScript/TypeScript, which array method creates a new array with elements passing a test?',
      options: ['filter()', 'forEach()', 'push()', 'sort()'],
      correctIndex: 0,
      hint: 'It keeps items for which your callback returns true.',
      explanation: 'Array.prototype.filter() returns a new array of matching elements.',
    },
    {
      question: 'Which protocol translates human-readable domain names into IP addresses?',
      options: ['DNS', 'FTP', 'SMTP', 'ARP'],
      correctIndex: 0,
      hint: 'Domain Name System.',
      explanation: 'DNS resolves names like example.org into numerical IP addresses.',
    },
    {
      question: 'How many bits make up one byte?',
      options: ['8 bits', '4 bits', '16 bits', '32 bits'],
      correctIndex: 0,
      hint: 'Powers of two: 2^3.',
      explanation: 'One byte consists of 8 bits, representing 256 possible values.',
    },
  ],
  History: [
    {
      question: 'Around 1440, who introduced the movable-type printing press in Europe?',
      options: ['Johannes Gutenberg', 'Galileo Galilei', 'Leonardo da Vinci', 'Isaac Newton'],
      correctIndex: 0,
      hint: 'Born in Mainz, Germany.',
      explanation: 'Gutenberg’s printing press accelerated literacy and scientific sharing.',
    },
    {
      question: 'Which ancient trade network linked East Asia with the Mediterranean world?',
      options: ['The Silk Road', 'The Amber Trail', 'The Spice Strait', 'The Atlantic Triangle'],
      correctIndex: 0,
      hint: 'Named after a prized Chinese textile.',
      explanation: 'The Silk Road carried silk, paper, spices, and cultural exchange across Eurasia.',
    },
    {
      question: 'Who is widely recognized as the world’s first computer programmer for her notes on Babbage’s Analytical Engine?',
      options: ['Ada Lovelace', 'Grace Hopper', 'Marie Curie', 'Katherine Johnson'],
      correctIndex: 0,
      hint: 'She wrote an algorithm for Bernoulli numbers in 1843.',
      explanation: 'Ada Lovelace foresaw general-purpose computing beyond pure arithmetic.',
    },
    {
      question: 'In which city was the ancient Great Library located?',
      options: ['Alexandria', 'Athens', 'Babylon', 'Rome'],
      correctIndex: 0,
      hint: 'A Mediterranean port city in Egypt.',
      explanation: 'The Royal Library of Alexandria was a premier center of ancient scholarship.',
    },
    {
      question: 'Which landmark document of 1215 established that even a monarch is subject to the law?',
      options: ['Magna Carta', 'Treaty of Versailles', 'Rosetta Stone', 'Code of Hammurabi'],
      correctIndex: 0,
      hint: 'Latin for "Great Charter".',
      explanation: 'Magna Carta laid foundational principles for constitutional governance.',
    },
    {
      question: 'Which spacecraft carried astronauts to the first human Moon landing in 1969?',
      options: ['Apollo 11', 'Voyager 1', 'Gemini 4', 'Sputnik 1'],
      correctIndex: 0,
      hint: 'Eagle landed at the Sea of Tranquility.',
      explanation: 'Apollo 11 landed Neil Armstrong and Buzz Aldrin on the Moon on July 20, 1969.',
    },
  ],
  Ecology: [
    {
      question: 'Which renewable source generates electricity using photovoltaic cells?',
      options: ['Solar Energy', 'Geothermal Steam', 'Tidal Turbines', 'Biomass'],
      correctIndex: 0,
      hint: 'Photovoltaic literally means light-electricity.',
      explanation: 'Solar panels convert photons directly into direct-current electricity.',
    },
    {
      question: 'Why are wetlands vital to city watersheds?',
      options: ['They filter pollutants and absorb floodwater', 'They increase asphalt runoff', 'They block photosynthesis', 'They evaporate all groundwater'],
      correctIndex: 0,
      hint: 'Think of wetlands as nature’s sponges and filters.',
      explanation: 'Riparian wetlands trap sediment, absorb nutrients, and buffer storm surges.',
    },
    {
      question: 'What term describes a community of living organisms interacting with their physical environment?',
      options: ['Ecosystem', 'Lithosphere', 'Monoculture', 'Atmosphere'],
      correctIndex: 0,
      hint: 'Includes biotic and abiotic factors together.',
      explanation: 'An ecosystem links organisms, soil, water, air, and solar energy cycles.',
    },
    {
      question: 'Which greenhouse gas is roughly 28 times more potent than CO2 at trapping heat over 100 years?',
      options: ['Methane (CH4)', 'Oxygen (O2)', 'Helium (He)', 'Neon (Ne)'],
      correctIndex: 0,
      hint: 'Emitted from wetlands, livestock, and natural gas leaks.',
      explanation: 'Methane is a powerful short-lived climate pollutant.',
    },
    {
      question: 'In a food web, organisms that make their own food from sunlight are called:',
      options: ['Producers', 'Primary Consumers', 'Decomposers', 'Apex Predators'],
      correctIndex: 0,
      hint: 'Plants and algae occupy this trophic base.',
      explanation: 'Producers (autotrophs) convert solar energy into chemical biomass.',
    },
    {
      question: 'What agricultural practice grows different crops in sequence on the same plot to restore soil nutrients?',
      options: ['Crop Rotation', 'Clear-cutting', 'Overgrazing', 'Salinization'],
      correctIndex: 0,
      hint: 'Legumes often follow grains to replenish nitrogen.',
      explanation: 'Crop rotation preserves soil fertility and reduces pest buildup.',
    },
  ],
};

export const NETWORK_IP_QUESTIONS: {
  prompt: string;
  options: string[];
  correctIndex: number;
  hint: string;
  explanation: string;
}[] = [
  {
    prompt: 'A campus lab uses subnet 192.168.10.0/24. Which subnet mask matches /24?',
    options: ['255.255.255.0', '255.255.0.0', '255.255.255.128', '255.0.0.0'],
    correctIndex: 0,
    hint: '/24 means 24 network bits (three octets of all 1s).',
    explanation: '24 ones in binary = 255.255.255.0, providing 254 usable host addresses.',
  },
  {
    prompt: 'How many usable host IPs exist in a /26 IPv4 subnet (64 total addresses)?',
    options: ['62 usable hosts', '64 usable hosts', '30 usable hosts', '126 usable hosts'],
    correctIndex: 0,
    hint: 'Subtract 2 for the network ID and broadcast address.',
    explanation: '2^(32-26) - 2 = 64 - 2 = 62 usable host addresses.',
  },
  {
    prompt: 'Which IPv4 address belongs to the private RFC 1918 address space?',
    options: ['10.24.5.12', '8.8.8.8', '172.35.0.1', '192.169.1.1'],
    correctIndex: 0,
    hint: 'Private ranges are 10.0.0.0/8, 172.16.0.0/12, and 192.168.0.0/16.',
    explanation: '10.24.5.12 lies inside 10.0.0.0/8; the others are public routable IPs.',
  },
];
