import { NextRequest, NextResponse } from 'next/server';
import { eq, desc, and, or } from 'drizzle-orm';
import { getTableRef, executeDbOperation } from '@/lib/db/db-helper';
import { withAuth, serverErrorResponse } from '@/lib/api-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const soId = parseInt(id);

      const salesDeliveries = getTableRef('salesDeliveries');
      const items = getTableRef('items');
      const journalEntries = getTableRef('journalEntries');
      const arInvoices = getTableRef('arInvoices');

      // Fetch deliveries
      const deliveriesData = await executeDbOperation(async (db) => {
        return db
          .select({
            id: salesDeliveries.id,
            deliveryNumber: salesDeliveries.deliveryNumber,
            soLineId: salesDeliveries.soLineId,
            itemId: salesDeliveries.itemId,
            itemCode: items.code,
            itemName: items.nameTh,
            lotId: salesDeliveries.lotId,
            lotNumber: salesDeliveries.lotNumber,
            quantity: salesDeliveries.quantity,
            unit: salesDeliveries.unit,
            deliveryDate: salesDeliveries.deliveryDate,
            status: salesDeliveries.status,
            notes: salesDeliveries.notes,
            createdAt: salesDeliveries.createdAt,
          })
          .from(salesDeliveries)
          .leftJoin(items, eq(salesDeliveries.itemId, items.id))
          .where(eq(salesDeliveries.soId, soId))
          .orderBy(desc(salesDeliveries.createdAt));
      });

      // Fetch linked journal entries for all deliveries
      const deliveryIds = deliveriesData.map((d) => d.id);
      const journalEntriesMap: Record<number, Array<{ id: number; entryNumber: string; sourceType: string; status: string }>> = {};
      const arInvoicesMap: Record<number, Array<{ id: number; invoiceNumber: string; taxInvoiceNumber: string; status: string; totalAmount: number }>> = {};

      if (deliveryIds.length > 0) {
        const linkedJournals = await executeDbOperation(async (db) => {
          // Query journal entries linked to these deliveries via sourceType and sourceId
          return db
            .select({
              id: journalEntries.id,
              entryNumber: journalEntries.entryNumber,
              sourceType: journalEntries.sourceType,
              sourceId: journalEntries.sourceId,
              status: journalEntries.status,
            })
            .from(journalEntries)
            .where(
              and(
                or(
                  eq(journalEntries.sourceType, 'SO_SHIPMENT'),
                  eq(journalEntries.sourceType, 'SO_COGS')
                ),
                // sourceId is the deliveryId
              )
            );
        });

        // Filter and group by deliveryId (sourceId)
        for (const je of linkedJournals) {
          const deliveryId = Number(je.sourceId);
          if (deliveryIds.includes(deliveryId)) {
            if (!journalEntriesMap[deliveryId]) {
              journalEntriesMap[deliveryId] = [];
            }
            journalEntriesMap[deliveryId].push({
              id: je.id,
              entryNumber: je.entryNumber || '',
              sourceType: je.sourceType || '',
              status: je.status || 'draft',
            });
          }
        }

        // Fetch linked AR invoices for this SO
        const linkedARInvoices = await executeDbOperation(async (db) => {
          return db
            .select({
              id: arInvoices.id,
              invoiceNumber: arInvoices.invoiceNumber,
              taxInvoiceNumber: arInvoices.taxInvoiceNumber,
              salesOrderId: arInvoices.salesOrderId,
              status: arInvoices.status,
              totalAmount: arInvoices.totalAmount,
              description: arInvoices.description,
            })
            .from(arInvoices)
            .where(eq(arInvoices.salesOrderId, soId));
        });

        // Map AR invoices to deliveries based on description containing delivery number
        for (const arInv of linkedARInvoices) {
          for (const delivery of deliveriesData) {
            if (arInv.description && arInv.description.includes(delivery.deliveryNumber)) {
              if (!arInvoicesMap[delivery.id]) {
                arInvoicesMap[delivery.id] = [];
              }
              arInvoicesMap[delivery.id].push({
                id: arInv.id,
                invoiceNumber: arInv.invoiceNumber || '',
                taxInvoiceNumber: arInv.taxInvoiceNumber || '',
                status: arInv.status || 'draft',
                totalAmount: Number(arInv.totalAmount) || 0,
              });
            }
          }
        }
      }

      // Attach journal entries and AR invoices to deliveries
      const deliveries = deliveriesData.map((d) => ({
        ...d,
        journalEntries: journalEntriesMap[d.id] || [],
        arInvoices: arInvoicesMap[d.id] || [],
      }));

      // Calculate summary
      const totalDelivered = deliveries.reduce(
        (sum: number, d: typeof deliveries[0]) => sum + Number(d.quantity || 0),
        0
      );

      return NextResponse.json({
        success: true,
        data: {
          deliveries,
          summary: {
            count: deliveries.length,
            totalDelivered,
          },
        },
      });
    } catch (error) {
      console.error('Error fetching deliveries:', error);
      return serverErrorResponse(error);
    }
  });
}
