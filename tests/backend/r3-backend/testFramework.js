// Testing framework for backend services
// Provides utilities for unit, integration, and load testing

import { strict as assert } from 'assert';
import { performance } from 'perf_hooks';

// Test runner
class TestRunner {
  constructor(name) {
    this.name = name;
    this.tests = [];
    this.beforeEach = null;
    this.afterEach = null;
    this.beforeAll = null;
    this.afterAll = null;
  }

  describe(description, fn) {
    const suite = new TestRunner(description);
    fn.call(suite);
    this.tests.push(suite);
    return suite;
  }

  it(description, fn) {
    this.tests.push({
      description,
      fn,
      type: 'test'
    });
  }

  before(fn) {
    this.beforeAll = fn;
  }

  after(fn) {
    this.afterAll = fn;
  }

  beforeEachTest(fn) {
    this.beforeEach = fn;
  }

  afterEachTest(fn) {
    this.afterEach = fn;
  }

  async run(indent = 0) {
    const prefix = '  '.repeat(indent);
    console.log(`${prefix}${this.name}`);

    const results = {
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0
    };

    const start = performance.now();

    // Run beforeAll
    if (this.beforeAll) {
      try {
        await this.beforeAll();
      } catch (error) {
        console.error(`${prefix}  ✗ beforeAll hook failed: ${error.message}`);
        results.failed = this.tests.length;
        return results;
      }
    }

    // Run tests
    for (const test of this.tests) {
      if (test instanceof TestRunner) {
        // Nested suite
        const suiteResults = await test.run(indent + 1);
        results.passed += suiteResults.passed;
        results.failed += suiteResults.failed;
        results.skipped += suiteResults.skipped;
      } else {
        // Individual test
        const testStart = performance.now();

        try {
          // Run beforeEach
          if (this.beforeEach) {
            await this.beforeEach();
          }

          // Run test
          await test.fn();

          // Run afterEach
          if (this.afterEach) {
            await this.afterEach();
          }

          const duration = performance.now() - testStart;
          console.log(`${prefix}  ✓ ${test.description} (${duration.toFixed(0)}ms)`);
          results.passed++;
        } catch (error) {
          const duration = performance.now() - testStart;
          console.error(`${prefix}  ✗ ${test.description} (${duration.toFixed(0)}ms)`);
          console.error(`${prefix}    ${error.message}`);
          if (error.stack) {
            console.error(`${prefix}    ${error.stack.split('\n').slice(1, 3).join('\n')}`);
          }
          results.failed++;
        }
      }
    }

    // Run afterAll
    if (this.afterAll) {
      try {
        await this.afterAll();
      } catch (error) {
        console.error(`${prefix}  ✗ afterAll hook failed: ${error.message}`);
      }
    }

    results.duration = performance.now() - start;
    return results;
  }
}

// Assertion helpers
export const expect = {
  toBe(actual, expected, message) {
    assert.strictEqual(actual, expected, message || `Expected ${actual} to be ${expected}`);
  },

  toEqual(actual, expected, message) {
    assert.deepStrictEqual(actual, expected, message || 'Expected objects to be equal');
  },

  toBeTruthy(actual, message) {
    assert.ok(actual, message || `Expected ${actual} to be truthy`);
  },

  toBeFalsy(actual, message) {
    assert.ok(!actual, message || `Expected ${actual} to be falsy`);
  },

  toThrow(fn, expectedError, message) {
    assert.throws(fn, expectedError, message);
  },

  async toReject(promise, expectedError, message) {
    await assert.rejects(promise, expectedError, message);
  },

  toContain(actual, expected, message) {
    if (typeof actual === 'string') {
      assert.ok(actual.includes(expected), message || `Expected "${actual}" to contain "${expected}"`);
    } else if (Array.isArray(actual)) {
      assert.ok(actual.includes(expected), message || `Expected array to contain ${expected}`);
    } else {
      throw new Error('toContain only works with strings and arrays');
    }
  },

  toHaveProperty(obj, property, value) {
    assert.ok(property in obj, `Expected object to have property "${property}"`);
    if (value !== undefined) {
      assert.strictEqual(obj[property], value, `Expected property "${property}" to be ${value}`);
    }
  },

  toBeGreaterThan(actual, expected, message) {
    assert.ok(actual > expected, message || `Expected ${actual} to be greater than ${expected}`);
  },

  toBeLessThan(actual, expected, message) {
    assert.ok(actual < expected, message || `Expected ${actual} to be less than ${expected}`);
  },

  toMatchObject(actual, expected, message) {
    for (const key in expected) {
      if (expected.hasOwnProperty(key)) {
        assert.strictEqual(actual[key], expected[key],
          message || `Expected property "${key}" to be ${expected[key]} but got ${actual[key]}`);
      }
    }
  }
};

// Mock utilities
export class Mock {
  constructor(name = 'mock') {
    this.name = name;
    this.calls = [];
    this.returnValue = undefined;
    this.implementation = null;
    this.throwError = null;
  }

  fn(...args) {
    this.calls.push(args);

    if (this.throwError) {
      throw this.throwError;
    }

    if (this.implementation) {
      return this.implementation(...args);
    }

    return this.returnValue;
  }

  returns(value) {
    this.returnValue = value;
    return this;
  }

  throws(error) {
    this.throwError = error;
    return this;
  }

  implements(fn) {
    this.implementation = fn;
    return this;
  }

  reset() {
    this.calls = [];
    this.returnValue = undefined;
    this.implementation = null;
    this.throwError = null;
  }

  wasCalled() {
    return this.calls.length > 0;
  }

  wasCalledWith(...args) {
    return this.calls.some(call =>
      args.every((arg, i) => arg === call[i])
    );
  }

  callCount() {
    return this.calls.length;
  }

  lastCall() {
    return this.calls[this.calls.length - 1];
  }
}

// HTTP test client
export class TestClient {
  constructor(app) {
    this.app = app;
  }

  async request(method, path, options = {}) {
    const { body, headers = {}, query = {} } = options;

    // Build query string
    const queryString = new URLSearchParams(query).toString();
    const fullPath = queryString ? `${path}?${queryString}` : path;

    // Create mock request and response
    const req = {
      method,
      path: fullPath,
      headers: {
        'content-type': 'application/json',
        ...headers
      },
      body,
      query,
      ip: '127.0.0.1',
      get: (header) => req.headers[header.toLowerCase()]
    };

    const res = {
      statusCode: 200,
      headers: {},
      body: null,

      status(code) {
        this.statusCode = code;
        return this;
      },

      set(header, value) {
        this.headers[header] = value;
        return this;
      },

      json(data) {
        this.headers['content-type'] = 'application/json';
        this.body = data;
      },

      send(data) {
        this.body = data;
      },

      end(data) {
        if (data) {this.body = data;}
      }
    };

    // Call the app
    await new Promise((resolve) => {
      const middleware = this.app._router.stack
        .filter(layer => layer.route && layer.route.path === path)
        .find(layer => layer.route.methods[method.toLowerCase()]);

      if (middleware) {
        const handlers = middleware.route.stack.map(layer => layer.handle);

        const next = (error) => {
          if (error) {
            res.statusCode = error.status || 500;
            res.json({ error: error.message });
          }
          resolve();
        };

        // Execute handlers in sequence
        let index = 0;
        const runHandler = async () => {
          if (index >= handlers.length) {
            resolve();
            return;
          }

          const handler = handlers[index++];
          try {
            await handler(req, res, runHandler);
          } catch (error) {
            next(error);
          }
        };

        runHandler();
      } else {
        res.statusCode = 404;
        res.json({ error: 'Not found' });
        resolve();
      }
    });

    return {
      status: res.statusCode,
      headers: res.headers,
      body: res.body
    };
  }

  get(path, options) {
    return this.request('GET', path, options);
  }

  post(path, options) {
    return this.request('POST', path, options);
  }

  put(path, options) {
    return this.request('PUT', path, options);
  }

  delete(path, options) {
    return this.request('DELETE', path, options);
  }
}

// Load testing utilities
export class LoadTester {
  constructor(options = {}) {
    this.concurrency = options.concurrency || 10;
    this.duration = options.duration || 60000; // 1 minute
    this.rampUp = options.rampUp || 0;
    this.results = [];
  }

  async run(testFn) {
    console.log(`Starting load test: ${this.concurrency} concurrent users`);

    const startTime = Date.now();
    const workers = [];

    // Ramp up workers
    for (let i = 0; i < this.concurrency; i++) {
      const delay = this.rampUp ? (this.rampUp / this.concurrency) * i : 0;

      workers.push(
        new Promise(async (resolve) => {
          await new Promise(r => setTimeout(r, delay));

          while (Date.now() - startTime < this.duration) {
            const requestStart = performance.now();
            let success = true;
            let error = null;

            try {
              await testFn();
            } catch (e) {
              success = false;
              error = e.message;
            }

            const duration = performance.now() - requestStart;
            this.results.push({
              timestamp: Date.now(),
              duration,
              success,
              error
            });
          }

          resolve();
        })
      );
    }

    await Promise.all(workers);

    return this.analyze();
  }

  analyze() {
    const successful = this.results.filter(r => r.success);
    const failed = this.results.filter(r => !r.success);
    const durations = successful.map(r => r.duration).sort((a, b) => a - b);

    const stats = {
      total: this.results.length,
      successful: successful.length,
      failed: failed.length,
      errorRate: `${(failed.length / this.results.length * 100).toFixed(2)}%`,
      requestsPerSecond: (this.results.length / (this.duration / 1000)).toFixed(2),
      averageLatency: `${(durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2)}ms`,
      minLatency: `${Math.min(...durations).toFixed(2)}ms`,
      maxLatency: `${Math.max(...durations).toFixed(2)}ms`,
      p50: `${this.percentile(durations, 0.5).toFixed(2)}ms`,
      p95: `${this.percentile(durations, 0.95).toFixed(2)}ms`,
      p99: `${this.percentile(durations, 0.99).toFixed(2)}ms`
    };

    // Group errors
    if (failed.length > 0) {
      const errors = {};
      failed.forEach(r => {
        errors[r.error] = (errors[r.error] || 0) + 1;
      });
      stats.errors = errors;
    }

    return stats;
  }

  percentile(values, p) {
    if (values.length === 0) {return 0;}
    const index = Math.ceil(values.length * p) - 1;
    return values[Math.max(0, index)];
  }
}

// Export main test runner
export const describe = (name, fn) => {
  const runner = new TestRunner(name);
  fn.call(runner);
  return runner;
};

// Run all tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Running tests...\n');

  const startTime = Date.now();
  const runner = new TestRunner('All Tests');

  // Import and run all test files
  // This would be expanded to dynamically load all test files

  runner.run().then(results => {
    const duration = Date.now() - startTime;
    console.log(`\n${results.passed} passed, ${results.failed} failed`);
    console.log(`Time: ${(duration / 1000).toFixed(2)}s`);

    process.exit(results.failed > 0 ? 1 : 0);
  });
}
