/**
 * VMI Portal Test with Correct API Format
 *
 * Based on actual API response validation errors
 */

const API_KEY = 'vmi_vend_VEN-0009_ce0fb00454a3a9398375761178f93f67';
const BASE_URL = 'https://vmi-portal.bmscloud.in.th/api/external/vendor';

async function makeRequest(method: string, path: string, body?: unknown) {
  const url = `${BASE_URL}${path}`;

  console.log(`\n📤 Request: ${method} ${url}`);
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
    console.log(`   Body: ${JSON.stringify(responseData, null, 2)}`);

    return { status: response.status, data: responseData };
  } catch (error) {
    console.log(`\n❌ Error: ${error instanceof Error ? error.message : error}`);
    return { status: 0, data: null, error };
  }
}

async function runTests() {
  console.log('='.repeat(70));
  console.log('VMI Portal Test with Correct API Format');
  console.log('='.repeat(70));

  // Test 1: Items sync with correct fields
  console.log('\n' + '='.repeat(70));
  console.log('Test 1: Sync Items (correct format)');
  console.log('='.repeat(70));
  await makeRequest('POST', '/items', {
    items: [
      {
        tppCode: '8850999111111',
        ttmtCode: 'A12345678',
        localCode: 'TEST-001',  // Required by API
        name: 'Test Product',
        unit: 'box',
        packUnit: 'box',  // Required by API
        vendorItemCode: 'TEST-001',
      },
    ],
  });

  // Test 2: Prices sync with correct fields
  console.log('\n' + '='.repeat(70));
  console.log('Test 2: Sync Prices (correct format)');
  console.log('='.repeat(70));
  await makeRequest('POST', '/prices', {
    offers: [
      {
        tppCode: '8850999111111',
        localCode: 'TEST-001',  // Required by API
        unitPrice: 150.00,
        currency: 'THB',
        effectiveDate: '2024-01-01',  // Required by API
        validFrom: '2024-01-01',
        validTo: '2024-12-31',
      },
    ],
  });

  // Test 3: Inventory sync with correct fields
  console.log('\n' + '='.repeat(70));
  console.log('Test 3: Sync Inventory (correct format)');
  console.log('='.repeat(70));
  await makeRequest('POST', '/inventory', {
    inventory: [
      {
        tppCode: '8850999111111',
        localCode: 'TEST-001',  // Required by API
        quantityAvailable: 100,  // Correct field name
        unit: 'box',
      },
    ],
  });

  // Test 4: Get orders
  console.log('\n' + '='.repeat(70));
  console.log('Test 4: Get Orders');
  console.log('='.repeat(70));
  await makeRequest('GET', '/orders');

  console.log('\n' + '='.repeat(70));
  console.log('Test Complete');
  console.log('='.repeat(70));
}

runTests().catch(console.error);
