#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}MEW Protocol Package Publisher${NC}"
echo "================================"
echo ""

# Prompt for OTP
read -p "Enter your npm OTP code: " OTP

if [ -z "$OTP" ]; then
    echo -e "${RED}Error: OTP is required${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Publishing packages in dependency order...${NC}"
echo ""

# Base directory
BASE_DIR="/Users/rj/Git/rjcorwin/mew-protocol/sdk/typescript-sdk"

# Array of packages in dependency order
declare -a packages=(
    "types"
    "capability-matcher"
    "client"
    "participant"
    "gateway"
    "agent"
)

# Track success/failure
failed_packages=()
successful_packages=()

# Function to publish a package
publish_package() {
    local pkg_name=$1
    local pkg_dir="$BASE_DIR/$pkg_name"

    echo -e "${YELLOW}Publishing @mew-protocol/$pkg_name...${NC}"

    if [ ! -d "$pkg_dir" ]; then
        echo -e "${RED}Error: Directory $pkg_dir not found${NC}"
        failed_packages+=("$pkg_name")
        return 1
    fi

    cd "$pkg_dir"

    # Get version from package.json
    version=$(node -p "require('./package.json').version")

    # Try to publish
    if npm publish --access public --otp="$OTP" 2>&1 | tee /tmp/npm-publish-$pkg_name.log; then
        echo -e "${GREEN}✓ Successfully published @mew-protocol/$pkg_name@$version${NC}"
        successful_packages+=("$pkg_name@$version")
        echo ""
        return 0
    else
        # Check if it failed because package already exists
        if grep -q "You cannot publish over the previously published versions" /tmp/npm-publish-$pkg_name.log; then
            echo -e "${YELLOW}⚠ Package @mew-protocol/$pkg_name@$version already exists on npm${NC}"
            successful_packages+=("$pkg_name@$version (already published)")
            echo ""
            return 0
        else
            echo -e "${RED}✗ Failed to publish @mew-protocol/$pkg_name${NC}"
            failed_packages+=("$pkg_name")
            echo ""
            return 1
        fi
    fi
}

# Publish each package
for package in "${packages[@]}"; do
    publish_package "$package"

    # If OTP expires, prompt for new one
    if [ $? -ne 0 ]; then
        if grep -q "code EOTP" /tmp/npm-publish-$package.log; then
            echo -e "${YELLOW}OTP may have expired. Please enter a new OTP code:${NC}"
            read -p "Enter new OTP (or press Enter to skip remaining packages): " NEW_OTP
            if [ -n "$NEW_OTP" ]; then
                OTP="$NEW_OTP"
                # Retry the failed package
                publish_package "$package"
            else
                echo -e "${YELLOW}Skipping remaining packages${NC}"
                break
            fi
        fi
    fi
done

# Summary
echo ""
echo "================================"
echo -e "${YELLOW}Publishing Summary${NC}"
echo "================================"

if [ ${#successful_packages[@]} -gt 0 ]; then
    echo -e "${GREEN}Successfully published:${NC}"
    for pkg in "${successful_packages[@]}"; do
        echo "  ✓ @mew-protocol/$pkg"
    done
fi

if [ ${#failed_packages[@]} -gt 0 ]; then
    echo ""
    echo -e "${RED}Failed to publish:${NC}"
    for pkg in "${failed_packages[@]}"; do
        echo "  ✗ @mew-protocol/$pkg"
    done
    echo ""
    echo -e "${YELLOW}To retry failed packages, run:${NC}"
    for pkg in "${failed_packages[@]}"; do
        echo "  cd $BASE_DIR/$pkg && npm publish --access public --otp=YOUR_OTP"
    done
fi

echo ""
echo -e "${GREEN}Done!${NC}"

# Clean up temp files
rm -f /tmp/npm-publish-*.log