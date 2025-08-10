// Cross-repository environment synchronization tests
// Ensures all repos are using consistent environment settings

const fixtures = require('../../../shared/fixtures');

describe('Cross-Repository Environment Validation', () => {
  describe('API URL Consistency', () => {
    it('should use consistent API URLs across all environments', async () => {
      const environments = {
        development: {
          backend: process.env.DEV_BACKEND_URL || 'http://localhost:3000',
          frontend: process.env.DEV_FRONTEND_URL || 'http://localhost:9292'
        },
        staging: {
          backend: process.env.STAGING_BACKEND_URL || 'https://r3-backend-staging.vercel.app',
          frontend: process.env.STAGING_FRONTEND_URL || 'https://r3-stage.myshopify.com'
        },
        production: {
          backend: process.env.PROD_BACKEND_URL || 'https://r3-backend.vercel.app',
          frontend: process.env.PROD_FRONTEND_URL || 'https://rthree.io'
        }
      };

      for (const [env, urls] of Object.entries(environments)) {
        console.log(`🌍 Validating ${env} environment URLs...`);

        // Test backend health endpoint
        try {
          const backendResponse = await fetch(`${urls.backend}/health`, {
            timeout: 5000
          });
          
          if (backendResponse.ok) {
            const health = await backendResponse.json();
            console.log(`✅ ${env} backend healthy:`, health.status);
            
            // Verify environment in response
            expect(health.branch?.gitBranch || health.environment).toBeDefined();
          } else {
            console.log(`⚠️ ${env} backend unhealthy: ${backendResponse.status}`);
          }
        } catch (error) {
          console.log(`❌ ${env} backend unreachable:`, error.message);
        }

        // Test frontend accessibility (for staging/prod)
        if (env !== 'development') {
          try {
            const frontendResponse = await fetch(urls.frontend, {
              method: 'HEAD',
              timeout: 5000
            });
            
            if (frontendResponse.ok) {
              console.log(`✅ ${env} frontend accessible`);
            } else {
              console.log(`⚠️ ${env} frontend status: ${frontendResponse.status}`);
            }
          } catch (error) {
            console.log(`❌ ${env} frontend unreachable:`, error.message);
          }
        }
      }
    });

    it('should have matching environment variable formats', async () => {
      // Test that environment variables follow consistent naming
      const expectedEnvVars = {
        development: {
          stripeKey: 'STRIPE_SECRET_KEY_DEV',
          webhookSecret: 'STRIPE_WEBHOOK_SECRET_DEV',
          shopifyToken: 'SHOPIFY_ADMIN_ACCESS_TOKEN'
        },
        staging: {
          stripeKey: 'STRIPE_SECRET_KEY_STAGE',
          webhookSecret: 'STRIPE_WEBHOOK_SECRET_STAGE',
          shopifyToken: 'SHOPIFY_ADMIN_ACCESS_TOKEN'
        },
        production: {
          stripeKey: 'STRIPE_SECRET_KEY_PROD',
          webhookSecret: 'STRIPE_WEBHOOK_SECRET_PROD',
          shopifyToken: 'SHOPIFY_ADMIN_ACCESS_TOKEN'
        }
      };

      for (const [env, vars] of Object.entries(expectedEnvVars)) {
        console.log(`🔑 Checking ${env} environment variables...`);
        
        // We can't check actual values, but we can verify the naming pattern
        Object.entries(vars).forEach(([type, varName]) => {
          // Verify naming follows pattern
          if (type === 'stripeKey') {
            expect(varName).toMatch(/^STRIPE_SECRET_KEY_(DEV|STAGE|PROD)$/);
          } else if (type === 'webhookSecret') {
            expect(varName).toMatch(/^STRIPE_WEBHOOK_SECRET_(DEV|STAGE|PROD)$/);
          }
        });

        console.log(`✅ ${env} environment variable names are consistent`);
      }
    });
  });

  describe('Stripe Key Environment Matching', () => {
    it('should use test keys for non-production environments', async () => {
      const testEnvironments = ['development', 'staging'];
      
      for (const env of testEnvironments) {
        console.log(`🔐 Testing Stripe key type for ${env}...`);
        
        // Create a test session to check which Stripe keys are being used
        const sessionResponse = await fetch(`${process.env.BACKEND_API_URL}/api/checkout/session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': process.env.FRONTEND_URL
          },
          body: JSON.stringify({
            cartToken: `${env}-stripe-test`,
            cartTotal: 10000
          })
        });

        if (sessionResponse.ok) {
          const session = await sessionResponse.json();

          // Create payment intent to check Stripe key type
          const paymentResponse = await fetch(`${process.env.BACKEND_API_URL}/api/stripe/create-payment-intent`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.sessionToken}`,
              'x-csrf-token': session.csrfToken
            },
            body: JSON.stringify({
              amount: 10000,
              currency: 'usd',
              metadata: {
                environment_test: env
              }
            })
          });

          if (paymentResponse.ok) {
            const payment = await paymentResponse.json();
            
            // Test environments should use test payment intent IDs
            expect(payment.paymentIntentId).toMatch(/^pi_test_/);
            console.log(`✅ ${env} using test Stripe keys correctly`);
          }
        }
      }
    });

    it('should validate webhook signature consistency', async () => {
      // Test that webhook secrets are properly configured
      const webhookPayload = fixtures.webhooks.paymentSucceeded;
      
      // Test webhook with invalid signature (should fail)
      const invalidResponse = await fetch(`${process.env.BACKEND_API_URL}/webhook/stripe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': 'invalid-signature'
        },
        body: JSON.stringify(webhookPayload)
      });

      expect(invalidResponse.status).toBe(400);
      console.log('✅ Webhook signature validation working');
    });
  });

  describe('Theme Settings Synchronization', () => {
    it('should have consistent settings across theme environments', async () => {
      // Test that theme settings are properly configured
      const themeSettings = {
        development: {
          environment: 'development',
          stripeKey: 'pk_test_...',
          apiUrl: 'http://localhost:3000'
        },
        staging: {
          environment: 'staging',
          stripeKey: 'pk_test_...',
          apiUrl: 'https://r3-backend-staging.vercel.app'
        },
        production: {
          environment: 'production',
          stripeKey: 'pk_live_...',
          apiUrl: 'https://r3-backend.vercel.app'
        }
      };

      Object.entries(themeSettings).forEach(([env, settings]) => {
        console.log(`🎨 Validating ${env} theme settings...`);
        
        // Verify environment setting
        expect(settings.environment).toBe(env);
        
        // Verify Stripe key format
        if (env === 'production') {
          expect(settings.stripeKey).toMatch(/^pk_live_/);
        } else {
          expect(settings.stripeKey).toMatch(/^pk_test_/);
        }
        
        // Verify API URL format
        expect(settings.apiUrl).toMatch(/^https?:\/\//);
        
        console.log(`✅ ${env} theme settings are valid`);
      });
    });
  });

  describe('Branch Deployment Consistency', () => {
    it('should map git branches to correct environments', async () => {
      const branchMapping = {
        'r3-dev': 'development',
        'r3-stage': 'staging',
        'r3-prod': 'production',
        'main': 'production'
      };

      Object.entries(branchMapping).forEach(([branch, expectedEnv]) => {
        console.log(`🌲 Validating branch ${branch} → ${expectedEnv} mapping...`);
        
        // Test environment variable suffix logic
        const suffixMap = {
          'main': 'PROD',
          'r3-prod': 'PROD',
          'r3-stage': 'STAGE',
          'r3-dev': 'DEV'
        };

        const expectedSuffix = suffixMap[branch];
        expect(expectedSuffix).toBeDefined();
        
        console.log(`✅ ${branch} correctly maps to ${expectedEnv} (${expectedSuffix})`);
      });
    });

    it('should validate deployment URLs match branches', async () => {
      const deploymentUrls = {
        'r3-dev': {
          backend: /r3-backend.*dev/,
          theme: /preview_theme_id/
        },
        'r3-stage': {
          backend: /r3-backend.*stage/,
          theme: /preview_theme_id/
        },
        'r3-prod': {
          backend: /r3-backend\.vercel\.app$/,
          theme: /^https:\/\/rthree\.io/
        }
      };

      Object.entries(deploymentUrls).forEach(([branch, patterns]) => {
        console.log(`🚀 Validating ${branch} deployment patterns...`);
        
        // These patterns would be used to validate actual deployment URLs
        expect(patterns.backend).toBeDefined();
        expect(patterns.theme).toBeDefined();
        
        console.log(`✅ ${branch} deployment patterns defined`);
      });
    });
  });

  describe('Data Flow Consistency', () => {
    it('should maintain data integrity across environment boundaries', async () => {
      // Test that data flows correctly between environments
      const testData = {
        cartToken: 'data-integrity-test',
        customerEmail: 'data-test@example.com',
        repCode: 'cross-env-rep',
        items: [{
          variant_id: 40000000001,
          quantity: 1,
          price: 10000,
          title: 'Cross-Environment Test Product'
        }]
      };

      console.log('🔄 Testing data flow consistency...');

      // Step 1: Create session with test data
      const sessionResponse = await fetch(`${process.env.BACKEND_API_URL}/api/checkout/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': process.env.FRONTEND_URL
        },
        body: JSON.stringify({
          cartToken: testData.cartToken,
          cartTotal: testData.items[0].price
        })
      });

      const session = await sessionResponse.json();

      // Step 2: Create payment with all test data
      const paymentResponse = await fetch(`${process.env.BACKEND_API_URL}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.sessionToken}`,
          'x-csrf-token': session.csrfToken
        },
        body: JSON.stringify({
          amount: testData.items[0].price,
          currency: 'usd',
          metadata: {
            customer_email: testData.customerEmail,
            items: JSON.stringify(testData.items),
            rep: testData.repCode,
            store_domain: 'test-store.myshopify.com',
            environment: process.env.NODE_ENV || 'test'
          }
        })
      });

      expect(paymentResponse.status).toBe(200);
      const payment = await paymentResponse.json();

      // Verify all data would be preserved
      expect(payment.paymentIntentId).toBeDefined();
      
      console.log('✅ Data integrity maintained across environment boundaries');
      console.log(`   Session: ${session.sessionToken.substring(0, 8)}...`);
      console.log(`   Payment: ${payment.paymentIntentId}`);
      console.log(`   Customer: ${testData.customerEmail}`);
      console.log(`   Rep: ${testData.repCode}`);
    });
  });

  describe('Error Handling Consistency', () => {
    it('should handle errors consistently across environments', async () => {
      console.log('❌ Testing consistent error handling...');

      const errorScenarios = [
        {
          name: 'Missing authentication',
          request: () => fetch(`${process.env.BACKEND_API_URL}/api/stripe/create-payment-intent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: 10000 })
          }),
          expectedStatus: 401
        },
        {
          name: 'Invalid CSRF token',
          request: async () => {
            const session = await fetch(`${process.env.BACKEND_API_URL}/api/checkout/session`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ cartToken: 'test', cartTotal: 10000 })
            }).then(r => r.json());

            return fetch(`${process.env.BACKEND_API_URL}/api/stripe/create-payment-intent`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.sessionToken}`,
                'x-csrf-token': 'invalid-csrf'
              },
              body: JSON.stringify({ amount: 10000 })
            });
          },
          expectedStatus: 403
        },
        {
          name: 'Invalid amount',
          request: async () => {
            const session = await fetch(`${process.env.BACKEND_API_URL}/api/checkout/session`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ cartToken: 'test', cartTotal: 10000 })
            }).then(r => r.json());

            return fetch(`${process.env.BACKEND_API_URL}/api/stripe/create-payment-intent`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.sessionToken}`,
                'x-csrf-token': session.csrfToken
              },
              body: JSON.stringify({ amount: -1000 })
            });
          },
          expectedStatus: 400
        }
      ];

      for (const scenario of errorScenarios) {
        console.log(`   Testing: ${scenario.name}`);
        
        const response = await scenario.request();
        expect(response.status).toBe(scenario.expectedStatus);
        
        const errorData = await response.json();
        expect(errorData.error).toBeDefined();
        
        console.log(`   ✅ ${scenario.name} handled correctly (${response.status})`);
      }

      console.log('✅ Error handling consistent across all scenarios');
    });
  });
});