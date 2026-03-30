// Mock for uuid package
let counter = 0;

module.exports = {
  v4: () => {
    counter++;
    return `mock-uuid-${counter}-${Date.now()}`;
  },
};
