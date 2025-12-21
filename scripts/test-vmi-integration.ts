/**
 * VMI Portal Integration Test Script
 *
 * Tests real connectivity to VMI Portal API
 * Usage: npx tsx scripts/test-vmi-integration.ts
 */

import { encrypt } from '../src/lib/crypto/encrypt';
import { VmiPortalService, VmiPortalError } from '../src/lib/services/vmi-portal.service';

// Configuration
const API_KEY = 'vmi_vend_VEN-0009_ce0fb00454a3a9398375761178f93f67';
const BASE_URL = 'https://vmi-portal.bmscloud.in.th/api/external/vendor';
const VENDOR_ID = 9; // VEN-0009

async function runTests() {
  console.log('='.repeat(60));
  console.log('VMI Portal Integration Test');
  console.log('='.repeat(60));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Vendor ID: ${VENDOR_ID}`);
  console.log(`API Key: ${API_KEY.substring(0, 20)}...`);
  console.log('='.repeat(60));
  console.log('');

  // Encrypt API key
  console.log('🔐 Encrypting API key...');
  const encryptedApiKey = encrypt(API_KEY);
  console.log('   ✓ API key encrypted');
  console.log('');

  // Create service
  const service = new VmiPortalService({
    vendorId: VENDOR_ID,
    apiKeyEncrypted: encryptedApiKey,
    baseUrl: BASE_URL,
  });

  // Test 1: Connection Test
  console.log('📡 Test 1: Connection Test');
  console.log('-'.repeat(40));
  try {
    const startTime = Date.now();
    const isConnected = await service.testConnection();
    const duration = Date.now() - startTime;

    if (isConnected) {
      console.log(`   ✅ SUCCESS: Connected to VMI Portal (${duration}ms)`);
    } else {
      console.log(`   ❌ FAILED: Connection test returned false (${duration}ms)`);
    }
  } catch (error) {
    if (error instanceof VmiPortalError) {
      console.log(`   ❌ ERROR: ${error.code} - ${error.message}`);
      console.log(`   HTTP Status: ${error.httpStatus}`);
      if (error.details) {
        console.log(`   Details: ${JSON.stringify(error.details)}`);
      }
    } else if (error instanceof Error) {
      console.log(`   ❌ ERROR: ${error.message}`);
    }
  }
  console.log('');

  // Test 2: Get Orders
  console.log('📋 Test 2: Get Orders');
  console.log('-'.repeat(40));
  try {
    const startTime = Date.now();
    const orders = await service.getOrders({});
    const duration = Date.now() - startTime;

    console.log(`   ✅ SUCCESS: Retrieved orders (${duration}ms)`);
    console.log(`   Orders returned: ${orders.orders.length}`);

    if (orders.orders.length > 0) {
      console.log('   Sample orders:');
      orders.orders.slice(0, 3).forEach((order, i) => {
        console.log(`     ${i + 1}. Order ID: ${order.id}`);
        console.log(`        Status: ${order.status}`);
        console.log(`        Hospital: ${order.hospitalName}`);
        console.log(`        Total: ${order.totalValue} THB`);
      });
    }
  } catch (error) {
    if (error instanceof VmiPortalError) {
      console.log(`   ❌ ERROR: ${error.code} - ${error.message}`);
      console.log(`   HTTP Status: ${error.httpStatus}`);
    } else if (error instanceof Error) {
      console.log(`   ❌ ERROR: ${error.message}`);
    }
  }
  console.log('');

  // Test 3: Sync Items (dry run - just prepare data)
  console.log('📦 Test 3: Sync Items');
  console.log('-'.repeat(40));
  const testItems = [
    {
      localCode: 'TEST-001',
      tppCode: '8850999111111',
      ttmtCode: 'A12345678',
      name: 'Test Herbal Product',
      unit: 'box',
    },
  ];

  try {
    const startTime = Date.now();
    const syncResult = await service.syncItems(testItems);
    const duration = Date.now() - startTime;

    console.log(`   ✅ SUCCESS: Sync completed (${duration}ms)`);
    console.log(`   Synced: ${syncResult.summary.inserted + syncResult.summary.updated}`);
    console.log(`   Failed: ${syncResult.summary.failed}`);
    if (syncResult.errors && syncResult.errors.length > 0) {
      console.log(`   Errors:`);
      syncResult.errors.forEach((err, i) => {
        console.log(`     ${i + 1}. ${JSON.stringify(err)}`);
      });
    }
  } catch (error) {
    if (error instanceof VmiPortalError) {
      console.log(`   ❌ ERROR: ${error.code} - ${error.message}`);
      console.log(`   HTTP Status: ${error.httpStatus}`);
      if (error.details) {
        console.log(`   Details: ${JSON.stringify(error.details, null, 2)}`);
      }
    } else if (error instanceof Error) {
      console.log(`   ❌ ERROR: ${error.message}`);
    }
  }
  console.log('');

  // Test 4: Sync Prices
  console.log('💰 Test 4: Sync Prices');
  console.log('-'.repeat(40));
  const testPrices = [
    {
      localCode: 'TEST-001',
      unitPrice: 150.00,
      effectiveDate: new Date().toISOString().split('T')[0],
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    },
  ];

  try {
    const startTime = Date.now();
    const syncResult = await service.syncPrices(testPrices);
    const duration = Date.now() - startTime;

    console.log(`   ✅ SUCCESS: Price sync completed (${duration}ms)`);
    console.log(`   Synced: ${syncResult.summary.inserted + syncResult.summary.updated}`);
    console.log(`   Failed: ${syncResult.summary.failed}`);
    if (syncResult.errors && syncResult.errors.length > 0) {
      console.log(`   Errors:`);
      syncResult.errors.forEach((err, i) => {
        console.log(`     ${i + 1}. ${JSON.stringify(err)}`);
      });
    }
  } catch (error) {
    if (error instanceof VmiPortalError) {
      console.log(`   ❌ ERROR: ${error.code} - ${error.message}`);
      console.log(`   HTTP Status: ${error.httpStatus}`);
    } else if (error instanceof Error) {
      console.log(`   ❌ ERROR: ${error.message}`);
    }
  }
  console.log('');

  // Test 5: Sync Inventory
  console.log('📊 Test 5: Sync Inventory');
  console.log('-'.repeat(40));
  const testInventory = [
    {
      localCode: 'TEST-001',
      quantityAvailable: 100,
      unit: 'box',
    },
  ];

  try {
    const startTime = Date.now();
    const syncResult = await service.syncInventory(testInventory);
    const duration = Date.now() - startTime;

    console.log(`   ✅ SUCCESS: Inventory sync completed (${duration}ms)`);
    console.log(`   Synced: ${syncResult.summary.inserted + syncResult.summary.updated}`);
    console.log(`   Failed: ${syncResult.summary.failed}`);
    if (syncResult.errors && syncResult.errors.length > 0) {
      console.log(`   Errors:`);
      syncResult.errors.forEach((err, i) => {
        console.log(`     ${i + 1}. ${JSON.stringify(err)}`);
      });
    }
  } catch (error) {
    if (error instanceof VmiPortalError) {
      console.log(`   ❌ ERROR: ${error.code} - ${error.message}`);
      console.log(`   HTTP Status: ${error.httpStatus}`);
    } else if (error instanceof Error) {
      console.log(`   ❌ ERROR: ${error.message}`);
    }
  }
  console.log('');

  console.log('='.repeat(60));
  console.log('Integration Test Complete');
  console.log('='.repeat(60));
}

// Run tests
runTests().catch(console.error);
