#!/bin/bash
# Database Migration Script for Telehealth CRM
# HIPAA-compliant production database setup

set -e

echo "🚀 Starting Database Migration Process"

# Configuration
ENVIRONMENT=${1:-production}
DATABASE_URL=${DATABASE_URL:-""}
MIGRATION_MODE=${2:-deploy}

if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL environment variable is required"
    exit 1
fi

echo "📊 Environment: $ENVIRONMENT"
echo "📊 Migration Mode: $MIGRATION_MODE"
echo "📊 Database: ${DATABASE_URL%%@*}@[HIDDEN]"

# Navigate to database package
cd packages/db

echo "📦 Installing Prisma dependencies..."
npm install

echo "🔧 Generating Prisma client..."
npx prisma generate

echo "📋 Checking database connection..."
npx prisma db pull --preview-feature

echo "📊 Current database schema status:"
npx prisma db status

case $MIGRATION_MODE in
    "deploy")
        echo "🚀 Deploying migrations to production..."
        npx prisma migrate deploy
        ;;
    "dev")
        echo "🛠️ Running development migrations..."
        npx prisma migrate dev --name "production-deployment"
        ;;
    "reset")
        echo "⚠️ WARNING: Resetting database (DESTRUCTIVE OPERATION)"
        read -p "Are you sure you want to reset the database? (yes/no): " confirm
        if [ "$confirm" = "yes" ]; then
            npx prisma migrate reset --force
        else
            echo "❌ Database reset cancelled"
            exit 1
        fi
        ;;
    "seed")
        echo "🌱 Seeding database with initial data..."
        npx prisma db seed
        ;;
    *)
        echo "❌ Invalid migration mode: $MIGRATION_MODE"
        echo "Valid modes: deploy, dev, reset, seed"
        exit 1
        ;;
esac

echo "✅ Database migration completed successfully!"

echo "📊 Final database status:"
npx prisma db status

echo "🎉 Database is ready for production use!"
