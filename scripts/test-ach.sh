#!/bin/bash

# ACH Testing Helper Script
# Makes it easy to test ACH payment flows

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
WORKSPACE_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$WORKSPACE_DIR/../r3-backend"

# Functions
print_header() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if backend server is running
check_backend() {
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health | grep -q "200"; then
        return 0
    else
        return 1
    fi
}

# Start backend if not running
ensure_backend() {
    if ! check_backend; then
        print_warning "Backend server is not running"
        echo "Starting backend server..."
        cd "$BACKEND_DIR"
        npm run dev &
        BACKEND_PID=$!
        sleep 5
        if check_backend; then
            print_success "Backend server started (PID: $BACKEND_PID)"
        else
            print_error "Failed to start backend server"
            exit 1
        fi
    else
        print_success "Backend server is running"
    fi
}

# Main menu
show_menu() {
    print_header "ACH Payment Testing Tool"
    echo "Select a test scenario:"
    echo ""
    echo "  1) Successful ACH Payment"
    echo "  2) Failed ACH Payment (Account Closed)"
    echo "  3) Disputed ACH Payment"
    echo "  4) Test with Stripe CLI"
    echo "  5) View webhook logs"
    echo "  6) Check test account numbers"
    echo "  0) Exit"
    echo ""
    read -p "Enter your choice [0-6]: " choice
}

# Run test scenario
run_test() {
    local scenario=$1
    print_header "Running ACH Test: ${scenario}"
    
    ensure_backend
    
    cd "$SCRIPT_DIR"
    node test-ach-flow.js "$scenario"
}

# Test with Stripe CLI
test_stripe_cli() {
    print_header "Testing with Stripe CLI"
    
    # Check if Stripe CLI is installed
    if ! command -v stripe &> /dev/null; then
        print_error "Stripe CLI is not installed"
        echo "Install it with: brew install stripe/stripe-cli/stripe"
        exit 1
    fi
    
    ensure_backend
    
    print_info "Starting Stripe webhook listener..."
    echo "Press Ctrl+C to stop"
    echo ""
    
    stripe listen --forward-to http://localhost:3000/webhook/stripe
}

# View logs
view_logs() {
    print_header "Webhook Logs"
    
    if [ -f "$BACKEND_DIR/logs/webhooks.log" ]; then
        tail -f "$BACKEND_DIR/logs/webhooks.log"
    else
        print_warning "No webhook logs found"
        echo "Logs will appear here when webhooks are received"
    fi
}

# Show test accounts
show_test_accounts() {
    print_header "Stripe Test ACH Account Numbers"
    
    echo "Use these account numbers for testing:"
    echo ""
    echo "┌─────────────────────┬──────────────┬─────────────────┬────────────────────────┐"
    echo "│ Scenario            │ Routing      │ Account         │ Result                 │"
    echo "├─────────────────────┼──────────────┼─────────────────┼────────────────────────┤"
    echo "│ Success             │ 110000000    │ 000123456789    │ Payment succeeds       │"
    echo "│ Account Closed      │ 110000000    │ 000111111113    │ Fails - account closed │"
    echo "│ High Risk           │ 110000000    │ 000000004954    │ Blocked - fraud risk   │"
    echo "│ Insufficient Funds  │ 110000000    │ 000111111116    │ Fails - NSF            │"
    echo "└─────────────────────┴──────────────┴─────────────────┴────────────────────────┘"
    echo ""
    print_info "For microdeposit verification, use amounts: 32 and 45"
}

# Cleanup function
cleanup() {
    if [ ! -z "$BACKEND_PID" ]; then
        print_warning "Stopping backend server..."
        kill $BACKEND_PID 2>/dev/null || true
    fi
}

# Set up trap for cleanup
trap cleanup EXIT

# Main loop
while true; do
    show_menu
    
    case $choice in
        1)
            run_test "success"
            ;;
        2)
            run_test "failure"
            ;;
        3)
            run_test "dispute"
            ;;
        4)
            test_stripe_cli
            ;;
        5)
            view_logs
            ;;
        6)
            show_test_accounts
            ;;
        0)
            print_info "Exiting..."
            exit 0
            ;;
        *)
            print_error "Invalid choice. Please try again."
            ;;
    esac
    
    echo ""
    read -p "Press Enter to continue..."
done