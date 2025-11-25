// International Federation for Produce Standards (IFPS) PLU codes
// Maps PLU codes to USDA search terms for accurate lookups

export const PLU_DATABASE = {
  // Bananas
  '4011': 'banana raw',
  '94011': 'banana raw organic',

  // Apples
  '3283': 'apple honeycrisp raw',
  '4130': 'apple granny smith raw',
  '4131': 'apple gala raw',
  '4133': 'apple golden delicious raw',
  '4139': 'apple granny smith raw',
  '4015': 'apple gala raw',
  '4016': 'apple golden delicious raw',
  '4017': 'apple granny smith raw',
  '4135': 'apple red delicious raw',
  '94130': 'apple granny smith raw organic',
  '94131': 'apple gala raw organic',

  // Oranges
  '3107': 'orange navel raw',
  '4012': 'orange navel raw',
  '94012': 'orange navel raw organic',

  // Pears
  '4409': 'pear bartlett raw',
  '4410': 'pear bosc raw',
  '4416': 'pear anjou raw',

  // Grapes
  '4023': 'grape red seedless raw',
  '4499': 'grape green seedless raw',

  // Berries
  '4087': 'strawberry raw',
  '4033': 'blueberry raw',
  '4036': 'raspberry raw',

  // Stone Fruits
  '4044': 'peach raw',
  '4042': 'nectarine raw',
  '4043': 'plum raw',

  // Melons
  '4031': 'cantaloupe raw',
  '4032': 'watermelon raw',
  '4050': 'honeydew melon raw',

  // Citrus
  '4048': 'lime raw',
  '4053': 'lemon raw',
  '3023': 'grapefruit raw',

  // Tropical
  '4030': 'kiwi raw',
  '4052': 'mango raw',
  '4229': 'papaya raw',
  '4229': 'pineapple raw',

  // Vegetables - Leafy Greens
  '4061': 'lettuce iceberg raw',
  '4062': 'lettuce romaine raw',
  '4076': 'spinach raw',
  '3133': 'kale raw',

  // Vegetables - Cruciferous
  '4060': 'broccoli raw',
  '4069': 'cauliflower raw',
  '4064': 'cabbage green raw',

  // Vegetables - Root
  '4072': 'carrot raw',
  '4073': 'celery raw',
  '4082': 'onion yellow raw',
  '4159': 'onion red raw',
  '4663': 'onion white raw',
  '4087': 'potato russet raw',
  '4088': 'potato red raw',
  '4091': 'sweet potato raw',

  // Vegetables - Peppers
  '4065': 'pepper bell green raw',
  '4688': 'pepper bell red raw',
  '4689': 'pepper bell yellow raw',
  '4690': 'pepper bell orange raw',

  // Vegetables - Other
  '4065': 'cucumber raw',
  '4664': 'tomato raw',
  '4799': 'tomato cherry raw',
  '4078': 'avocado raw',
  '4225': 'zucchini raw',
};

export function lookupPLU(pluCode) {
  const searchTerm = PLU_DATABASE[pluCode];
  if (!searchTerm) {
    return null;
  }

  return {
    searchTerm,
    isOrganic: pluCode.startsWith('9') && pluCode.length === 5
  };
}

export function getPLUName(pluCode) {
  const result = lookupPLU(pluCode);
  if (!result) return null;

  // Convert "banana raw" to "Banana"
  const name = result.searchTerm
    .replace(' raw', '')
    .replace(' organic', '')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return result.isOrganic ? `${name} (Organic)` : name;
}
