#!/bin/bash
# build-lambda-functions.sh - Build and package Lambda functions for Cognito triggers

set -e

echo "🔨 Building Lambda functions for Cognito triggers..."

# Create temporary directory for Lambda packages
TEMP_DIR=$(mktemp -d)
echo "📁 Using temporary directory: $TEMP_DIR"

# Function to build a Lambda function
build_lambda() {
    local function_name=$1
    local source_dir=$2
    
    echo "📦 Building $function_name..."
    
    # Create package directory
    local package_dir="$TEMP_DIR/$function_name"
    mkdir -p "$package_dir"
    
    # Copy source files
    cp "$source_dir/index.js" "$package_dir/"
    
    # Create package.json
    cat > "$package_dir/package.json" << EOF
{
  "name": "$function_name",
  "version": "1.0.0",
  "description": "Lambda function for $function_name",
  "main": "index.js",
  "dependencies": {
    "aws-sdk": "^2.1691.0"
  }
}
EOF
    
    # Install dependencies
    cd "$package_dir"
    npm install --production
    
    # Create zip package
    zip -r "../$function_name.zip" .
    cd - > /dev/null
    
    echo "✅ $function_name packaged successfully"
}

# Build all Lambda functions
build_lambda "lambda-pre-signup" "infrastructure/lambda/pre-signup"
build_lambda "lambda-post-confirmation" "infrastructure/lambda/post-confirmation"
build_lambda "lambda-pre-auth" "infrastructure/lambda/pre-auth"

# Move packages to terraform directory
echo "📦 Moving Lambda packages to terraform directory..."
mv "$TEMP_DIR"/*.zip infrastructure/terraform/

# Clean up
rm -rf "$TEMP_DIR"

echo "🎉 Lambda functions built and packaged successfully!"
echo "📁 Packages created:"
echo "  - infrastructure/terraform/lambda-pre-signup.zip"
echo "  - infrastructure/terraform/lambda-post-confirmation.zip"
echo "  - infrastructure/terraform/lambda-pre-auth.zip"
