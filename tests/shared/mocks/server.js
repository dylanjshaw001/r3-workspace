// MSW Server setup for tests
const { setupServer } = require('msw/node');
const { handlers } = require('../helpers/utils/mock-handlers');
const { achHandlers } = require('./ach-handlers');
const { achHybridHandlers } = require('./ach-hybrid-handlers');

// Combine all handlers
const allHandlers = [...handlers, ...achHandlers, ...achHybridHandlers];

// Create server instance
const server = setupServer(...allHandlers);

// Export server and utilities
module.exports = {
  server
};