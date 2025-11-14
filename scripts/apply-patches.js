const fs = require('fs');
const path = require('path');

function copyFile(srcRel, destRel) {
  const src = path.join(__dirname, '..', srcRel);
  const dest = path.join(__dirname, '..', destRel);
  try {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    console.log(`Patched: ${destRel}`);
  } catch (err) {
    console.error(`Failed to patch ${destRel}:`, err.message);
    process.exitCode = 1;
  }
}

// Copy our patched C++ file into node_modules
copyFile(
  'patches_src/react-native-safe-area-context/common/cpp/react/renderer/components/safeareacontext/RNCSafeAreaViewShadowNode.cpp',
  'node_modules/react-native-safe-area-context/common/cpp/react/renderer/components/safeareacontext/RNCSafeAreaViewShadowNode.cpp'
);

// Add more copies here if needed in future
console.log('apply-patches.js completed.');
