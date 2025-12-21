/**
 * VMI Portal Debug Test Script
 *
 * Tests real connectivity and shows detailed API responses
 * Usage: npx tsx scripts/test-vmi-debug.ts
 */

const API_KEY = 'vmi_vend_VEN-0009_ce0fb00454a3a9398375761178f93f67';
const BASE_URL = 'https://vmi-portal.bmscloud.in.th/api/external/vendor';

async function makeRequest(method: string, path: string, body?: unknown) {
  const url = `${BASE_URL}${path}`;

  console.log(`\n📤 Request: ${method} ${url}`);
  console.log(`   Headers: X-API-Key: ${API_KEY.substring(0, 25)}...`);
  if (body) {
    console.log(`   Body: ${JSON.stringify(body, null, 2)}`);
  }

  try {
    const startTime = Date.now();
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const duration = Date.now() - startTime;

    const contentType = response.headers.get('content-type');
    let responseData;
    if (contentType?.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    console.log(`\n📥 Response: ${response.status} ${response.statusText} (${duration}ms)`);
    console.log(`   Content-Type: ${contentType}`);
    console.log(`   Body: ${JSON.stringify(responseData, null, 2)}`);

    return { status: response.status, data: responseData };
  } catch (error) {
    console.log(`\n❌ Error: ${error instanceof Error ? error.message : error}`);
    return { status: 0, data: null, error };
  }
}

async function runTests() {
  console.log('='.repeat(70));
  console.log('VMI Portal Debug Test');
  console.log('='.repeat(70));

  // Test 1: Health endpoint
  console.log('\n' + '='.repeat(70));
  console.log('Test 1: Health Check');
  console.log('='.repeat(70));
  await makeRequest('GET', '/health');

  // Test 2: Orders endpoint
  console.log('\n' + '='.repeat(70));
  console.log('Test 2: Get Orders');
  console.log('='.repeat(70));
  await makeRequest('GET', '/orders?limit=5');

  // Test 3: Items sync - try different body formats
  console.log('\n' + '='.repeat(70));
  console.log('Test 3a: Sync Items (wrapped in { items: [...] })');
  console.log('='.repeat(70));
  await makeRequest('POST', '/items', {
    items: [
      {
        tppCode: '8850999111111',
        ttmtCode: 'A12345678',
        name: 'Test Product',
        unit: 'box',
        vendorItemCode: 'TEST-001',
      },
    ],
  });

  console.log('\n' + '='.repeat(70));
  console.log('Test 3b: Sync Items (array directly)');
  console.log('='.repeat(70));
  await makeRequest('POST', '/items', [
    {
      tppCode: '8850999111111',
      ttmtCode: 'A12345678',
      name: 'Test Product',
      unit: 'box',
      vendorItemCode: 'TEST-001',
    },
  ]);

  // Test 4: Prices sync
  console.log('\n' + '='.repeat(70));
  console.log('Test 4a: Sync Prices (wrapped)');
  console.log('='.repeat(70));
  await makeRequest('POST', '/prices', {
    offers: [
      {
        tppCode: '8850999111111',
        unitPrice: 150.00,
        currency: 'THB',
        validFrom: '2024-01-01',
        validTo: '2024-12-31',
      },
    ],
  });

  console.log('\n' + '='.repeat(70));
  console.log('Test 4b: Sync Prices (array directly)');
  console.log('='.repeat(70));
  await makeRequest('POST', '/prices', [
    {
      tppCode: '8850999111111',
      unitPrice: 150.00,
      currency: 'THB',
      validFrom: '2024-01-01',
      validTo: '2024-12-31',
    },
  ]);

  // Test 5: Inventory sync
  console.log('\n' + '='.repeat(70));
  console.log('Test 5a: Sync Inventory (wrapped)');
  console.log('='.repeat(70));
  await makeRequest('POST', '/inventory', {
    inventory: [
      {
        tppCode: '8850999111111',
        availableQuantity: 100,
        unit: 'box',
      },
    ],
  });

  console.log('\n' + '='.repeat(70));
  console.log('Test 5b: Sync Inventory (array directly)');
  console.log('='.repeat(70));
  await makeRequest('POST', '/inventory', [
    {
      tppCode: '8850999111111',
      availableQuantity: 100,
      unit: 'box',
    },
  ]);

  // Test 6: Check alternative endpoints
  console.log('\n' + '='.repeat(70));
  console.log('Test 6: Alternative base paths');
  console.log('='.repeat(70));

  // Try without /api/external/vendor prefix
  console.log('\n--- Testing root /orders ---');
  const altUrl1 = 'https://vmi-portal.bmscloud.in.th/orders';
  try {
    const resp = await fetch(altUrl1, {
      headers: { 'X-API-Key': API_KEY },
    });
    console.log(`Response: ${resp.status}`);
  } catch (e) {
    console.log(`Error: ${e}`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('Debug Test Complete');
  console.log('='.repeat(70));
}

runTests().catch(console.error);
