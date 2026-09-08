// A static list of real, commonly-searched brand and product names, used
// only to help finish a Price Finder search-as-you-type (see
// src/screens/PriceFinder.jsx) — never shown as if it were a result itself.
// This exists because getting the same suggestions from a live source
// (e.g. SerpApi's Google Autocomplete) would cost one request per keystroke
// against the same 250-search/month quota the actual price search uses, so
// a free, offline list was chosen instead of a live one. A list like this
// can never cover every product that exists — that ceiling is inherent to
// the free/offline approach, not a bug — so it's kept broad across many
// categories and worth adding to over time. Every entry is a real
// brand/model name, never generated or fabricated.
export const PRICE_FINDER_SUGGESTIONS = [
  // Vacuums / home care
  'Dyson', 'Dyson V15', 'Dyson V11', 'Dyson V8', 'Dyson Airwrap', 'Dyson Supersonic', 'Dyson Gen5detect',
  'Dyson Cyclone', 'Dyson Pure Cool', 'Shark', 'Shark Navigator', 'Shark Vacuum', 'Shark Steam Mop',
  'iRobot', 'iRobot Roomba', 'Roomba', 'Bissell', 'Bissell Carpet Cleaner', 'Bissell Crosswave', 'Tineco',
  'Tineco Vacuum', 'Hoover Vacuum', 'Eureka Vacuum',

  // Phones / tablets
  'Apple', 'iPhone 16', 'iPhone 16 Pro', 'iPhone 16 Pro Max', 'iPhone 15', 'iPhone 14', 'iPhone SE',
  'Samsung', 'Samsung Galaxy S24', 'Samsung Galaxy S24 Ultra', 'Samsung Galaxy Z Fold', 'Samsung Galaxy Z Flip',
  'Samsung Galaxy A', 'Google Pixel', 'Google Pixel 9', 'Google Pixel Pro', 'OnePlus', 'Motorola Phone',
  'iPad', 'iPad Pro', 'iPad Air', 'iPad Mini', 'Samsung Galaxy Tab', 'Amazon Fire Tablet',
  'Microsoft Surface', 'Microsoft Surface Pro',

  // Wearables / audio
  'Apple Watch', 'Apple Watch Ultra', 'AirPods Pro', 'AirPods Max', 'AirPods', 'Samsung Galaxy Watch',
  'Samsung Galaxy Buds', 'Sony WH-1000XM5', 'Sony Headphones', 'Bose', 'Bose QuietComfort', 'Bose Headphones',
  'Bose Soundlink', 'JBL Speaker', 'JBL Headphones', 'Beats Headphones', 'Beats Studio', 'Beats Solo',
  'Fitbit', 'Fitbit Charge', 'Fitbit Versa', 'Garmin', 'Garmin Watch', 'Garmin Fenix', 'Whoop',

  // Laptops / computers
  'MacBook Air', 'MacBook Pro', 'iMac', 'Mac Mini', 'Dell', 'Dell XPS Laptop', 'Dell Inspiron', 'HP Laptop',
  'HP Pavilion', 'HP Spectre', 'Lenovo', 'Lenovo ThinkPad', 'Lenovo Legion', 'Asus Laptop', 'Asus ROG',
  'Acer Laptop', 'Microsoft Surface Laptop', 'Razer Laptop', 'MSI Laptop', 'Logitech', 'Logitech Mouse',
  'Logitech Keyboard', 'Razer Keyboard', 'Corsair Keyboard',

  // TVs / home theater
  'Samsung TV', 'Samsung 65 inch TV', 'Samsung QLED', 'Samsung Frame TV', 'LG', 'LG OLED TV', 'LG TV',
  'Sony TV', 'Sony Bravia', 'TCL TV', 'Vizio TV', 'Hisense TV', 'Roku TV', 'Roku Streaming Stick',
  'Amazon Fire TV', 'Apple TV', 'Chromecast',

  // Gaming
  'PlayStation 5', 'PS5', 'PlayStation 5 Controller', 'Xbox Series X', 'Xbox Series S', 'Xbox Controller',
  'Nintendo Switch', 'Nintendo Switch OLED', 'Nintendo Switch Lite', 'Steam Deck', 'Meta Quest',
  'Meta Quest 3', 'Oculus',

  // Cameras / smart home
  'GoPro', 'GoPro Hero', 'Canon Camera', 'Canon EOS', 'Nikon Camera', 'Sony Camera', 'Sony Alpha',
  'DJI Drone', 'DJI Mini', 'Ring Doorbell', 'Ring Camera', 'Nest Camera', 'Nest Thermostat', 'Arlo Camera',

  // Kitchen appliances
  'KitchenAid', 'KitchenAid Stand Mixer', 'KitchenAid Food Processor', 'KitchenAid Blender', 'Instant Pot',
  'Instant Pot Duo', 'Ninja', 'Ninja Blender', 'Ninja Air Fryer', 'Ninja Foodi', 'Vitamix', 'Vitamix Blender',
  'Keurig', 'Keurig Coffee Maker', 'Nespresso', 'Nespresso Machine', 'Breville', 'Breville Espresso Machine',
  'Breville Toaster Oven', 'Cuisinart', 'Cuisinart Food Processor', 'Cuisinart Coffee Maker', 'Hamilton Beach',
  'Crock-Pot', 'Crock-Pot Slow Cooker', 'Instant Vortex Air Fryer', 'Cosori Air Fryer',

  // Large appliances
  'Samsung Refrigerator', 'LG Refrigerator', 'Whirlpool Refrigerator', 'GE Refrigerator',
  'Frigidaire Refrigerator', 'Samsung Washer', 'LG Washer', 'Maytag Washer', 'Whirlpool Dryer',
  'Bosch Dishwasher', 'KitchenAid Dishwasher',

  // Beauty / personal care
  'Revlon Hair Dryer', 'T3 Hair Dryer', 'GHD Straightener', 'CHI Straightener', 'Oral-B Electric Toothbrush',
  'Philips Sonicare', 'Waterpik', 'Theragun', 'Hyperice', 'Foreo',

  // Shoes / apparel
  'Nike', 'Nike Air Force 1', 'Nike Air Max', 'Nike Dunk', 'Nike Pegasus', 'Nike Blazer', 'Nike React',
  'Adidas', 'Adidas Ultraboost', 'Adidas Samba', 'Adidas Stan Smith', 'Adidas Gazelle', 'New Balance',
  'New Balance 990', 'New Balance 550', 'Vans', 'Vans Old Skool', 'Vans Sk8-Hi', 'Converse',
  'Converse Chuck Taylor', 'Puma', 'Reebok', 'Under Armour', "Levi's", "Levi's Jeans", 'Wrangler Jeans',
  'Ray-Ban', 'Ray-Ban Sunglasses', 'Oakley Sunglasses', 'Crocs', 'Skechers', 'Timberland Boots', 'Ugg Boots',
  'Hoka Shoes', 'Brooks Running Shoes', 'Asics Running Shoes', 'On Cloud Shoes', 'Birkenstock',
  'North Face Jacket', 'Patagonia Jacket', 'Columbia Jacket', 'Carhartt',

  // Tools / outdoor
  'DeWalt', 'DeWalt Drill', 'DeWalt Impact Driver', 'Milwaukee Tools', 'Milwaukee Drill', 'Makita Tools',
  'Ryobi Tools', 'Bosch Tools', 'Craftsman Tools', 'Weber Grill', 'Traeger Grill', 'Blackstone Griddle',
  'Yeti', 'Yeti Cooler', 'Yeti Tumbler', 'Stanley Tumbler', 'Coleman Cooler', 'Igloo Cooler',

  // Furniture / home
  'La-Z-Boy Recliner', 'IKEA Sofa', 'Wayfair Sofa', 'Herman Miller Chair', 'Herman Miller Aeron',
  'Purple Mattress', 'Casper Mattress', 'Nectar Mattress', 'Tempur-Pedic Mattress', 'Sleep Number Bed',

  // Baby / kids
  'Graco Car Seat', 'Chicco Car Seat', 'UPPAbaby Stroller', 'Nuna Car Seat', 'Britax Car Seat',
  'Fisher-Price', 'Baby Bjorn',

  // Toys / games
  'LEGO', 'LEGO Star Wars', 'LEGO City', 'Barbie', 'Hot Wheels', 'Nerf Blaster', 'Pokemon Cards', 'Monopoly',

  // Pet
  'PetSafe', 'Furbo', 'Kong Dog Toy', 'PetKit',

  // Office / printers
  'HP Printer', 'Canon Printer', 'Epson Printer', 'Brother Printer',

  // Fitness
  'Peloton', 'Peloton Bike', 'NordicTrack', 'Bowflex',
]
