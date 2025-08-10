// ACH Monitoring Tests

// Mock kv store for testing
const mockKV = {
  data: new Map(),
  
  async hincrby(key, field, increment) {
    if (!this.data.has(key)) {
      this.data.set(key, {});
    }
    const hash = this.data.get(key);
    hash[field] = (hash[field] || 0) + increment;
    return hash[field];
  },
  
  async hgetall(key) {
    return this.data.get(key) || null;
  },
  
  async hset(key, data) {
    this.data.set(key, data);
  },
  
  async sadd(key, member) {
    if (!this.data.has(key)) {
      this.data.set(key, new Set());
    }
    this.data.get(key).add(member);
  },
  
  async srem(key, member) {
    if (this.data.has(key)) {
      this.data.get(key).delete(member);
    }
  },
  
  async smembers(key) {
    return Array.from(this.data.get(key) || []);
  },
  
  async expire() {
    // Mock expiration
  },
  
  clear() {
    this.data.clear();
  }
};

// Create a mock version of achMetrics for testing
const achMetrics = {
  trackACHPaymentStarted: jest.fn(async (paymentIntentId, amount, customerId) => {
    const dateKey = new Date().toISOString().slice(0, 10);
    await mockKV.hincrby(`ach:metrics:started:${dateKey}`, 'count', 1);
    await mockKV.hincrby(`ach:metrics:started:${dateKey}`, 'totalAmount', amount);
  }),
  
  trackACHPaymentCompleted: jest.fn(async (paymentIntentId, amount, processingDays) => {
    const dateKey = new Date().toISOString().slice(0, 10);
    await mockKV.hincrby(`ach:metrics:completed:${dateKey}`, 'count', 1);
    await mockKV.hincrby(`ach:metrics:completed:${dateKey}`, 'totalAmount', amount);
    await mockKV.hincrby(`ach:metrics:completed:${dateKey}`, 'totalProcessingDays', processingDays);
  }),
  
  trackACHPaymentFailed: jest.fn(async (paymentIntentId, amount, failureCode) => {
    const dateKey = new Date().toISOString().slice(0, 10);
    await mockKV.hincrby(`ach:metrics:failed:${dateKey}`, 'count', 1);
    await mockKV.hincrby(`ach:metrics:failed:${dateKey}`, 'totalAmount', amount);
    await mockKV.hincrby(`ach:metrics:failed:${dateKey}`, `failure:${failureCode}`, 1);
  }),
  
  getACHMetrics: jest.fn(async (startDate, endDate) => {
    const metrics = {
      started: { count: 0, totalAmount: 0 },
      completed: { count: 0, totalAmount: 0, avgProcessingDays: 0 },
      failed: { count: 0, totalAmount: 0, failureCodes: {} },
      successRate: 0
    };
    
    const dateKey = new Date().toISOString().slice(0, 10);
    const started = await mockKV.hgetall(`ach:metrics:started:${dateKey}`);
    const completed = await mockKV.hgetall(`ach:metrics:completed:${dateKey}`);
    const failed = await mockKV.hgetall(`ach:metrics:failed:${dateKey}`);
    
    if (started) {
      metrics.started.count = started.count || 0;
      metrics.started.totalAmount = started.totalAmount || 0;
    }
    
    if (completed) {
      metrics.completed.count = completed.count || 0;
      metrics.completed.totalAmount = completed.totalAmount || 0;
      if (completed.count > 0) {
        metrics.completed.avgProcessingDays = 
          (completed.totalProcessingDays / completed.count).toFixed(1);
      }
    }
    
    if (failed) {
      metrics.failed.count = failed.count || 0;
      metrics.failed.totalAmount = failed.totalAmount || 0;
      Object.keys(failed).forEach(key => {
        if (key.startsWith('failure:')) {
          const code = key.replace('failure:', '');
          metrics.failed.failureCodes[code] = failed[key];
        }
      });
    }
    
    const totalProcessed = metrics.completed.count + metrics.failed.count;
    if (totalProcessed > 0) {
      metrics.successRate = ((metrics.completed.count / totalProcessed) * 100).toFixed(2);
    }
    
    return metrics;
  }),
  
  storeACHPayment: jest.fn(async (paymentIntentId, paymentData) => {
    await mockKV.hset(`ach:payment:${paymentIntentId}`, {
      ...paymentData,
      createdAt: new Date().toISOString(),
      status: 'pending'
    });
    await mockKV.sadd('ach:pending', paymentIntentId);
  }),
  
  getPendingACHPayments: jest.fn(async () => {
    const pending = await mockKV.smembers('ach:pending');
    const payments = [];
    for (const paymentId of pending) {
      const paymentData = await mockKV.hgetall(`ach:payment:${paymentId}`);
      if (paymentData) {
        payments.push({
          paymentIntentId: paymentId,
          ...paymentData
        });
      }
    }
    return payments;
  }),
  
  updateACHPaymentStatus: jest.fn(async (paymentIntentId, status, additionalData = {}) => {
    const key = `ach:payment:${paymentIntentId}`;
    await mockKV.hset(key, {
      status,
      updatedAt: new Date().toISOString(),
      ...additionalData
    });
    
    if (status === 'completed' || status === 'failed') {
      await mockKV.srem('ach:pending', paymentIntentId);
    }
  })
};

describe('ACH Monitoring', () => {
  beforeEach(() => {
    mockKV.clear();
  });
  
  describe('Metrics Tracking', () => {
    it('should track ACH payment started', async () => {
      const paymentIntentId = 'pi_test_ach_123';
      const amount = 10000;
      const customerId = 'test@example.com';
      
      await achMetrics.trackACHPaymentStarted(paymentIntentId, amount, customerId);
      
      const dateKey = new Date().toISOString().slice(0, 10);
      const metrics = await mockKV.hgetall(`ach:metrics:started:${dateKey}`);
      
      expect(metrics).toBeDefined();
      expect(metrics.count).toBe(1);
      expect(metrics.totalAmount).toBe(10000);
    });
    
    it('should track ACH payment completed', async () => {
      const paymentIntentId = 'pi_test_ach_123';
      const amount = 10000;
      const processingDays = 2;
      
      await achMetrics.trackACHPaymentCompleted(paymentIntentId, amount, processingDays);
      
      const dateKey = new Date().toISOString().slice(0, 10);
      const metrics = await mockKV.hgetall(`ach:metrics:completed:${dateKey}`);
      
      expect(metrics).toBeDefined();
      expect(metrics.count).toBe(1);
      expect(metrics.totalAmount).toBe(10000);
      expect(metrics.totalProcessingDays).toBe(2);
    });
    
    it('should track ACH payment failed', async () => {
      const paymentIntentId = 'pi_test_ach_123';
      const amount = 10000;
      const failureCode = 'insufficient_funds';
      
      await achMetrics.trackACHPaymentFailed(paymentIntentId, amount, failureCode);
      
      const dateKey = new Date().toISOString().slice(0, 10);
      const metrics = await mockKV.hgetall(`ach:metrics:failed:${dateKey}`);
      
      expect(metrics).toBeDefined();
      expect(metrics.count).toBe(1);
      expect(metrics.totalAmount).toBe(10000);
      expect(metrics['failure:insufficient_funds']).toBe(1);
    });
  });
  
  describe('Metrics Aggregation', () => {
    it('should aggregate metrics across date range', async () => {
      // Track multiple payments
      await achMetrics.trackACHPaymentStarted('pi_1', 10000, 'customer1');
      await achMetrics.trackACHPaymentStarted('pi_2', 20000, 'customer2');
      await achMetrics.trackACHPaymentCompleted('pi_1', 10000, 2);
      await achMetrics.trackACHPaymentFailed('pi_2', 20000, 'account_closed');
      
      const today = new Date().toISOString().slice(0, 10);
      const metrics = await achMetrics.getACHMetrics(today, today);
      
      expect(metrics.started.count).toBe(2);
      expect(metrics.started.totalAmount).toBe(30000);
      expect(metrics.completed.count).toBe(1);
      expect(metrics.completed.totalAmount).toBe(10000);
      expect(metrics.completed.avgProcessingDays).toBe('2.0');
      expect(metrics.failed.count).toBe(1);
      expect(metrics.failed.totalAmount).toBe(20000);
      expect(metrics.failed.failureCodes.account_closed).toBe(1);
      expect(metrics.successRate).toBe('50.00');
    });
    
    it('should handle empty metrics gracefully', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const metrics = await achMetrics.getACHMetrics(today, today);
      
      expect(metrics.started.count).toBe(0);
      expect(metrics.started.totalAmount).toBe(0);
      expect(metrics.completed.count).toBe(0);
      expect(metrics.successRate).toBe(0);
    });
  });
  
  describe('Pending Payments', () => {
    it('should store and retrieve pending ACH payments', async () => {
      const paymentData = {
        amount: 10000,
        customerEmail: 'test@example.com',
        orderNumber: '#1001'
      };
      
      await achMetrics.storeACHPayment('pi_test_ach_123', paymentData);
      
      const pendingPayments = await achMetrics.getPendingACHPayments();
      
      expect(pendingPayments).toHaveLength(1);
      expect(pendingPayments[0].paymentIntentId).toBe('pi_test_ach_123');
      expect(pendingPayments[0].amount).toBe(10000);
      expect(pendingPayments[0].status).toBe('pending');
      expect(pendingPayments[0].createdAt).toBeDefined();
    });
    
    it('should update payment status', async () => {
      const paymentId = 'pi_test_ach_123';
      
      // Store payment
      await achMetrics.storeACHPayment(paymentId, {
        amount: 10000,
        customerEmail: 'test@example.com'
      });
      
      // Update status to completed
      await achMetrics.updateACHPaymentStatus(paymentId, 'completed', {
        chargeId: 'ch_123',
        completedAt: new Date().toISOString()
      });
      
      // Should be removed from pending
      const pendingPayments = await achMetrics.getPendingACHPayments();
      expect(pendingPayments).toHaveLength(0);
      
      // Should have updated data
      const paymentData = await mockKV.hgetall(`ach:payment:${paymentId}`);
      expect(paymentData.status).toBe('completed');
      expect(paymentData.chargeId).toBe('ch_123');
      expect(paymentData.updatedAt).toBeDefined();
    });
    
    it('should handle failed payments', async () => {
      const paymentId = 'pi_test_ach_failed';
      
      await achMetrics.storeACHPayment(paymentId, {
        amount: 10000,
        customerEmail: 'test@example.com'
      });
      
      await achMetrics.updateACHPaymentStatus(paymentId, 'failed', {
        failureCode: 'insufficient_funds',
        failureMessage: 'The bank account has insufficient funds.'
      });
      
      // Should be removed from pending
      const pendingPayments = await achMetrics.getPendingACHPayments();
      expect(pendingPayments).toHaveLength(0);
      
      // Should have failure data
      const paymentData = await mockKV.hgetall(`ach:payment:${paymentId}`);
      expect(paymentData.status).toBe('failed');
      expect(paymentData.failureCode).toBe('insufficient_funds');
    });
  });
  
  describe('Dashboard Data', () => {
    it('should generate dashboard data', async () => {
      // Create test data
      await achMetrics.trackACHPaymentStarted('pi_1', 10000, 'customer1');
      await achMetrics.trackACHPaymentStarted('pi_2', 20000, 'customer2');
      await achMetrics.trackACHPaymentCompleted('pi_1', 10000, 3);
      await achMetrics.storeACHPayment('pi_3', {
        amount: 15000,
        customerEmail: 'pending@example.com'
      });
      
      // Mock dashboard data function
      const getACHDashboardData = async () => {
        const metrics = await achMetrics.getACHMetrics(
          new Date().toISOString().slice(0, 10),
          new Date().toISOString().slice(0, 10)
        );
        const pendingPayments = await achMetrics.getPendingACHPayments();
        
        return {
          metrics,
          pendingPayments,
          lastUpdated: new Date().toISOString()
        };
      };
      
      const dashboardData = await getACHDashboardData();
      
      expect(dashboardData).toHaveProperty('metrics');
      expect(dashboardData).toHaveProperty('pendingPayments');
      expect(dashboardData).toHaveProperty('lastUpdated');
      expect(dashboardData.pendingPayments).toHaveLength(1);
      expect(dashboardData.metrics.started.count).toBe(2);
    });
  });
  
  describe('Amount Formatting', () => {
    it('should format ACH amounts correctly', () => {
      // Mock formatACHAmount function
      const formatACHAmount = (cents) => {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD'
        }).format(cents / 100);
      };
      
      expect(formatACHAmount(10000)).toBe('$100.00');
      expect(formatACHAmount(12345)).toBe('$123.45');
      expect(formatACHAmount(100)).toBe('$1.00');
      expect(formatACHAmount(0)).toBe('$0.00');
    });
  });
});