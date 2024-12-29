const fs = require('fs');
const path = require('path');

const luaDebugTableToJson = (luaString) => {
  // Remove "table: 0xc000..." references
  luaString = luaString.replace(/table: 0x[a-fA-F0-9]+/g, "");

  // Replace `=>` with `:` for key-value pairs
  luaString = luaString.replace(/=>/g, ":");

  // Normalize Lua table keys (e.g., [key] => key:)
  luaString = luaString.replace(/\[([^\]]+)\]/g, '"$1"');

  luaString = luaString.replace(/,(\s*[}\]])/g, "$1");
  

  const data = luaString.trim();
    const lines = data.split('\n');
    const updatedLines = lines.map((line, index) => {
      const trimmedLine = line.trim();

      const nextLine = lines[index + 1] || '';
      const nextLineTrimmed = nextLine.trim();

      if (
        trimmedLine &&
        !trimmedLine.endsWith(',') &&
        !trimmedLine.endsWith('{') &&
        !nextLineTrimmed.startsWith('}')
      ) {
        return line + ','; 
      }

      return line; 
    });

  let output = updatedLines.join('\n');
  output = output.substring(0, output.length - 1);
  return JSON.parse(output);
};

module.exports = { luaDebugTableToJson };
