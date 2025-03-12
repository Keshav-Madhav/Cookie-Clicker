export const formatNumberInWords = (num) => {
  if (num < 10000) return num.toString(); // No formatting needed for small numbers

  const suffixes = [
    "", "Thousand", "Million", "Billion", "Trillion", "Quadrillion", "Quintillion", 
    "Sextillion", "Septillion", "Octillion", "Nonillion", "Decillion", "Undecillion", 
    "Duodecillion", "Tredecillion", "Quattuordecillion", "Quindecillion", "Sexdecillion", 
    "Septendecillion", "Octodecillion", "Novemdecillion", "Vigintillion", "Unvigintillion", 
    "Duovigintillion", "Trevigintillion", "Quattuorvigintillion", "Quinvigintillion", 
    "Sexvigintillion", "Septenvigintillion", "Octovigintillion", "Novemvigintillion", "Trigintillion"
  ];
  
  let tier = Math.floor(Math.log10(num) / 3); // Determine the suffix tier
  if (tier >= suffixes.length) tier = suffixes.length - 1; // Cap at the highest suffix

  const scaled = num / Math.pow(10, tier * 3); // Scale number to fit the tier
  const formatted = scaled % 1 === 0 ? scaled.toFixed(0) : scaled.toFixed(2); // Show decimals only if non-zero

  return `${formatted} ${suffixes[tier]}`; // Format properly with a space
};
