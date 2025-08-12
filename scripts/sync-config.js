#!/usr/bin/env node

/**
 * Configuration Sync Script
 * 
 * This script verifies that symlinks are properly set up between the workspace
 * and the frontend/backend repositories for shared configuration.
 */

const fs = require('fs');
const path = require('path');

const WORKSPACE_CONFIG = path.join(__dirname, '..', 'config', 'shared-constants.js');
const FRONTEND_CONFIG = path.join(__dirname, '..', '..', 'r3-frontend', 'config', 'shared-constants.js');
const BACKEND_CONFIG = path.join(__dirname, '..', '..', 'r3-backend', 'config', 'shared-constants.js');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkSymlink(targetPath, linkPath, repoName) {
  log(`\nChecking ${repoName}...`, 'blue');
  
  try {
    const stats = fs.lstatSync(linkPath);
    
    if (stats.isSymbolicLink()) {
      const actualTarget = fs.readlinkSync(linkPath);
      const expectedTarget = path.relative(path.dirname(linkPath), targetPath);
      
      if (actualTarget === expectedTarget) {
        log(`✓ ${repoName} symlink is correctly configured`, 'green');
        return true;
      } else {
        log(`✗ ${repoName} symlink points to wrong target`, 'red');
        log(`  Expected: ${expectedTarget}`, 'yellow');
        log(`  Actual: ${actualTarget}`, 'yellow');
        return false;
      }
    } else {
      log(`✗ ${repoName} config is a regular file, not a symlink`, 'red');
      return false;
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      log(`✗ ${repoName} config file does not exist`, 'red');
    } else {
      log(`✗ Error checking ${repoName}: ${error.message}`, 'red');
    }
    return false;
  }
}

function createSymlink(targetPath, linkPath, repoName) {
  const relativePath = path.relative(path.dirname(linkPath), targetPath);
  
  try {
    // Check if file exists and back it up
    if (fs.existsSync(linkPath)) {
      const backupPath = `${linkPath}.backup.${Date.now()}`;
      fs.renameSync(linkPath, backupPath);
      log(`  Backed up existing file to: ${path.basename(backupPath)}`, 'yellow');
    }
    
    // Create symlink
    fs.symlinkSync(relativePath, linkPath);
    log(`  ✓ Created symlink for ${repoName}`, 'green');
    return true;
  } catch (error) {
    log(`  ✗ Failed to create symlink: ${error.message}`, 'red');
    return false;
  }
}

function main() {
  log('\n=== R3 Configuration Sync ===\n', 'blue');
  
  // Check if workspace config exists
  if (!fs.existsSync(WORKSPACE_CONFIG)) {
    log('✗ Workspace config file does not exist!', 'red');
    log(`  Expected at: ${WORKSPACE_CONFIG}`, 'yellow');
    process.exit(1);
  }
  
  log('✓ Workspace config file found', 'green');
  
  // Check frontend symlink
  const frontendOk = checkSymlink(WORKSPACE_CONFIG, FRONTEND_CONFIG, 'Frontend');
  
  // Check backend symlink
  const backendOk = checkSymlink(WORKSPACE_CONFIG, BACKEND_CONFIG, 'Backend');
  
  // Offer to fix if needed
  if (!frontendOk || !backendOk) {
    log('\n⚠ Some symlinks need to be fixed', 'yellow');
    
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    readline.question('\nDo you want to fix the symlinks? (y/n): ', (answer) => {
      if (answer.toLowerCase() === 'y') {
        log('\nFixing symlinks...', 'blue');
        
        if (!frontendOk) {
          createSymlink(WORKSPACE_CONFIG, FRONTEND_CONFIG, 'Frontend');
        }
        
        if (!backendOk) {
          createSymlink(WORKSPACE_CONFIG, BACKEND_CONFIG, 'Backend');
        }
        
        log('\n✓ Configuration sync complete!', 'green');
      } else {
        log('\nSkipping symlink fixes. Please fix manually.', 'yellow');
      }
      
      readline.close();
    });
  } else {
    log('\n✓ All symlinks are correctly configured!', 'green');
    
    // Show current key values
    try {
      const configContent = fs.readFileSync(WORKSPACE_CONFIG, 'utf8');
      const testKeyMatch = configContent.match(/TEST:\s*'(pk_test_[^']+)'/);
      const liveKeyMatch = configContent.match(/LIVE:\s*'(pk_live_[^']+)'/);
      
      log('\nCurrent Stripe Keys:', 'blue');
      if (testKeyMatch) {
        log(`  Test: ${testKeyMatch[1].substring(0, 30)}...`, 'yellow');
      }
      if (liveKeyMatch) {
        log(`  Live: ${liveKeyMatch[1].substring(0, 30)}...`, 'yellow');
      }
    } catch (error) {
      // Ignore errors reading config
    }
  }
}

main();