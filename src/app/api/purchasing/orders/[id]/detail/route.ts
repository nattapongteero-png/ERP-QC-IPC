import { NextRequest, NextResponse } from 'next/server';
import { getTableRef, executeDbOperation } from '@/lib/db/db-helper';
import { eq } from 'drizzle-orm';
import { withAuth, serverErrorResponse } from '@/lib/api-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;

      const purchaseOrders = getTableRef('purchaseOrders');
      const purchaseOrderLines = getTableRef('purchaseOrderLines');
      const items = getTableRef('items');
      const vendors = getTableRef('vendors');
      const inventoryLots = getTableRef('inventoryLots');
      const users = getTableRef('users');

      // Get PO details
      const poResult = await executeDbOperation(async (db) => {
        return db
          .select({
            id: purchaseOrders.id,
            poNumber: purchaseOrders.poNumber,
            vendorId: purchaseOrders.vendorId,
            vendorCode: vendors.code,
            vendorName: vendors.name,
            vendorContact: vendors.contactPerson,
            vendorPhone: vendors.phone,
            vendorEmail: vendors.email,
            orderDate: purchaseOrders.orderDate,
            expectedDate: purchaseOrders.expectedDate,
            status: purchaseOrders.status,
            totalAmount: purchaseOrders.totalAmount,
            vatInclusive: purchaseOrders.vatInclusive,
            notes: purchaseOrders.notes,
            // Payment terms + delivery address were saved on create but the
            // detail query never returned them, so the edit form loaded them
            // back as empty (list item 44). Select them so edits preserve them.
            paymentTerms: purchaseOrders.paymentTerms,
            shippingAddress: purchaseOrders.shippingAddress,
            // createdBy drives the separation-of-duties guard (the creator must
            // not approve their own PO).
            createdBy: purchaseOrders.createdBy,
            approvedBy: purchaseOrders.approvedBy,
            approvedAt: purchaseOrders.approvedAt,
            // Metaherb dual-approval state (null for non-Metaherb POs).
            metaherbApproval: purchaseOrders.metaherbApproval,
            erpOwnerApproval: purchaseOrders.erpOwnerApproval,
            sentVia: purchaseOrders.sentVia,
            sentAt: purchaseOrders.sentAt,
            sentToEmail: purchaseOrders.sentToEmail,
            createdAt: purchaseOrders.createdAt,
            updatedAt: purchaseOrders.updatedAt,
          })
          .from(purchaseOrders)
          .leftJoin(vendors, eq(purchaseOrders.vendorId, vendors.id))
          .where(eq(purchaseOrders.id, parseInt(id)));
      });

      if (poResult.length === 0) {
        return NextResponse.json({ success: false, error: 'Purchase order not found' }, { status: 404 });
      }

      const po = poResult[0];

      // Resolve creator / approver display names for the printable PO signature
      // block (separate small lookups keep the main query's joins simple).
      const lookupUserName = async (userId: number | null): Promise<string | null> => {
        if (!userId) return null;
        const rows = await executeDbOperation(async (db) =>
          db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1),
        );
        return rows[0]?.name ?? null;
      };
      const createdByName = await lookupUserName(po.createdBy as number | null);
      const approvedByName = await lookupUserName(po.approvedBy as number | null);

      // Get PO lines
      const linesResult = await executeDbOperation(async (db) => {
        return db
          .select({
            id: purchaseOrderLines.id,
            itemId: purchaseOrderLines.itemId,
            itemCode: items.code,
            itemName: items.nameTh,
            itemNameEn: items.nameEn,
            itemUnit: items.primaryUnit,
            // Drives the receive dialog's default warehouse + checklist category:
            // a finished-goods line must default to the FG warehouse, not WH-RM.
            itemType: items.type,
            quantity: purchaseOrderLines.quantity,
            unitPrice: purchaseOrderLines.unitPrice,
            receivedQty: purchaseOrderLines.receivedQuantity,
            unit: purchaseOrderLines.unit,
            totalPrice: purchaseOrderLines.totalPrice,
          })
          .from(purchaseOrderLines)
          .leftJoin(items, eq(purchaseOrderLines.itemId, items.id))
          .where(eq(purchaseOrderLines.poId, parseInt(id)));
      });

      // Calculate line totals and receiving status
      const linesWithTotals = linesResult.map((line: Record<string, unknown>) => {
        const quantity = Number(line.quantity) || 0;
        const receivedQty = Number(line.receivedQty) || 0;
        const unitPrice = Number(line.unitPrice) || 0;
        const totalPrice = Number(line.totalPrice) || 0;

        return {
          ...line,
          quantity,
          receivedQty,
          unitPrice,
          lineTotal: totalPrice || (quantity * unitPrice),
          pendingQty: quantity - receivedQty,
          receivingStatus: receivedQty >= quantity ? 'complete' :
                          receivedQty > 0 ? 'partial' : 'pending',
        };
      });

      // Get received lots for this PO
      const receivedLotsData = await executeDbOperation(async (db) => {
        return db
          .select({
            id: inventoryLots.id,
            lotNumber: inventoryLots.lotNumber,
            itemId: inventoryLots.itemId,
            itemCode: items.code,
            itemName: items.nameTh,
            quantity: inventoryLots.quantity,
            status: inventoryLots.status,
            expiryDate: inventoryLots.expiryDate,
            receivedDate: inventoryLots.receivedDate,
          })
          .from(inventoryLots)
          .leftJoin(items, eq(inventoryLots.itemId, items.id))
          .where(eq(inventoryLots.poNumber, po.poNumber as string));
      });

      // Get journal entries for these lots
      const journalEntries = getTableRef('journalEntries');
      const apInvoices = getTableRef('APInvoices');
      const lotIds = receivedLotsData.map((lot: { id: number }) => lot.id);
      const journalEntriesMap: Record<number, Array<{ id: number; entryNumber: string; status: string }>> = {};
      const apInvoicesMap: Record<number, Array<{ id: number; invoiceNumber: string; status: string; totalAmount: number }>> = {};

      if (lotIds.length > 0) {
        // Get linked journal entries
        const linkedJournals = await executeDbOperation(async (db) => {
          return db
            .select({
              id: journalEntries.id,
              entryNumber: journalEntries.entryNumber,
              sourceType: journalEntries.sourceType,
              sourceId: journalEntries.sourceId,
              status: journalEntries.status,
            })
            .from(journalEntries)
            .where(eq(journalEntries.sourceType, 'PO_RECEIPT'));
        });

        // Group by lotId (sourceId)
        for (const je of linkedJournals) {
          const lotId = Number(je.sourceId);
          if (lotIds.includes(lotId)) {
            if (!journalEntriesMap[lotId]) {
              journalEntriesMap[lotId] = [];
            }
            journalEntriesMap[lotId].push({
              id: je.id,
              entryNumber: je.entryNumber || '',
              status: je.status || 'draft',
            });
          }
        }

        // Get linked AP invoices (via purchaseOrderId)
        const linkedAPInvoices = await executeDbOperation(async (db) => {
          return db
            .select({
              id: apInvoices.id,
              invoiceNumber: apInvoices.invoiceNumber,
              purchaseOrderId: apInvoices.purchaseOrderId,
              status: apInvoices.status,
              totalAmount: apInvoices.totalAmount,
              description: apInvoices.description,
            })
            .from(apInvoices)
            .where(eq(apInvoices.purchaseOrderId, parseInt(id)));
        });

        // Map AP invoices - for now, associate with all lots from the same PO
        // (In a more complex system, you'd track which lots map to which invoices)
        for (const apInv of linkedAPInvoices) {
          // Check if description contains the lot number
          for (const lotId of lotIds) {
            const lot = receivedLotsData.find((l: { id: number }) => l.id === lotId);
            if (lot && apInv.description && apInv.description.includes(lot.lotNumber)) {
              if (!apInvoicesMap[lotId]) {
                apInvoicesMap[lotId] = [];
              }
              apInvoicesMap[lotId].push({
                id: apInv.id,
                invoiceNumber: apInv.invoiceNumber || '',
                status: apInv.status || 'draft',
                totalAmount: Number(apInv.totalAmount) || 0,
              });
            }
          }
        }
      }

      // Attach journal entries and AP invoices to lots
      const receivedLots = receivedLotsData.map((lot: { id: number; lotNumber: string; itemId: number; itemCode: string; itemName: string; quantity: number; status: string; expiryDate: string; receivedDate: string }) => ({
        ...lot,
        journalEntries: journalEntriesMap[lot.id] || [],
        apInvoices: apInvoicesMap[lot.id] || [],
      }));

      // Calculate summary
      const totalOrdered = linesWithTotals.reduce((sum: number, line: Record<string, unknown>) => sum + (line.quantity as number), 0);
      const totalReceived = linesWithTotals.reduce((sum: number, line: Record<string, unknown>) => sum + (line.receivedQty as number), 0);
      const totalPending = totalOrdered - totalReceived;
      const receivingProgress = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;

      return NextResponse.json({
        success: true,
        data: {
          purchaseOrder: { ...po, createdByName, approvedByName },
          lines: linesWithTotals,
          receivedLots,
          summary: {
            lineCount: linesWithTotals.length,
            totalOrdered,
            totalReceived,
            totalPending,
            receivingProgress,
            totalAmount: po.totalAmount || linesWithTotals.reduce((sum: number, line: Record<string, unknown>) => sum + (line.lineTotal as number), 0),
            lotsReceived: receivedLots.length,
          },
        },
      });
    } catch (error) {
      console.error('Error fetching purchase order details:', error);
      return serverErrorResponse(error);
    }
  });
}
