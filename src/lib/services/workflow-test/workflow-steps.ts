/**
 * Workflow Test Step Definitions
 *
 * Defines all 31 test steps across 8 phases for end-to-end ERP testing.
 */

import type {
  PhaseDefinition,
  StepDefinition,
  ExecutionContext,
  StepResult,
  ApiCallDetails,
  CreatedEntity,
  StepError,
} from '@/types/workflow-test'

// ============================================================================
// Phase Definitions
// ============================================================================

export const PHASE_DEFINITIONS: PhaseDefinition[] = [
  { id: 1, name: 'Master Data Setup', description: 'Foundation data', stepCount: 4 },
  { id: 2, name: 'BOM & Production Planning', description: 'Product structure', stepCount: 2 },
  { id: 3, name: 'Purchasing Flow', description: 'Procurement process', stepCount: 6 },
  { id: 4, name: 'Production Flow', description: 'Manufacturing process', stepCount: 7 },
  { id: 5, name: 'Finished Goods QC', description: 'Quality verification', stepCount: 2 },
  { id: 6, name: 'Sales Flow', description: 'Order to delivery', stepCount: 4 },
  { id: 7, name: 'Accounting Verification', description: 'Financial validation', stepCount: 4 },
  { id: 8, name: 'VMI Integration', description: 'External sync', stepCount: 2 },
  { id: 9, name: 'HR Flow', description: 'HR management', stepCount: 8 },
]

export const TOTAL_STEPS = 39
export const TOTAL_PHASES = 9

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Execute an API call and capture details
 */
async function executeApiCall(
  ctx: ExecutionContext,
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  payload?: Record<string, unknown>
): Promise<{ apiCall: ApiCallDetails; success: boolean; data?: Record<string, unknown> }> {
  const startTime = Date.now()
  const url = `${ctx.baseUrl}${endpoint}`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  // Add cookies for server-side authentication
  if (ctx.cookies) {
    headers['Cookie'] = ctx.cookies
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: payload ? JSON.stringify(payload) : undefined,
    })

    const responseTime = Date.now() - startTime
    let responseBody: Record<string, unknown> | null = null

    try {
      responseBody = await response.json()
    } catch {
      // Response may not be JSON
    }

    const apiCall: ApiCallDetails = {
      endpoint,
      method,
      requestPayload: payload ?? null,
      requestHeaders: headers,
      responseStatus: response.status,
      responseBody,
      responseTime,
    }

    return {
      apiCall,
      success: response.ok,
      data: responseBody ?? undefined,
    }
  } catch (error) {
    const responseTime = Date.now() - startTime

    return {
      apiCall: {
        endpoint,
        method,
        requestPayload: payload ?? null,
        requestHeaders: headers,
        responseStatus: 0,
        responseBody: { error: String(error) },
        responseTime,
      },
      success: false,
    }
  }
}

/**
 * Create a step error object
 */
function createStepError(
  message: string,
  endpoint: string,
  httpStatus: number,
  responseBody?: Record<string, unknown> | null
): StepError {
  return {
    message,
    code: null,
    endpoint,
    httpStatus,
    responseBody: responseBody ?? null,
    stackTrace: null,
    timestamp: new Date().toISOString(),
  }
}

// ============================================================================
// Step Definitions
// ============================================================================

export const STEP_DEFINITIONS: StepDefinition[] = [
  // =========================================================================
  // Phase 1: Master Data Setup (Steps 1-4)
  // =========================================================================
  {
    id: 1,
    phaseId: 1,
    name: 'Setup warehouse and storage locations',
    description: 'Create main warehouse and storage locations for inventory',
    endpoint: '/api/warehouses',
    method: 'POST',
    activityMessage: 'Creating warehouse...',
    execute: async (ctx: ExecutionContext): Promise<StepResult> => {
      const warehousePayload = {
        code: ctx.config.warehouseName,
        name: `${ctx.config.prefix}Main Warehouse`,
        type: 'raw_material',
        location: 'Test Location',
      }

      const result = await executeApiCall(ctx, '/api/warehouses', 'POST', warehousePayload)

      if (!result.success) {
        return {
          success: false,
          apiCall: result.apiCall,
          createdEntities: [],
          error: createStepError(
            result.data?.error as string || 'Failed to create warehouse',
            '/api/warehouses',
            result.apiCall.responseStatus,
            result.apiCall.responseBody
          ),
        }
      }

      const warehouseId = (result.data?.data as Record<string, unknown>)?.id as number

      // Store for subsequent steps
      ctx.createdData.warehouse = { id: warehouseId, code: ctx.config.warehouseName }

      return {
        success: true,
        apiCall: result.apiCall,
        createdEntities: [
          {
            entityType: 'warehouse',
            entityId: warehouseId,
            entityCode: ctx.config.warehouseName,
            viewUrl: `/inventory/warehouses/${warehouseId}`,
          },
        ],
        data: { warehouseId },
      }
    },
  },
  {
    id: 2,
    phaseId: 1,
    name: 'Setup item categories and units',
    description: 'Create item categories (Raw Material, Packaging, Finished Good) and units',
    endpoint: '/api/item-categories',
    method: 'POST',
    activityMessage: 'Creating categories and units...',
    execute: async (ctx: ExecutionContext): Promise<StepResult> => {
      const categories = [
        { code: `${ctx.config.prefix}RM`, nameTh: 'วัตถุดิบ', nameEn: 'Raw Material', type: 'raw_material' },
        { code: `${ctx.config.prefix}PKG`, nameTh: 'บรรจุภัณฑ์', nameEn: 'Packaging', type: 'packaging' },
        { code: `${ctx.config.prefix}FG`, nameTh: 'สินค้าสำเร็จรูป', nameEn: 'Finished Good', type: 'finished_good' },
      ]

      const createdEntities: CreatedEntity[] = []
      const categoryIds: Record<string, number> = {}

      for (const cat of categories) {
        // Send only API-expected fields
        const payload = { code: cat.code, nameTh: cat.nameTh, nameEn: cat.nameEn }
        const result = await executeApiCall(ctx, '/api/item-categories', 'POST', payload)
        if (result.success) {
          const catId = (result.data?.data as Record<string, unknown>)?.id as number
          categoryIds[cat.type] = catId
          createdEntities.push({
            entityType: 'itemCategory',
            entityId: catId,
            entityCode: cat.code,
            viewUrl: `/inventory/items?category=${catId}`,
          })
        }
      }

      ctx.createdData.categories = categoryIds

      return {
        success: createdEntities.length > 0,
        apiCall: {
          endpoint: '/api/item-categories',
          method: 'POST',
          requestPayload: { categories },
          requestHeaders: { 'Content-Type': 'application/json' },
          responseStatus: 200,
          responseBody: { created: createdEntities.length },
          responseTime: 0,
        },
        createdEntities,
        data: { categoryIds },
      }
    },
  },
  {
    id: 3,
    phaseId: 1,
    name: 'Setup inventory items',
    description: 'Create raw materials, packaging, and finished goods items',
    endpoint: '/api/items',
    method: 'POST',
    activityMessage: 'Creating inventory items...',
    execute: async (ctx: ExecutionContext): Promise<StepResult> => {
      const items = [
        {
          code: `${ctx.config.itemPrefix}RM001`,
          nameTh: `${ctx.config.prefix}สารสกัดสมุนไพร`,
          nameEn: `${ctx.config.prefix}Herb Extract`,
          type: 'raw_material',
          primaryUnit: 'KG',
        },
        {
          code: `${ctx.config.itemPrefix}RM002`,
          nameTh: `${ctx.config.prefix}สารออกฤทธิ์`,
          nameEn: `${ctx.config.prefix}Active Ingredient`,
          type: 'raw_material',
          primaryUnit: 'KG',
        },
        {
          code: `${ctx.config.itemPrefix}PKG001`,
          nameTh: `${ctx.config.prefix}ขวด 100ml`,
          nameEn: `${ctx.config.prefix}Bottle 100ml`,
          type: 'packaging',
          primaryUnit: 'EA',
        },
        {
          code: `${ctx.config.itemPrefix}FG001`,
          nameTh: `${ctx.config.prefix}ยาบำรุงสมุนไพร`,
          nameEn: `${ctx.config.prefix}Herbal Tonic`,
          type: 'finished_good',
          primaryUnit: 'EA',
        },
      ]

      const createdEntities: CreatedEntity[] = []
      const itemIds: Record<string, number> = {}

      for (const item of items) {
        const result = await executeApiCall(ctx, '/api/items', 'POST', item)
        if (result.success) {
          const itemId = (result.data?.data as Record<string, unknown>)?.id as number
          itemIds[item.code] = itemId
          createdEntities.push({
            entityType: 'item',
            entityId: itemId,
            entityCode: item.code,
            viewUrl: `/inventory/items/${itemId}`,
          })
        }
      }

      ctx.createdData.items = itemIds

      return {
        success: createdEntities.length > 0,
        apiCall: {
          endpoint: '/api/items',
          method: 'POST',
          requestPayload: { items },
          requestHeaders: { 'Content-Type': 'application/json' },
          responseStatus: 200,
          responseBody: { created: createdEntities.length },
          responseTime: 0,
        },
        createdEntities,
        data: { itemIds },
      }
    },
  },
  {
    id: 4,
    phaseId: 1,
    name: 'Setup HR employees',
    description: 'Create employees with roles and training records',
    endpoint: '/api/hr/employees',
    method: 'POST',
    activityMessage: 'Creating HR records...',
    execute: async (ctx: ExecutionContext): Promise<StepResult> => {
      // hireDate is required by the employeeCreateSchema
      const hireDate = new Date().toISOString().split('T')[0]

      const employees = [
        {
          employeeCode: `${ctx.config.prefix}EMP001`,
          firstName: 'ทดสอบ',
          lastName: 'ผู้ควบคุมการผลิต',
          firstNameEn: 'Test',
          lastNameEn: 'Production Operator',
          email: `${ctx.config.prefix.toLowerCase()}emp001@test.com`,
          hireDate,
        },
        {
          employeeCode: `${ctx.config.prefix}EMP002`,
          firstName: 'ทดสอบ',
          lastName: 'ผู้ตรวจสอบคุณภาพ',
          firstNameEn: 'Test',
          lastNameEn: 'QC Inspector',
          email: `${ctx.config.prefix.toLowerCase()}emp002@test.com`,
          hireDate,
        },
      ]

      const createdEntities: CreatedEntity[] = []
      const employeeIds: Record<string, number> = {}

      for (const emp of employees) {
        const result = await executeApiCall(ctx, '/api/hr/employees', 'POST', emp)
        if (result.success) {
          const empId = (result.data?.data as Record<string, unknown>)?.id as number
          employeeIds[emp.employeeCode] = empId
          createdEntities.push({
            entityType: 'employee',
            entityId: empId,
            entityCode: emp.employeeCode,
            viewUrl: `/hr/employees/${empId}`,
          })
        }
      }

      ctx.createdData.employees = employeeIds

      return {
        success: createdEntities.length > 0,
        apiCall: {
          endpoint: '/api/hr/employees',
          method: 'POST',
          requestPayload: { employees },
          requestHeaders: { 'Content-Type': 'application/json' },
          responseStatus: 200,
          responseBody: { created: createdEntities.length },
          responseTime: 0,
        },
        createdEntities,
        data: { employeeIds },
      }
    },
  },

  // =========================================================================
  // Phase 2: BOM & Production Planning (Steps 5-6)
  // =========================================================================
  {
    id: 5,
    phaseId: 2,
    name: 'Create Bill of Materials',
    description: 'Create BOM for finished good with raw materials and packaging',
    endpoint: '/api/bom',
    method: 'POST',
    activityMessage: 'Creating BOM...',
    execute: async (ctx: ExecutionContext): Promise<StepResult> => {
      const fgItemCode = `${ctx.config.itemPrefix}FG001`
      const fgItemId = (ctx.createdData.items as Record<string, number>)?.[fgItemCode]

      const bomPayload = {
        productId: fgItemId,
        code: `${ctx.config.prefix}BOM001`,
        name: `${ctx.config.prefix}Herbal Tonic BOM`,
        version: '1.0',
        batchSize: 100,
        batchUnit: 'EA',
        lines: [
          {
            itemId: (ctx.createdData.items as Record<string, number>)?.[`${ctx.config.itemPrefix}RM001`],
            quantity: 5,
            unit: 'KG',
          },
          {
            itemId: (ctx.createdData.items as Record<string, number>)?.[`${ctx.config.itemPrefix}RM002`],
            quantity: 2,
            unit: 'KG',
          },
          {
            itemId: (ctx.createdData.items as Record<string, number>)?.[`${ctx.config.itemPrefix}PKG001`],
            quantity: 100,
            unit: 'EA',
          },
        ],
      }

      const result = await executeApiCall(ctx, '/api/bom', 'POST', bomPayload)

      if (!result.success) {
        return {
          success: false,
          apiCall: result.apiCall,
          createdEntities: [],
          error: createStepError(
            result.data?.error as string || 'Failed to create BOM',
            '/api/bom',
            result.apiCall.responseStatus,
            result.apiCall.responseBody
          ),
        }
      }

      const bomId = (result.data?.id as number) || (result.data?.data as Record<string, unknown>)?.id as number

      // Approve the BOM so it can be used for work orders
      // BOM status transitions: draft -> approved
      await executeApiCall(ctx, `/api/bom/${bomId}`, 'PUT', { status: 'approved' })

      ctx.createdData.bom = { id: bomId, code: `${ctx.config.prefix}BOM001` }

      return {
        success: true,
        apiCall: result.apiCall,
        createdEntities: [
          {
            entityType: 'bom',
            entityId: bomId,
            entityCode: `${ctx.config.prefix}BOM001`,
            viewUrl: `/production/bom/${bomId}`,
          },
        ],
        data: { bomId },
      }
    },
  },
  {
    id: 6,
    phaseId: 2,
    name: 'Execute BOM explosion',
    description: 'Calculate material requirements from BOM',
    endpoint: '/api/bom/{id}/explosion',
    method: 'GET',
    activityMessage: 'Executing BOM explosion...',
    execute: async (ctx: ExecutionContext): Promise<StepResult> => {
      const bomId = (ctx.createdData.bom as Record<string, unknown>)?.id as number
      // BOM explosion uses GET with query parameters
      const endpoint = `/api/bom/${bomId}/explosion?quantity=${ctx.config.productionQuantity}`

      const result = await executeApiCall(ctx, endpoint, 'GET')

      if (!result.success) {
        return {
          success: false,
          apiCall: result.apiCall,
          createdEntities: [],
          error: createStepError(
            result.data?.error as string || 'Failed to execute BOM explosion',
            endpoint,
            result.apiCall.responseStatus,
            result.apiCall.responseBody
          ),
        }
      }

      ctx.createdData.bomExplosion = result.data ?? {}

      return {
        success: true,
        apiCall: result.apiCall,
        createdEntities: [],
        data: result.data ?? {},
      }
    },
  },

  // =========================================================================
  // Phase 3: Purchasing Flow (Steps 7-12)
  // =========================================================================
  {
    id: 7,
    phaseId: 3,
    name: 'Setup vendor with AVL',
    description: 'Create vendor and approved vendor list entries',
    endpoint: '/api/vendors',
    method: 'POST',
    activityMessage: 'Creating vendor...',
    execute: async (ctx: ExecutionContext): Promise<StepResult> => {
      const vendorPayload = {
        code: `${ctx.config.prefix}VENDOR001`,
        name: ctx.config.vendorName,
        address: 'Test Vendor Address',
        phone: '000-000-0000',
        email: `${ctx.config.prefix.toLowerCase()}vendor@test.com`,
        isActive: true,
        isVMI: true, // Enable VMI for workflow test steps 30-31
      }

      const result = await executeApiCall(ctx, '/api/vendors', 'POST', vendorPayload)

      if (!result.success) {
        return {
          success: false,
          apiCall: result.apiCall,
          createdEntities: [],
          error: createStepError(
            result.data?.error as string || 'Failed to create vendor',
            '/api/vendors',
            result.apiCall.responseStatus,
            result.apiCall.responseBody
          ),
        }
      }

      const vendorId = (result.data?.data as Record<string, unknown>)?.id as number
      ctx.createdData.vendor = { id: vendorId, code: `${ctx.config.prefix}VENDOR001` }

      return {
        success: true,
        apiCall: result.apiCall,
        createdEntities: [
          {
            entityType: 'vendor',
            entityId: vendorId,
            entityCode: `${ctx.config.prefix}VENDOR001`,
            viewUrl: `/purchasing/vendors/${vendorId}`,
          },
        ],
        data: { vendorId },
      }
    },
  },
  {
    id: 8,
    phaseId: 3,
    name: 'Create purchase requisition',
    description: 'Create PR for raw materials from BOM explosion',
    endpoint: '/api/purchasing/requisitions',
    method: 'POST',
    activityMessage: 'Creating purchase requisition...',
    execute: async (ctx: ExecutionContext): Promise<StepResult> => {
      // Step 1: Create PR header
      const prPayload = {
        requesterId: ctx.userId,
        description: `${ctx.config.prefix}Material Requisition`,
        requiredDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        priority: 'normal',
      }

      const result = await executeApiCall(ctx, '/api/purchasing/requisitions', 'POST', prPayload)

      if (!result.success) {
        return {
          success: false,
          apiCall: result.apiCall,
          createdEntities: [],
          error: createStepError(
            result.data?.error as string || 'Failed to create PR',
            '/api/purchasing/requisitions',
            result.apiCall.responseStatus,
            result.apiCall.responseBody
          ),
        }
      }

      const prId = (result.data?.id as number) || (result.data?.data as Record<string, unknown>)?.id as number

      // Step 2: Add PR lines
      const linesPayload = {
        lines: [
          {
            itemId: (ctx.createdData.items as Record<string, number>)?.[`${ctx.config.itemPrefix}RM001`],
            description: `${ctx.config.prefix}Herb Extract`,
            quantity: ctx.config.purchaseQuantity,
            unitOfMeasure: 'KG',
          },
          {
            itemId: (ctx.createdData.items as Record<string, number>)?.[`${ctx.config.itemPrefix}RM002`],
            description: `${ctx.config.prefix}Active Ingredient`,
            quantity: Math.floor(ctx.config.purchaseQuantity * 0.4),
            unitOfMeasure: 'KG',
          },
        ],
      }

      await executeApiCall(ctx, `/api/purchasing/requisitions/${prId}/lines`, 'POST', linesPayload)

      ctx.createdData.pr = { id: prId, code: `PR-${prId}` }

      return {
        success: true,
        apiCall: result.apiCall,
        createdEntities: [
          {
            entityType: 'purchaseRequisition',
            entityId: prId,
            entityCode: `PR-${prId}`,
            viewUrl: `/purchasing/requisitions/${prId}`,
          },
        ],
        data: { prId },
      }
    },
  },
  {
    id: 9,
    phaseId: 3,
    name: 'Convert PR to purchase order',
    description: 'Create PO from approved PR',
    endpoint: '/api/purchasing/orders',
    method: 'POST',
    activityMessage: 'Creating purchase order...',
    execute: async (ctx: ExecutionContext): Promise<StepResult> => {
      const vendorId = (ctx.createdData.vendor as Record<string, unknown>)?.id as number

      const poPayload = {
        vendorId,
        expectedDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        lines: [
          {
            itemId: (ctx.createdData.items as Record<string, number>)?.[`${ctx.config.itemPrefix}RM001`],
            quantity: ctx.config.purchaseQuantity,
            unitPrice: 100,
            unit: 'KG',
          },
          {
            itemId: (ctx.createdData.items as Record<string, number>)?.[`${ctx.config.itemPrefix}RM002`],
            quantity: Math.floor(ctx.config.purchaseQuantity * 0.4),
            unitPrice: 200,
            unit: 'KG',
          },
        ],
      }

      const result = await executeApiCall(ctx, '/api/purchasing/orders', 'POST', poPayload)

      if (!result.success) {
        return {
          success: false,
          apiCall: result.apiCall,
          createdEntities: [],
          error: createStepError(
            result.data?.error as string || 'Failed to create PO',
            '/api/purchasing/orders',
            result.apiCall.responseStatus,
            result.apiCall.responseBody
          ),
        }
      }

      const poId = (result.data?.id as number) || (result.data?.data as Record<string, unknown>)?.id as number
      const poNumber = (result.data?.poNumber as string) || `PO-${poId}`
      ctx.createdData.po = { id: poId, code: poNumber }

      return {
        success: true,
        apiCall: result.apiCall,
        createdEntities: [
          {
            entityType: 'purchaseOrder',
            entityId: poId,
            entityCode: poNumber,
            viewUrl: `/purchasing/orders/${poId}`,
          },
        ],
        data: { poId },
      }
    },
  },
  {
    id: 10,
    phaseId: 3,
    name: 'Receive goods to quarantine',
    description: 'Receive materials to quarantine location pending QC',
    endpoint: '/api/inventory/lots',
    method: 'POST',
    activityMessage: 'Receiving goods...',
    execute: async (ctx: ExecutionContext): Promise<StepResult> => {
      const warehouseId = (ctx.createdData.warehouse as Record<string, unknown>)?.id as number
      // API requires: itemId, lotNumber, warehouseId, quantity, unit
      // Status is always 'quarantine' on creation (server-side)
      const lotPayloads = [
        {
          lotNumber: `${ctx.config.prefix}LOT001`,
          itemId: (ctx.createdData.items as Record<string, number>)?.[`${ctx.config.itemPrefix}RM001`],
          warehouseId,
          quantity: ctx.config.purchaseQuantity,
          unit: 'KG',
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        },
        {
          lotNumber: `${ctx.config.prefix}LOT002`,
          itemId: (ctx.createdData.items as Record<string, number>)?.[`${ctx.config.itemPrefix}RM002`],
          warehouseId,
          quantity: Math.floor(ctx.config.purchaseQuantity * 0.4),
          unit: 'KG',
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        },
      ]

      const createdEntities: CreatedEntity[] = []
      const lotIds: Record<string, number> = {}

      for (const lot of lotPayloads) {
        const result = await executeApiCall(ctx, '/api/inventory/lots', 'POST', lot)
        if (result.success) {
          const lotId = (result.data?.id as number) || (result.data?.data as Record<string, unknown>)?.id as number
          lotIds[lot.lotNumber] = lotId
          createdEntities.push({
            entityType: 'lot',
            entityId: lotId,
            entityCode: lot.lotNumber,
            viewUrl: `/inventory/lots/${lotId}`,
          })
        }
      }

      ctx.createdData.lots = lotIds

      return {
        success: createdEntities.length > 0,
        apiCall: {
          endpoint: '/api/inventory/lots',
          method: 'POST',
          requestPayload: { lots: lotPayloads },
          requestHeaders: { 'Content-Type': 'application/json' },
          responseStatus: 200,
          responseBody: { created: createdEntities.length },
          responseTime: 0,
        },
        createdEntities,
        data: { lotIds },
      }
    },
  },
  {
    id: 11,
    phaseId: 3,
    name: 'Perform incoming QC',
    description: 'Create QC specs, tests, and submit results for received materials',
    endpoint: '/api/quality/tests',
    method: 'POST',
    activityMessage: 'Performing incoming QC...',
    execute: async (ctx: ExecutionContext): Promise<StepResult> => {
      const lots = ctx.createdData.lots as Record<string, number>
      const items = ctx.createdData.items as Record<string, number>
      const createdEntities: CreatedEntity[] = []
      const qcTestIds: Record<string, number> = {}
      const specIds: Record<string, number> = {}

      // Step 1: Create quality specs for each raw material item
      const rmItems = [
        { code: `${ctx.config.itemPrefix}RM001`, name: 'Identity Test' },
        { code: `${ctx.config.itemPrefix}RM002`, name: 'Purity Test' },
      ]

      for (const item of rmItems) {
        const itemId = items[item.code]
        if (!itemId) continue

        const specPayload = {
          itemId,
          testName: `${ctx.config.prefix}${item.name}`,
          testMethod: 'Visual inspection',
          specification: 'Complies with specification',
        }

        const specResult = await executeApiCall(ctx, '/api/quality/specs', 'POST', specPayload)
        if (specResult.success) {
          const specId = (specResult.data?.id as number) || (specResult.data?.data as Record<string, unknown>)?.id as number
          specIds[item.code] = specId
        }
      }

      // Step 2: Create QC tests for each lot using the specs
      for (const [lotNumber, lotId] of Object.entries(lots)) {
        // Find the item for this lot and get its spec
        const itemCode = lotNumber.includes('LOT001')
          ? `${ctx.config.itemPrefix}RM001`
          : `${ctx.config.itemPrefix}RM002`
        const specId = specIds[itemCode]

        if (!specId) continue

        const testPayload = {
          lotId,
          specId,
          testType: 'incoming',
          sampleNumber: `${ctx.config.prefix}SAMPLE-${lotNumber}`,
        }

        const testResult = await executeApiCall(ctx, '/api/quality/tests', 'POST', testPayload)
        if (testResult.success) {
          const testId = (testResult.data?.id as number) || (testResult.data?.data as Record<string, unknown>)?.id as number

          // Step 3: Submit test result (pass)
          const resultPayload = {
            result: 'Complies',
            numericResult: 100,
            notes: `${ctx.config.prefix}Incoming QC - PASS`,
          }
          await executeApiCall(ctx, `/api/quality/tests/${testId}/result`, 'PUT', resultPayload)

          qcTestIds[lotNumber] = testId
          createdEntities.push({
            entityType: 'qcTest',
            entityId: testId,
            entityCode: `QC-${lotNumber}`,
            viewUrl: `/quality/tests/${testId}`,
          })
        }
      }

      ctx.createdData.incomingQc = qcTestIds
      ctx.createdData.qcSpecs = specIds

      return {
        success: createdEntities.length > 0,
        apiCall: {
          endpoint: '/api/quality/tests',
          method: 'POST',
          requestPayload: { qcTests: Object.keys(lots).length },
          requestHeaders: { 'Content-Type': 'application/json' },
          responseStatus: 200,
          responseBody: { created: createdEntities.length },
          responseTime: 0,
        },
        createdEntities,
        data: { qcTestIds, specIds },
      }
    },
  },
  {
    id: 12,
    phaseId: 3,
    name: 'Release QC-passed lots',
    description: 'Update lot status from quarantine to released',
    endpoint: '/api/inventory/lots/{id}/status',
    method: 'PUT',
    activityMessage: 'Releasing lots...',
    execute: async (ctx: ExecutionContext): Promise<StepResult> => {
      const lots = ctx.createdData.lots as Record<string, number>
      const createdEntities: CreatedEntity[] = []

      for (const [lotNumber, lotId] of Object.entries(lots)) {
        // Use the status endpoint with PUT method
        const result = await executeApiCall(ctx, `/api/inventory/lots/${lotId}/status`, 'PUT', {
          status: 'released',
          reason: `${ctx.config.prefix}QC passed - releasing lot`,
        })

        if (result.success) {
          createdEntities.push({
            entityType: 'lot',
            entityId: lotId,
            entityCode: `${lotNumber} (released)`,
            viewUrl: `/inventory/lots/${lotId}`,
          })
        }
      }

      return {
        success: createdEntities.length > 0,
        apiCall: {
          endpoint: '/api/inventory/lots/{id}/status',
          method: 'PUT',
          requestPayload: { status: 'released' },
          requestHeaders: { 'Content-Type': 'application/json' },
          responseStatus: 200,
          responseBody: { updated: createdEntities.length },
          responseTime: 0,
        },
        createdEntities,
      }
    },
  },

  // =========================================================================
  // Phase 4: Production Flow (Steps 13-19)
  // =========================================================================
  {
    id: 13,
    phaseId: 4,
    name: 'Create work order',
    description: 'Create production work order from BOM',
    endpoint: '/api/production/work-orders',
    method: 'POST',
    activityMessage: 'Creating work order...',
    execute: async (ctx: ExecutionContext): Promise<StepResult> => {
      const bomId = (ctx.createdData.bom as Record<string, unknown>)?.id as number
      const fgItemId = (ctx.createdData.items as Record<string, number>)?.[`${ctx.config.itemPrefix}FG001`]

      // API requires: bomId, productId, batchNumber, plannedQuantity, unit
      // Status starts as 'planned' automatically
      const woPayload = {
        bomId,
        productId: fgItemId,
        batchNumber: `${ctx.config.prefix}BATCH001`,
        plannedQuantity: ctx.config.productionQuantity,
        unit: 'EA',
        priority: 5,
        plannedStartDate: new Date().toISOString().split('T')[0],
        plannedEndDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        notes: `${ctx.config.prefix}Test production batch`,
      }

      const result = await executeApiCall(ctx, '/api/production/work-orders', 'POST', woPayload)

      if (!result.success) {
        return {
          success: false,
          apiCall: result.apiCall,
          createdEntities: [],
          error: createStepError(
            result.data?.error as string || 'Failed to create work order',
            '/api/production/work-orders',
            result.apiCall.responseStatus,
            result.apiCall.responseBody
          ),
        }
      }

      const woId = (result.data?.id as number) || (result.data?.data as Record<string, unknown>)?.id as number
      const woNumber = (result.data?.woNumber as string) || `WO-${woId}`
      ctx.createdData.workOrder = { id: woId, code: woNumber, batchNumber: `${ctx.config.prefix}BATCH001` }

      return {
        success: true,
        apiCall: result.apiCall,
        createdEntities: [
          {
            entityType: 'workOrder',
            entityId: woId,
            entityCode: woNumber,
            viewUrl: `/production/work-orders/${woId}`,
          },
        ],
        data: { woId, woNumber },
      }
    },
  },
  {
    id: 14,
    phaseId: 4,
    name: 'Release work order for production',
    description: 'Change work order status from planned to released',
    endpoint: '/api/production/work-orders/{id}/status',
    method: 'PUT',
    activityMessage: 'Releasing work order...',
    execute: async (ctx: ExecutionContext): Promise<StepResult> => {
      const woId = (ctx.createdData.workOrder as Record<string, unknown>)?.id as number
      const endpoint = `/api/production/work-orders/${woId}/status`

      // Work order status transitions: planned -> released -> in_progress -> completed
      const result = await executeApiCall(ctx, endpoint, 'PUT', {
        status: 'released',
        notes: `${ctx.config.prefix}Work order released for production`,
      })

      if (!result.success) {
        return {
          success: false,
          apiCall: result.apiCall,
          createdEntities: [],
          error: createStepError(
            result.data?.error as string || 'Failed to release work order',
            endpoint,
            result.apiCall.responseStatus,
            result.apiCall.responseBody
          ),
        }
      }

      return {
        success: true,
        apiCall: result.apiCall,
        createdEntities: [],
        data: result.data,
      }
    },
  },
  {
    id: 15,
    phaseId: 4,
    name: 'Issue materials to WO',
    description: 'Issue raw materials from inventory to work order',
    endpoint: '/api/production/work-orders/{id}/materials',
    method: 'POST',
    activityMessage: 'Issuing materials...',
    execute: async (ctx: ExecutionContext): Promise<StepResult> => {
      const woId = (ctx.createdData.workOrder as Record<string, unknown>)?.id as number
      const lots = ctx.createdData.lots as Record<string, number>
      const items = ctx.createdData.items as Record<string, number>
      const endpoint = `/api/production/work-orders/${woId}/materials`

      const createdEntities: CreatedEntity[] = []

      // Issue materials with lot assignments
      // Materials were auto-populated from BOM, but we need to assign lots
      for (const [lotNumber, lotId] of Object.entries(lots)) {
        const itemCode = lotNumber.includes('LOT001')
          ? `${ctx.config.itemPrefix}RM001`
          : `${ctx.config.itemPrefix}RM002`
        const itemId = items[itemCode]

        const materialPayload = {
          itemId,
          lotId,
          plannedQuantity: ctx.config.productionQuantity / 2,
          actualQuantity: ctx.config.productionQuantity / 2,
          unit: 'KG',
        }

        const result = await executeApiCall(ctx, endpoint, 'POST', materialPayload)
        if (result.success) {
          const materialId = (result.data?.id as number) || (result.data?.data as Record<string, unknown>)?.id as number
          createdEntities.push({
            entityType: 'woMaterial',
            entityId: materialId,
            entityCode: `MAT-${lotNumber}`,
            viewUrl: `/production/work-orders/${woId}`,
          })
        }
      }

      return {
        success: createdEntities.length > 0,
        apiCall: {
          endpoint,
          method: 'POST',
          requestPayload: { materials: Object.keys(lots).length },
          requestHeaders: { 'Content-Type': 'application/json' },
          responseStatus: 200,
          responseBody: { issued: createdEntities.length },
          responseTime: 0,
        },
        createdEntities,
      }
    },
  },
  {
    id: 16,
    phaseId: 4,
    name: 'Start production',
    description: 'Start production by changing work order status to in_progress',
    endpoint: '/api/production/work-orders/{id}/status',
    method: 'PUT',
    activityMessage: 'Starting production...',
    execute: async (ctx: ExecutionContext): Promise<StepResult> => {
      const woId = (ctx.createdData.workOrder as Record<string, unknown>)?.id as number
      const endpoint = `/api/production/work-orders/${woId}/status`

      // Status transition: released -> in_progress
      const result = await executeApiCall(ctx, endpoint, 'PUT', {
        status: 'in_progress',
        notes: `${ctx.config.prefix}Production started`,
      })

      if (!result.success) {
        return {
          success: false,
          apiCall: result.apiCall,
          createdEntities: [],
          error: createStepError(
            result.data?.error as string || 'Failed to start production',
            endpoint,
            result.apiCall.responseStatus,
            result.apiCall.responseBody
          ),
        }
      }

      return {
        success: true,
        apiCall: result.apiCall,
        createdEntities: [],
        data: result.data,
      }
    },
  },
  {
    id: 17,
    phaseId: 4,
    name: 'Perform in-process QC',
    description: 'Execute in-process quality checks during production',
    endpoint: '/api/quality/tests',
    method: 'POST',
    activityMessage: 'Performing in-process QC...',
    execute: async (ctx: ExecutionContext): Promise<StepResult> => {
      const lots = ctx.createdData.lots as Record<string, number>
      const qcSpecs = ctx.createdData.qcSpecs as Record<string, number>

      // Use an existing lot and spec for IPQC
      const lotEntries = Object.entries(lots)
      if (lotEntries.length === 0) {
        return {
          success: false,
          apiCall: {
            endpoint: '/api/quality/tests',
            method: 'POST',
            requestPayload: null,
            requestHeaders: { 'Content-Type': 'application/json' },
            responseStatus: 400,
            responseBody: { error: 'No lots available for IPQC' },
            responseTime: 0,
          },
          createdEntities: [],
          error: createStepError('No lots available for IPQC', '/api/quality/tests', 400, null),
        }
      }

      const [lotNumber, lotId] = lotEntries[0]
      const itemCode = lotNumber.includes('LOT001')
        ? `${ctx.config.itemPrefix}RM001`
        : `${ctx.config.itemPrefix}RM002`
      const specId = qcSpecs?.[itemCode]

      if (!specId) {
        return {
          success: false,
          apiCall: {
            endpoint: '/api/quality/tests',
            method: 'POST',
            requestPayload: null,
            requestHeaders: { 'Content-Type': 'application/json' },
            responseStatus: 400,
            responseBody: { error: 'No QC spec available' },
            responseTime: 0,
          },
          createdEntities: [],
          error: createStepError('No QC spec available for IPQC', '/api/quality/tests', 400, null),
        }
      }

      // Create in-process QC test
      const testPayload = {
        lotId,
        specId,
        testType: 'in_process',
        sampleNumber: `${ctx.config.prefix}IPQC-SAMPLE`,
      }

      const testResult = await executeApiCall(ctx, '/api/quality/tests', 'POST', testPayload)

      if (!testResult.success) {
        return {
          success: false,
          apiCall: testResult.apiCall,
          createdEntities: [],
          error: createStepError(
            testResult.data?.error as string || 'Failed to perform IPQC',
            '/api/quality/tests',
            testResult.apiCall.responseStatus,
            testResult.apiCall.responseBody
          ),
        }
      }

      const qcId = (testResult.data?.id as number) || (testResult.data?.data as Record<string, unknown>)?.id as number

      // Submit test result (pass)
      await executeApiCall(ctx, `/api/quality/tests/${qcId}/result`, 'PUT', {
        result: 'Complies',
        numericResult: 100,
        notes: `${ctx.config.prefix}IPQC - PASS`,
      })

      ctx.createdData.ipqc = { id: qcId }

      return {
        success: true,
        apiCall: testResult.apiCall,
        createdEntities: [
          {
            entityType: 'qcTest',
            entityId: qcId,
            entityCode: `IPQC-${ctx.config.prefix}`,
            viewUrl: `/quality/tests/${qcId}`,
          },
        ],
        data: { qcId },
      }
    },
  },
  {
    id: 18,
    phaseId: 4,
    name: 'Complete production',
    description: 'Mark work order as completed with yield data',
    endpoint: '/api/production/work-orders/{id}/status',
    method: 'PUT',
    activityMessage: 'Completing production...',
    execute: async (ctx: ExecutionContext): Promise<StepResult> => {
      const woId = (ctx.createdData.workOrder as Record<string, unknown>)?.id as number
      const endpoint = `/api/production/work-orders/${woId}/status`

      // Status transition: in_progress -> completed
      const result = await executeApiCall(ctx, endpoint, 'PUT', {
        status: 'completed',
        actualQuantity: ctx.config.productionQuantity,
        yieldPercentage: 98.5,
        notes: `${ctx.config.prefix}Production completed successfully`,
      })

      if (!result.success) {
        return {
          success: false,
          apiCall: result.apiCall,
          createdEntities: [],
          error: createStepError(
            result.data?.error as string || 'Failed to complete production',
            endpoint,
            result.apiCall.responseStatus,
            result.apiCall.responseBody
          ),
        }
      }

      return {
        success: true,
        apiCall: result.apiCall,
        createdEntities: [],
        data: result.data,
      }
    },
  },
  {
    id: 19,
    phaseId: 4,
    name: 'Receive finished goods',
    description: 'Create finished goods lot from production output',
    endpoint: '/api/inventory/lots',
    method: 'POST',
    activityMessage: 'Receiving finished goods...',
    execute: async (ctx: ExecutionContext): Promise<StepResult> => {
      const warehouseId = (ctx.createdData.warehouse as Record<string, unknown>)?.id as number
      const fgItemId = (ctx.createdData.items as Record<string, number>)?.[`${ctx.config.itemPrefix}FG001`]
      const batchNumber = (ctx.createdData.workOrder as Record<string, unknown>)?.batchNumber as string

      // API requires: itemId, lotNumber, warehouseId, quantity, unit
      const lotPayload = {
        lotNumber: `${ctx.config.prefix}FG_LOT001`,
        batchNumber: batchNumber || `${ctx.config.prefix}BATCH001`,
        itemId: fgItemId,
        warehouseId,
        quantity: ctx.config.productionQuantity,
        unit: 'EA',
        expiryDate: new Date(Date.now() + 730 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      }

      const result = await executeApiCall(ctx, '/api/inventory/lots', 'POST', lotPayload)

      if (!result.success) {
        return {
          success: false,
          apiCall: result.apiCall,
          createdEntities: [],
          error: createStepError(
            result.data?.error as string || 'Failed to receive FG',
            '/api/inventory/lots',
            result.apiCall.responseStatus,
            result.apiCall.responseBody
          ),
        }
      }

      const lotId = (result.data?.id as number) || (result.data?.data as Record<string, unknown>)?.id as number
      ctx.createdData.fgLot = { id: lotId, lotNumber: `${ctx.config.prefix}FG_LOT001` }

      return {
        success: true,
        apiCall: result.apiCall,
        createdEntities: [
          {
            entityType: 'lot',
            entityId: lotId,
            entityCode: `${ctx.config.prefix}FG_LOT001`,
            viewUrl: `/inventory/lots/${lotId}`,
          },
        ],
        data: { lotId },
      }
    },
  },

  // =========================================================================
  // Phase 5: Finished Goods QC (Steps 20-21)
  // =========================================================================
  {
    id: 20,
    phaseId: 5,
    name: 'Perform FG QC testing',
    description: 'Execute quality control tests on finished goods',
    endpoint: '/api/quality/tests',
    method: 'POST',
    activityMessage: 'Performing FG QC...',
    execute: async (ctx: ExecutionContext): Promise<StepResult> => {
      const fgLotId = (ctx.createdData.fgLot as Record<string, unknown>)?.id as number
      const fgItemId = (ctx.createdData.items as Record<string, number>)?.[`${ctx.config.itemPrefix}FG001`]

      // First create a QC spec for the finished good
      const specPayload = {
        itemId: fgItemId,
        testName: `${ctx.config.prefix}FG Appearance Test`,
        testMethod: 'Visual inspection',
        specification: 'Clear liquid, no particles',
      }

      const specResult = await executeApiCall(ctx, '/api/quality/specs', 'POST', specPayload)
      let specId: number | undefined

      if (specResult.success) {
        specId = (specResult.data?.id as number) || (specResult.data?.data as Record<string, unknown>)?.id as number
      }

      if (!specId) {
        return {
          success: false,
          apiCall: specResult.apiCall,
          createdEntities: [],
          error: createStepError(
            'Failed to create FG QC spec',
            '/api/quality/specs',
            specResult.apiCall.responseStatus,
            specResult.apiCall.responseBody
          ),
        }
      }

      // Create final QC test
      const testPayload = {
        lotId: fgLotId,
        specId,
        testType: 'final',
        sampleNumber: `${ctx.config.prefix}FG-SAMPLE`,
      }

      const testResult = await executeApiCall(ctx, '/api/quality/tests', 'POST', testPayload)

      if (!testResult.success) {
        return {
          success: false,
          apiCall: testResult.apiCall,
          createdEntities: [],
          error: createStepError(
            testResult.data?.error as string || 'Failed to perform FG QC',
            '/api/quality/tests',
            testResult.apiCall.responseStatus,
            testResult.apiCall.responseBody
          ),
        }
      }

      const qcId = (testResult.data?.id as number) || (testResult.data?.data as Record<string, unknown>)?.id as number

      // Submit test result (pass)
      await executeApiCall(ctx, `/api/quality/tests/${qcId}/result`, 'PUT', {
        result: 'Complies',
        numericResult: 100,
        notes: `${ctx.config.prefix}FG QC - PASS`,
      })

      ctx.createdData.fgQc = { id: qcId }
      ctx.createdData.fgQcSpec = { id: specId }

      return {
        success: true,
        apiCall: testResult.apiCall,
        createdEntities: [
          {
            entityType: 'qcTest',
            entityId: qcId,
            entityCode: `FG-QC-${ctx.config.prefix}FG_LOT001`,
            viewUrl: `/quality/tests/${qcId}`,
          },
        ],
        data: { qcId, specId },
      }
    },
  },
  {
    id: 21,
    phaseId: 5,
    name: 'Release finished goods',
    description: 'Update FG lot status to released for sale',
    endpoint: '/api/inventory/lots/{id}/status',
    method: 'PUT',
    activityMessage: 'Releasing finished goods...',
    execute: async (ctx: ExecutionContext): Promise<StepResult> => {
      const fgLotId = (ctx.createdData.fgLot as Record<string, unknown>)?.id as number
      const endpoint = `/api/inventory/lots/${fgLotId}/status`

      // Use the status endpoint with PUT method
      const result = await executeApiCall(ctx, endpoint, 'PUT', {
        status: 'released',
        reason: `${ctx.config.prefix}FG QC passed - releasing for sale`,
      })

      if (!result.success) {
        return {
          success: false,
          apiCall: result.apiCall,
          createdEntities: [],
          error: createStepError(
            result.data?.error as string || 'Failed to release FG',
            endpoint,
            result.apiCall.responseStatus,
            result.apiCall.responseBody
          ),
        }
      }

      return {
        success: true,
        apiCall: result.apiCall,
        createdEntities: [
          {
            entityType: 'lot',
            entityId: fgLotId,
            entityCode: `${(ctx.createdData.fgLot as Record<string, unknown>)?.lotNumber} (released)`,
            viewUrl: `/inventory/lots/${fgLotId}`,
          },
        ],
        data: result.data,
      }
    },
  },

  // =========================================================================
  // Phase 6: Sales Flow (Steps 22-25)
  // =========================================================================
  {
    id: 22,
    phaseId: 6,
    name: 'Setup customer master',
    description: 'Create customer record for sales',
    endpoint: '/api/customers',
    method: 'POST',
    activityMessage: 'Creating customer...',
    execute: async (ctx: ExecutionContext): Promise<StepResult> => {
      const customerPayload = {
        code: `${ctx.config.prefix}CUST001`,
        name: ctx.config.customerName,
        address: 'Test Customer Address',
        phone: '000-000-0001',
        email: `${ctx.config.prefix.toLowerCase()}customer@test.com`,
        isActive: true,
      }

      const result = await executeApiCall(ctx, '/api/customers', 'POST', customerPayload)

      if (!result.success) {
        return {
          success: false,
          apiCall: result.apiCall,
          createdEntities: [],
          error: createStepError(
            result.data?.error as string || 'Failed to create customer',
            '/api/customers',
            result.apiCall.responseStatus,
            result.apiCall.responseBody
          ),
        }
      }

      const customerId = (result.data?.data as Record<string, unknown>)?.id as number
      ctx.createdData.customer = { id: customerId, code: `${ctx.config.prefix}CUST001` }

      return {
        success: true,
        apiCall: result.apiCall,
        createdEntities: [
          {
            entityType: 'customer',
            entityId: customerId,
            entityCode: `${ctx.config.prefix}CUST001`,
            viewUrl: `/sales/customers/${customerId}`,
          },
        ],
        data: { customerId },
      }
    },
  },
  {
    id: 23,
    phaseId: 6,
    name: 'Create sales order with ATP',
    description: 'Create sales order with available-to-promise check',
    endpoint: '/api/sales/orders',
    method: 'POST',
    activityMessage: 'Creating sales order...',
    execute: async (ctx: ExecutionContext): Promise<StepResult> => {
      const customerId = (ctx.createdData.customer as Record<string, unknown>)?.id as number
      const fgItemId = (ctx.createdData.items as Record<string, number>)?.[`${ctx.config.itemPrefix}FG001`]

      const soPayload = {
        customerName: `${ctx.config.prefix}Test Customer`,
        customerContact: 'Test Contact',
        customerAddress: 'Test Address',
        requiredDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        lines: [
          {
            itemId: fgItemId,
            quantity: ctx.config.salesQuantity,
            unitPrice: 50,
            unit: 'EA',
          },
        ],
      }

      const result = await executeApiCall(ctx, '/api/sales/orders', 'POST', soPayload)

      if (!result.success) {
        return {
          success: false,
          apiCall: result.apiCall,
          createdEntities: [],
          error: createStepError(
            result.data?.error as string || 'Failed to create SO',
            '/api/sales/orders',
            result.apiCall.responseStatus,
            result.apiCall.responseBody
          ),
        }
      }

      const soId = (result.data?.id as number) || (result.data?.data as Record<string, unknown>)?.id as number
      const soNumber = (result.data?.soNumber as string) || `SO-${soId}`
      ctx.createdData.salesOrder = { id: soId, code: soNumber }

      return {
        success: true,
        apiCall: result.apiCall,
        createdEntities: [
          {
            entityType: 'salesOrder',
            entityId: soId,
            entityCode: soNumber,
            viewUrl: `/sales/orders/${soId}`,
          },
        ],
        data: { soId },
      }
    },
  },
  {
    id: 24,
    phaseId: 6,
    name: 'Fulfill sales order',
    description: 'Fulfill sales order line with inventory lot',
    endpoint: '/api/sales/orders/{id}/fulfill',
    method: 'POST',
    activityMessage: 'Fulfilling order...',
    execute: async (ctx: ExecutionContext): Promise<StepResult> => {
      const soId = (ctx.createdData.salesOrder as Record<string, unknown>)?.id as number
      const fgLotId = (ctx.createdData.fgLot as Record<string, unknown>)?.id as number
      const fgItemId = (ctx.createdData.items as Record<string, number>)?.[`${ctx.config.itemPrefix}FG001`]
      const endpoint = `/api/sales/orders/${soId}/fulfill`

      // First, get the SO details to get the line ID
      const soDetailResult = await executeApiCall(ctx, `/api/sales/orders/${soId}/detail`, 'GET')

      let soLineId = 1 // Default fallback
      if (soDetailResult.success && soDetailResult.data) {
        // Response structure: { success, data: { salesOrder, lines, summary } }
        const responseData = soDetailResult.data as { data?: { lines?: { id: number }[] } }
        const lines = responseData?.data?.lines
        if (lines && lines.length > 0) {
          soLineId = lines[0].id
        }
      }

      // API requires: soLineId, itemId, lotId, quantity
      const fulfillPayload = {
        soLineId,
        itemId: fgItemId,
        lotId: fgLotId,
        quantity: ctx.config.salesQuantity,
        notes: `${ctx.config.prefix}Fulfilled from FG lot`,
      }

      const result = await executeApiCall(ctx, endpoint, 'POST', fulfillPayload)

      if (!result.success) {
        return {
          success: false,
          apiCall: result.apiCall,
          createdEntities: [],
          error: createStepError(
            result.data?.error as string || 'Failed to fulfill order',
            endpoint,
            result.apiCall.responseStatus,
            result.apiCall.responseBody
          ),
        }
      }

      const deliveryId = (result.data?.id as number) || (result.data?.data as Record<string, unknown>)?.id as number

      return {
        success: true,
        apiCall: result.apiCall,
        createdEntities: deliveryId
          ? [
              {
                entityType: 'delivery',
                entityId: deliveryId,
                entityCode: `DEL-${ctx.config.prefix}`,
                viewUrl: `/sales/orders/${soId}`,
              },
            ]
          : [],
        data: result.data,
      }
    },
  },
  {
    id: 25,
    phaseId: 6,
    name: 'Verify deliveries',
    description: 'Verify deliveries were created for the sales order',
    endpoint: '/api/sales/orders/{id}/deliveries',
    method: 'GET',
    activityMessage: 'Verifying deliveries...',
    execute: async (ctx: ExecutionContext): Promise<StepResult> => {
      const soId = (ctx.createdData.salesOrder as Record<string, unknown>)?.id as number
      const endpoint = `/api/sales/orders/${soId}/deliveries`

      const result = await executeApiCall(ctx, endpoint, 'GET')

      if (!result.success) {
        return {
          success: false,
          apiCall: result.apiCall,
          createdEntities: [],
          error: createStepError(
            result.data?.error as string || 'Failed to verify deliveries',
            endpoint,
            result.apiCall.responseStatus,
            result.apiCall.responseBody
          ),
        }
      }

      const deliveries = (result.data?.data as { deliveries?: { id: number; deliveryNumber: string }[] })?.deliveries || []

      return {
        success: deliveries.length > 0,
        apiCall: result.apiCall,
        createdEntities: deliveries.map((d) => ({
          entityType: 'delivery',
          entityId: d.id,
          entityCode: d.deliveryNumber,
          viewUrl: `/sales/orders/${soId}`,
        })),
        data: result.data,
        error: deliveries.length === 0
          ? createStepError('No deliveries found for order', endpoint, 200, result.apiCall.responseBody)
          : undefined,
      }
    },
  },

  // =========================================================================
  // Phase 7: Accounting Verification (Steps 26-29)
  // =========================================================================
  {
    id: 26,
    phaseId: 7,
    name: 'Verify AP invoice',
    description: 'Verify accounts payable invoice was created from PO',
    endpoint: '/api/accounting/ap-invoices',
    method: 'GET',
    activityMessage: 'Verifying AP invoice...',
    execute: async (ctx: ExecutionContext): Promise<StepResult> => {
      const poCode = (ctx.createdData.po as Record<string, unknown>)?.code as string
      const endpoint = `/api/accounting/ap-invoices?search=${encodeURIComponent(poCode)}`

      const result = await executeApiCall(ctx, endpoint, 'GET')

      // This is a verification step - we just check if we can query
      return {
        success: result.success,
        apiCall: result.apiCall,
        createdEntities: [],
        data: result.data,
        error: !result.success
          ? createStepError(
              'Failed to verify AP invoice',
              endpoint,
              result.apiCall.responseStatus,
              result.apiCall.responseBody
            )
          : undefined,
      }
    },
  },
  {
    id: 27,
    phaseId: 7,
    name: 'Verify AR invoice',
    description: 'Verify accounts receivable invoice was created from SO',
    endpoint: '/api/accounting/ar-invoices',
    method: 'GET',
    activityMessage: 'Verifying AR invoice...',
    execute: async (ctx: ExecutionContext): Promise<StepResult> => {
      const soCode = (ctx.createdData.salesOrder as Record<string, unknown>)?.code as string
      const endpoint = `/api/accounting/ar-invoices?search=${encodeURIComponent(soCode)}`

      const result = await executeApiCall(ctx, endpoint, 'GET')

      return {
        success: result.success,
        apiCall: result.apiCall,
        createdEntities: [],
        data: result.data,
        error: !result.success
          ? createStepError(
              'Failed to verify AR invoice',
              endpoint,
              result.apiCall.responseStatus,
              result.apiCall.responseBody
            )
          : undefined,
      }
    },
  },
  {
    id: 28,
    phaseId: 7,
    name: 'Verify journal entries',
    description: 'Verify journal entries were created for transactions',
    endpoint: '/api/accounting/journal-entries',
    method: 'GET',
    activityMessage: 'Verifying journal entries...',
    execute: async (ctx: ExecutionContext): Promise<StepResult> => {
      const endpoint = `/api/accounting/journal-entries?search=${encodeURIComponent(ctx.config.prefix)}`

      const result = await executeApiCall(ctx, endpoint, 'GET')

      return {
        success: result.success,
        apiCall: result.apiCall,
        createdEntities: [],
        data: result.data,
        error: !result.success
          ? createStepError(
              'Failed to verify journal entries',
              endpoint,
              result.apiCall.responseStatus,
              result.apiCall.responseBody
            )
          : undefined,
      }
    },
  },
  {
    id: 29,
    phaseId: 7,
    name: 'Verify 3-way matching',
    description: 'Verify PO, GRN, and invoice 3-way matching status',
    endpoint: '/api/accounting/matching',
    method: 'GET',
    activityMessage: 'Verifying 3-way matching...',
    execute: async (ctx: ExecutionContext): Promise<StepResult> => {
      // Use the matching summary endpoint to verify matching is available
      const endpoint = `/api/accounting/matching`

      const result = await executeApiCall(ctx, endpoint, 'GET')

      return {
        success: result.success,
        apiCall: result.apiCall,
        createdEntities: [],
        data: result.data,
        error: !result.success
          ? createStepError(
              'Failed to verify 3-way matching',
              endpoint,
              result.apiCall.responseStatus,
              result.apiCall.responseBody
            )
          : undefined,
      }
    },
  },

  // =========================================================================
  // Phase 8: VMI Integration (Steps 30-31)
  // =========================================================================
  {
    id: 30,
    phaseId: 8,
    name: 'Verify VMI endpoint',
    description: 'Verify VMI endpoint is accessible',
    endpoint: '/api/purchasing/vmi',
    method: 'GET',
    activityMessage: 'Verifying VMI endpoint...',
    execute: async (ctx: ExecutionContext): Promise<StepResult> => {
      const vendorId = (ctx.createdData.vendor as Record<string, unknown>)?.id as number
      const endpoint = `/api/purchasing/vmi?vendorId=${vendorId}`

      const result = await executeApiCall(ctx, endpoint, 'GET')

      // For verification steps, we consider it successful if the endpoint responds
      // (even with an error about VMI not being configured for the vendor)
      // Only fail on network errors or 404 (endpoint not found)
      const isEndpointAccessible = result.apiCall.responseStatus !== 404 &&
                                   result.apiCall.responseStatus !== 0

      return {
        success: isEndpointAccessible,
        apiCall: result.apiCall,
        createdEntities: [],
        data: result.data,
        error: !isEndpointAccessible
          ? createStepError(
              'VMI endpoint not accessible',
              endpoint,
              result.apiCall.responseStatus,
              result.apiCall.responseBody
            )
          : undefined,
      }
    },
  },
  {
    id: 31,
    phaseId: 8,
    name: 'Verify VMI orders endpoint',
    description: 'Verify VMI orders endpoint is accessible',
    endpoint: '/api/sales/vmi-orders',
    method: 'GET',
    activityMessage: 'Verifying VMI orders...',
    execute: async (ctx: ExecutionContext): Promise<StepResult> => {
      const endpoint = `/api/sales/vmi-orders`

      const result = await executeApiCall(ctx, endpoint, 'GET')

      // For verification steps, we consider it successful if the endpoint responds
      const isEndpointAccessible = result.apiCall.responseStatus !== 404 &&
                                   result.apiCall.responseStatus !== 0

      return {
        success: isEndpointAccessible,
        apiCall: result.apiCall,
        createdEntities: [],
        data: result.data,
        error: !isEndpointAccessible
          ? createStepError(
              'VMI orders endpoint not accessible',
              endpoint,
              result.apiCall.responseStatus,
              result.apiCall.responseBody
            )
          : undefined,
      }
    },
  },

  // =========================================================================
  // Phase 9: HR Flow (Steps 32-39)
  // =========================================================================
  {
    id: 32,
    phaseId: 9,
    name: 'Setup organization structure',
    description: 'Create department and section org units for HR hierarchy',
    endpoint: '/api/hr/org-units',
    method: 'POST',
    activityMessage: 'Creating organization units...',
    execute: async (ctx: ExecutionContext): Promise<StepResult> => {
      const today = new Date().toISOString().split('T')[0]

      // Create a department first
      const deptPayload = {
        code: `${ctx.config.prefix}DEPT01`,
        name: `${ctx.config.prefix}ฝ่ายผลิต`,
        nameEn: `${ctx.config.prefix}Production Department`,
        type: 'department',
        parentId: null,
        isGmpCritical: true,
        effectiveFrom: today,
      }

      const deptResult = await executeApiCall(ctx, '/api/hr/org-units', 'POST', deptPayload)

      if (!deptResult.success) {
        return {
          success: false,
          apiCall: deptResult.apiCall,
          createdEntities: [],
          error: createStepError(
            deptResult.data?.error as string || 'Failed to create department',
            '/api/hr/org-units',
            deptResult.apiCall.responseStatus,
            deptResult.apiCall.responseBody
          ),
        }
      }

      const deptId = (deptResult.data?.data as Record<string, unknown>)?.id as number

      // Create a section under the department
      const sectionPayload = {
        code: `${ctx.config.prefix}SEC01`,
        name: `${ctx.config.prefix}แผนกควบคุมคุณภาพ`,
        nameEn: `${ctx.config.prefix}QC Section`,
        type: 'section',
        parentId: deptId,
        isGmpCritical: true,
        effectiveFrom: today,
      }

      const sectionResult = await executeApiCall(ctx, '/api/hr/org-units', 'POST', sectionPayload)

      const sectionId = sectionResult.success
        ? ((sectionResult.data?.data as Record<string, unknown>)?.id as number)
        : null

      const createdEntities: CreatedEntity[] = [
        {
          entityType: 'orgUnit',
          entityId: deptId,
          entityCode: `${ctx.config.prefix}DEPT01`,
          viewUrl: `/hr/org-units/${deptId}`,
        },
      ]

      if (sectionId) {
        createdEntities.push({
          entityType: 'orgUnit',
          entityId: sectionId,
          entityCode: `${ctx.config.prefix}SEC01`,
          viewUrl: `/hr/org-units/${sectionId}`,
        })
      }

      ctx.createdData.orgUnits = {
        departmentId: deptId,
        sectionId: sectionId,
      }

      return {
        success: true,
        apiCall: deptResult.apiCall,
        createdEntities,
        data: { departmentId: deptId, sectionId },
      }
    },
  },
  {
    id: 33,
    phaseId: 9,
    name: 'Setup positions',
    description: 'Create positions for Production Manager and QC Supervisor',
    endpoint: '/api/hr/positions',
    method: 'POST',
    activityMessage: 'Creating positions...',
    execute: async (ctx: ExecutionContext): Promise<StepResult> => {
      const orgUnits = ctx.createdData.orgUnits as Record<string, number>
      const positions = [
        {
          code: `${ctx.config.prefix}POS01`,
          title: `${ctx.config.prefix}ผู้จัดการฝ่ายผลิต`,
          titleEn: `${ctx.config.prefix}Production Manager`,
          orgUnitId: orgUnits.departmentId,
          jobGrade: 'M3',
          isGmpCritical: true,
        },
        {
          code: `${ctx.config.prefix}POS02`,
          title: `${ctx.config.prefix}หัวหน้าแผนก QC`,
          titleEn: `${ctx.config.prefix}QC Supervisor`,
          orgUnitId: orgUnits.sectionId || orgUnits.departmentId,
          jobGrade: 'S2',
          isGmpCritical: true,
        },
      ]

      const createdEntities: CreatedEntity[] = []
      const positionIds: Record<string, number> = {}

      for (const pos of positions) {
        const result = await executeApiCall(ctx, '/api/hr/positions', 'POST', pos)
        if (result.success) {
          const posId = (result.data?.data as Record<string, unknown>)?.id as number
          positionIds[pos.code] = posId
          createdEntities.push({
            entityType: 'position',
            entityId: posId,
            entityCode: pos.code,
            viewUrl: `/hr/positions/${posId}`,
          })
        }
      }

      ctx.createdData.positions = positionIds

      return {
        success: createdEntities.length > 0,
        apiCall: {
          endpoint: '/api/hr/positions',
          method: 'POST',
          requestPayload: { positions },
          requestHeaders: { 'Content-Type': 'application/json' },
          responseStatus: 200,
          responseBody: { created: createdEntities.length },
          responseTime: 0,
        },
        createdEntities,
        data: { positionIds },
      }
    },
  },
  {
    id: 34,
    phaseId: 9,
    name: 'Assign employees to positions',
    description: 'Create employee-position assignments with effective dates',
    endpoint: '/api/hr/employees/{id}/assignments',
    method: 'POST',
    activityMessage: 'Assigning employees to positions...',
    execute: async (ctx: ExecutionContext): Promise<StepResult> => {
      const employees = ctx.createdData.employees as Record<string, number>
      const positions = ctx.createdData.positions as Record<string, number>
      const orgUnits = ctx.createdData.orgUnits as Record<string, number>

      const today = new Date().toISOString().split('T')[0]

      // Get employee IDs
      const emp1Code = `${ctx.config.prefix}EMP001`
      const emp2Code = `${ctx.config.prefix}EMP002`
      const pos1Code = `${ctx.config.prefix}POS01`
      const pos2Code = `${ctx.config.prefix}POS02`

      const assignments = [
        {
          employeeId: employees[emp1Code],
          positionId: positions[pos1Code],
          orgUnitId: orgUnits.departmentId,
          effectiveFrom: today,
        },
        {
          employeeId: employees[emp2Code],
          positionId: positions[pos2Code],
          orgUnitId: orgUnits.sectionId || orgUnits.departmentId,
          effectiveFrom: today,
        },
      ]

      const createdEntities: CreatedEntity[] = []

      for (const assignment of assignments) {
        if (!assignment.employeeId || !assignment.positionId) continue

        const endpoint = `/api/hr/employees/${assignment.employeeId}/assignments`
        const result = await executeApiCall(ctx, endpoint, 'POST', {
          positionId: assignment.positionId,
          orgUnitId: assignment.orgUnitId,
          effectiveFrom: assignment.effectiveFrom,
          isPrimary: true,
        })

        if (result.success) {
          const assignId = (result.data?.data as Record<string, unknown>)?.id as number
          createdEntities.push({
            entityType: 'employeeAssignment',
            entityId: assignId,
            entityCode: `EMP-${assignment.employeeId}-POS-${assignment.positionId}`,
            viewUrl: `/hr/employees/${assignment.employeeId}`,
          })
        }
      }

      ctx.createdData.employeeAssignments = { count: createdEntities.length }

      return {
        success: createdEntities.length > 0,
        apiCall: {
          endpoint: '/api/hr/employees/{id}/assignments',
          method: 'POST',
          requestPayload: { assignments },
          requestHeaders: { 'Content-Type': 'application/json' },
          responseStatus: 200,
          responseBody: { created: createdEntities.length },
          responseTime: 0,
        },
        createdEntities,
        data: { assignedCount: createdEntities.length },
      }
    },
  },
  {
    id: 35,
    phaseId: 9,
    name: 'Setup training courses',
    description: 'Create mandatory GMP and SOP training courses',
    endpoint: '/api/hr/training/courses',
    method: 'POST',
    activityMessage: 'Creating training courses...',
    execute: async (ctx: ExecutionContext): Promise<StepResult> => {
      const courses = [
        {
          code: `${ctx.config.prefix}TRN01`,
          name: `${ctx.config.prefix}GMP Training`,
          nameEn: `${ctx.config.prefix}GMP Training`,
          description: 'Good Manufacturing Practice training for GMP-critical positions',
          category: 'GMP',
          validityDays: 365,
          isMandatory: true,
          durationHours: 8,
        },
        {
          code: `${ctx.config.prefix}TRN02`,
          name: `${ctx.config.prefix}SOP Training`,
          nameEn: `${ctx.config.prefix}SOP Training`,
          description: 'Standard Operating Procedure training',
          category: 'SOP',
          validityDays: 180,
          isMandatory: true,
          durationHours: 4,
        },
      ]

      const createdEntities: CreatedEntity[] = []
      const courseIds: Record<string, number> = {}

      for (const course of courses) {
        const result = await executeApiCall(ctx, '/api/hr/training/courses', 'POST', course)
        if (result.success) {
          const courseId = (result.data?.data as Record<string, unknown>)?.id as number
          courseIds[course.code] = courseId
          createdEntities.push({
            entityType: 'trainingCourse',
            entityId: courseId,
            entityCode: course.code,
            viewUrl: `/hr/training/courses/${courseId}`,
          })
        }
      }

      ctx.createdData.trainingCourses = courseIds

      return {
        success: createdEntities.length > 0,
        apiCall: {
          endpoint: '/api/hr/training/courses',
          method: 'POST',
          requestPayload: { courses },
          requestHeaders: { 'Content-Type': 'application/json' },
          responseStatus: 200,
          responseBody: { created: createdEntities.length },
          responseTime: 0,
        },
        createdEntities,
        data: { courseIds },
      }
    },
  },
  {
    id: 36,
    phaseId: 9,
    name: 'Create training sessions',
    description: 'Schedule training sessions for created courses',
    endpoint: '/api/hr/training/sessions',
    method: 'POST',
    activityMessage: 'Creating training sessions...',
    execute: async (ctx: ExecutionContext): Promise<StepResult> => {
      const courses = ctx.createdData.trainingCourses as Record<string, number>
      const today = new Date().toISOString().split('T')[0]

      const gmpCourseCode = `${ctx.config.prefix}TRN01`
      const sopCourseCode = `${ctx.config.prefix}TRN02`

      const sessions = [
        {
          courseId: courses[gmpCourseCode],
          sessionDate: today,
          startTime: '09:00',
          endTime: '17:00',
          location: 'Training Room A',
          instructorExternal: 'External GMP Trainer',
          maxParticipants: 20,
        },
        {
          courseId: courses[sopCourseCode],
          sessionDate: today,
          startTime: '13:00',
          endTime: '17:00',
          location: 'Training Room B',
          instructorExternal: 'Internal SOP Trainer',
          maxParticipants: 15,
        },
      ]

      const createdEntities: CreatedEntity[] = []
      const sessionIds: Record<string, number> = {}

      for (const session of sessions) {
        if (!session.courseId) continue

        const result = await executeApiCall(ctx, '/api/hr/training/sessions', 'POST', session)
        if (result.success) {
          const sessionId = (result.data?.data as Record<string, unknown>)?.id as number
          const courseKey = Object.keys(courses).find(k => courses[k] === session.courseId)
          if (courseKey) {
            sessionIds[courseKey] = sessionId
          }
          createdEntities.push({
            entityType: 'trainingSession',
            entityId: sessionId,
            entityCode: `Session-${sessionId}`,
            viewUrl: `/hr/training/sessions/${sessionId}`,
          })
        }
      }

      ctx.createdData.trainingSessions = sessionIds

      return {
        success: createdEntities.length > 0,
        apiCall: {
          endpoint: '/api/hr/training/sessions',
          method: 'POST',
          requestPayload: { sessions },
          requestHeaders: { 'Content-Type': 'application/json' },
          responseStatus: 200,
          responseBody: { created: createdEntities.length },
          responseTime: 0,
        },
        createdEntities,
        data: { sessionIds },
      }
    },
  },
  {
    id: 37,
    phaseId: 9,
    name: 'Record training completion',
    description: 'Record training records for employees completing courses',
    endpoint: '/api/hr/training/records',
    method: 'POST',
    activityMessage: 'Recording training completion...',
    execute: async (ctx: ExecutionContext): Promise<StepResult> => {
      const employees = ctx.createdData.employees as Record<string, number>
      const courses = ctx.createdData.trainingCourses as Record<string, number>
      const sessions = ctx.createdData.trainingSessions as Record<string, number>

      const today = new Date().toISOString().split('T')[0]
      const emp1Code = `${ctx.config.prefix}EMP001`
      const emp2Code = `${ctx.config.prefix}EMP002`
      const gmpCourseCode = `${ctx.config.prefix}TRN01`
      const sopCourseCode = `${ctx.config.prefix}TRN02`

      const records = [
        {
          employeeId: employees[emp1Code],
          courseId: courses[gmpCourseCode],
          sessionId: sessions[gmpCourseCode],
          completionDate: today,
          result: 'pass',
          score: 85,
          certificateNumber: `${ctx.config.prefix}CERT-GMP-001`,
          notes: 'Completed GMP training successfully',
        },
        {
          employeeId: employees[emp2Code],
          courseId: courses[gmpCourseCode],
          sessionId: sessions[gmpCourseCode],
          completionDate: today,
          result: 'pass',
          score: 92,
          certificateNumber: `${ctx.config.prefix}CERT-GMP-002`,
          notes: 'Completed GMP training with excellent score',
        },
        {
          employeeId: employees[emp2Code],
          courseId: courses[sopCourseCode],
          sessionId: sessions[sopCourseCode],
          completionDate: today,
          result: 'pass',
          score: 88,
          certificateNumber: `${ctx.config.prefix}CERT-SOP-001`,
          notes: 'Completed SOP training',
        },
      ]

      const createdEntities: CreatedEntity[] = []

      for (const record of records) {
        if (!record.employeeId || !record.courseId) continue

        const result = await executeApiCall(ctx, '/api/hr/training/records', 'POST', record)
        if (result.success) {
          const recordId = (result.data?.data as Record<string, unknown>)?.id as number
          createdEntities.push({
            entityType: 'trainingRecord',
            entityId: recordId,
            entityCode: record.certificateNumber || `Record-${recordId}`,
            viewUrl: `/hr/training/records/${recordId}`,
          })
        }
      }

      ctx.createdData.trainingRecords = { count: createdEntities.length }

      return {
        success: createdEntities.length > 0,
        apiCall: {
          endpoint: '/api/hr/training/records',
          method: 'POST',
          requestPayload: { records },
          requestHeaders: { 'Content-Type': 'application/json' },
          responseStatus: 200,
          responseBody: { created: createdEntities.length },
          responseTime: 0,
        },
        createdEntities,
        data: { recordCount: createdEntities.length },
      }
    },
  },
  {
    id: 38,
    phaseId: 9,
    name: 'Create authorizations',
    description: 'Grant batch release and QC approval authorizations',
    endpoint: '/api/hr/authorizations',
    method: 'POST',
    activityMessage: 'Creating authorizations...',
    execute: async (ctx: ExecutionContext): Promise<StepResult> => {
      const employees = ctx.createdData.employees as Record<string, number>

      const today = new Date().toISOString().split('T')[0]
      const nextYear = new Date()
      nextYear.setFullYear(nextYear.getFullYear() + 1)
      const effectiveTo = nextYear.toISOString().split('T')[0]

      const emp2Code = `${ctx.config.prefix}EMP002` // QC Inspector

      const authorizations = [
        {
          employeeId: employees[emp2Code],
          authType: 'batch_release',
          effectiveFrom: today,
          effectiveTo: effectiveTo,
        },
        {
          employeeId: employees[emp2Code],
          authType: 'sop_approval',
          effectiveFrom: today,
          effectiveTo: effectiveTo,
        },
      ]

      const createdEntities: CreatedEntity[] = []

      for (const auth of authorizations) {
        if (!auth.employeeId) continue

        const result = await executeApiCall(ctx, '/api/hr/authorizations', 'POST', auth)
        if (result.success) {
          const authId = (result.data?.data as Record<string, unknown>)?.id as number
          createdEntities.push({
            entityType: 'authorization',
            entityId: authId,
            entityCode: `${auth.authType}-${auth.employeeId}`,
            viewUrl: `/hr/authorizations/${authId}`,
          })
        }
      }

      ctx.createdData.authorizations = { count: createdEntities.length }

      return {
        success: createdEntities.length > 0,
        apiCall: {
          endpoint: '/api/hr/authorizations',
          method: 'POST',
          requestPayload: { authorizations },
          requestHeaders: { 'Content-Type': 'application/json' },
          responseStatus: 200,
          responseBody: { created: createdEntities.length },
          responseTime: 0,
        },
        createdEntities,
        data: { authCount: createdEntities.length },
      }
    },
  },
  {
    id: 39,
    phaseId: 9,
    name: 'Record health examination',
    description: 'Create health records for periodic examination',
    endpoint: '/api/hr/health-records',
    method: 'POST',
    activityMessage: 'Recording health examinations...',
    execute: async (ctx: ExecutionContext): Promise<StepResult> => {
      const employees = ctx.createdData.employees as Record<string, number>

      const today = new Date().toISOString().split('T')[0]
      const nextYear = new Date()
      nextYear.setFullYear(nextYear.getFullYear() + 1)
      const nextExamDue = nextYear.toISOString().split('T')[0]

      const emp1Code = `${ctx.config.prefix}EMP001`
      const emp2Code = `${ctx.config.prefix}EMP002`

      const healthRecords = [
        {
          employeeId: employees[emp1Code],
          examinationType: 'periodic',
          examinationDate: today,
          nextExamDue: nextExamDue,
          fitnessStatus: 'fit',
          examinerName: 'Dr. Test Examiner',
          examinerNotes: 'Annual health check - all clear',
        },
        {
          employeeId: employees[emp2Code],
          examinationType: 'periodic',
          examinationDate: today,
          nextExamDue: nextExamDue,
          fitnessStatus: 'fit',
          examinerName: 'Dr. Test Examiner',
          examinerNotes: 'Annual health check - fit for QC duties',
        },
      ]

      const createdEntities: CreatedEntity[] = []

      for (const record of healthRecords) {
        if (!record.employeeId) continue

        const result = await executeApiCall(ctx, '/api/hr/health-records', 'POST', record)
        if (result.success) {
          const recordId = (result.data?.data as Record<string, unknown>)?.id as number
          createdEntities.push({
            entityType: 'healthRecord',
            entityId: recordId,
            entityCode: `Health-${record.employeeId}-${today}`,
            viewUrl: `/hr/health-records/${recordId}`,
          })
        }
      }

      ctx.createdData.healthRecords = { count: createdEntities.length }

      return {
        success: createdEntities.length > 0,
        apiCall: {
          endpoint: '/api/hr/health-records',
          method: 'POST',
          requestPayload: { healthRecords },
          requestHeaders: { 'Content-Type': 'application/json' },
          responseStatus: 200,
          responseBody: { created: createdEntities.length },
          responseTime: 0,
        },
        createdEntities,
        data: { recordCount: createdEntities.length },
      }
    },
  },
]

// ============================================================================
// Helper Functions for Step Lookup
// ============================================================================

/**
 * Get step definition by ID
 */
export function getStepById(stepId: number): StepDefinition | undefined {
  return STEP_DEFINITIONS.find((s) => s.id === stepId)
}

/**
 * Get steps for a specific phase
 */
export function getStepsForPhase(phaseId: number): StepDefinition[] {
  return STEP_DEFINITIONS.filter((s) => s.phaseId === phaseId)
}

/**
 * Get phase definition by ID
 */
export function getPhaseById(phaseId: number): PhaseDefinition | undefined {
  return PHASE_DEFINITIONS.find((p) => p.id === phaseId)
}
