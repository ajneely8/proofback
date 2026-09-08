// A static list of real, commonly-searched brand and product names, used
// only to help finish a Price Finder search-as-you-type (see
// src/screens/PriceFinder.jsx) — never shown as if it were a result itself.
// This exists because getting the same suggestions from a live source
// (e.g. SerpApi's Google Autocomplete) would cost one request per keystroke
// against the same 250-search/month quota the actual price search uses, so
// a free, offline list was chosen instead of a live one. It won't cover
// every product that exists, but it's real brand/model names, not
// generated or fabricated — so it's still worth adding to over time (a new
// brand/model here just needs adding to the array).
export const PRICE_FINDER_SUGGESTIONS = [
  // Vacuums / home care
  'Dyson', 'Dyson V15', 'Dyson V8', 'Dyson V11', 'Dyson Airwrap', 'Dyson Supersonic', 'Dyson Gen5detect',
  'Shark', 'Shark Navigator', 'Shark Vacuum', 'iRobot', 'iRobot Roomba', 'Bissell', 'Bissell Carpet Cleaner',

  // Phones / computers / electronics
  'Apple', 'iPhone 16', 'iPhone 16 Pro', 'iPhone 15', 'AirPods Pro', 'AirPods Max', 'MacBook Air', 'MacBook Pro',
  'iPad', 'iPad Pro', 'Apple Watch', 'Samsung', 'Samsung Galaxy S24', 'Samsung Galaxy Tab', 'Samsung Galaxy Watch',
  'Samsung TV', 'Samsung 65 inch TV', 'LG', 'LG OLED TV', 'Sony', 'Sony PlayStation 5', 'Sony WH-1000XM5',
  'Sony Headphones', 'Bose', 'Bose QuietComfort', 'Bose Headphones', 'Dell', 'Dell XPS Laptop', 'HP', 'HP Laptop',
  'Lenovo', 'Lenovo ThinkPad', 'Microsoft Surface', 'Nintendo Switch', 'GoPro', 'GoPro Hero', 'Fitbit',
  'Fitbit Charge', 'Garmin', 'Garmin Watch', 'Logitech', 'Logitech Mouse',

  // Kitchen / appliances
  'KitchenAid', 'KitchenAid Stand Mixer', 'KitchenAid Food Processor', 'Instant Pot', 'Ninja', 'Ninja Blender',
  'Ninja Air Fryer', 'Keurig', 'Keurig Coffee Maker', 'Vitamix', 'Vitamix Blender', 'Nespresso',

  // Shoes / apparel
  'Nike', 'Nike Air Force 1', 'Nike Air Max', 'Nike Dunk', 'Nike Pegasus', 'Adidas', 'Adidas Ultraboost',
  'Adidas Samba', 'New Balance', 'New Balance 990', 'Vans', 'Vans Old Skool', 'Under Armour', "Levi's",
  "Levi's Jeans", 'Ray-Ban', 'Ray-Ban Sunglasses', 'Crocs', 'Skechers',

  // Tools / outdoor
  'DeWalt', 'DeWalt Drill', 'Milwaukee Tools', 'Weber Grill', 'Yeti', 'Yeti Cooler', 'Yeti Tumbler',
]
