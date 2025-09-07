#!/bin/bash
# Setup script for SDK packages with local linking

set -e

echo "Setting up MEUP SDK packages..."

SDK_DIR="./sdk/typescript-sdk"

# Build order matters - types first, then others
PACKAGES=(
  "types"
  "capability-matcher"
  "client"
  "gateway"
  "agent"
)

# First, install base dependencies for each package
for pkg in "${PACKAGES[@]}"; do
  echo "Installing base dependencies for $pkg..."
  cd "$SDK_DIR/$pkg"
  
  # Remove any existing node_modules and package-lock
  rm -rf node_modules package-lock.json
  
  # Install only non-@meup dependencies
  if [ -f package.json ]; then
    # Create a temp package.json without @meup dependencies
    cp package.json package.json.bak
    node -e "
      const pkg = require('./package.json');
      if (pkg.dependencies) {
        Object.keys(pkg.dependencies).forEach(dep => {
          if (dep.startsWith('@meup/')) delete pkg.dependencies[dep];
        });
      }
      if (pkg.devDependencies) {
        Object.keys(pkg.devDependencies).forEach(dep => {
          if (dep.startsWith('@meup/')) delete pkg.devDependencies[dep];
        });
      }
      require('fs').writeFileSync('./package.json', JSON.stringify(pkg, null, 2));
    "
    
    npm install || true
    
    # Restore original package.json
    mv package.json.bak package.json
  fi
  
  cd - > /dev/null
done

# Now link packages
echo "Linking @meup packages..."
for pkg in "${PACKAGES[@]}"; do
  echo "Linking @meup/$pkg..."
  cd "$SDK_DIR/$pkg"
  npm link
  cd - > /dev/null
done

# Link dependencies between packages
echo "Linking package dependencies..."
cd "$SDK_DIR/client"
npm link @meup/types || true
cd - > /dev/null

cd "$SDK_DIR/gateway"
npm link @meup/types @meup/capability-matcher || true
cd - > /dev/null

cd "$SDK_DIR/agent"
npm link @meup/types @meup/client || true
cd - > /dev/null

# Link SDK packages to CLI
echo "Linking SDK to CLI..."
cd ./cli
npm link @meup/gateway @meup/client @meup/agent @meup/capability-matcher || true
cd - > /dev/null

echo "SDK setup complete!"