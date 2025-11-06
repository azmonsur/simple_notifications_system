const convertToInternational = (number: string): string => {
  if (!number) return "Invalid Nigerian number";

  // Remove all non-digit characters
  const cleaned = number.replace(/\D/g, "");

  // Check if number starts with '0' and is 11 digits long
  if (cleaned.length === 11 && cleaned.startsWith("0")) {
    return "+234" + cleaned.slice(1);
  }

  // If it already starts with '234' and is valid, return as is
  if (cleaned.startsWith("234") && cleaned.length === 13) {
    return "+" + cleaned;
  }

  // Invalid format
  return "Invalid Nigerian number";
};

export default convertToInternational;
