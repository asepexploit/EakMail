/**
 * Products HTTP routes (F6). Thin controllers: validate with zod, delegate to the
 * service, shape the response. No business logic here (backend-guide.md §2).
 * Mounted under /api/products by the server's route registrar.
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ValidationError } from '../../lib/errors.js';
import * as productService from '../../modules/products/product.service.js';
import { stockRepository } from '../../modules/products/stock.repository.js';

const optionSchema = z.object({
  key: z.string().min(1),
  value: z.string().min(1),
  price: z.number().int().nonnegative().optional(),
});

const upsertSchema = z.object({
  name: z.string().min(1),
  price: z.number().int().nonnegative(),
  sku: z.string().nullish(),
  description: z.string().nullish(),
  imageUrl: z.string().url().nullish(),
  supplierId: z.string().nullish(),
  workflowId: z.string().nullish(),
  stockMode: z.enum(['manual', 'unlimited', 'workflow', 'stock_only', 'stock_with_fallback', 'api_supplier', 'stock_with_api_fallback']).optional(),
  stock: z.number().int().nonnegative().optional(),
  deliveryTemplate: z.string().nullish(),
  externalProductId: z.string().nullish(),
  active: z.boolean().optional(),
  options: z.array(optionSchema).optional(),
});

const activeSchema = z.object({ active: z.boolean() });

const idParamSchema = z.object({ id: z.string().min(1) });

/** Parse with zod, converting failures to the domain ValidationError (mapped to 400). */
function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(result.error.issues.map((i) => i.message).join('; '));
  }
  return result.data;
}

/** The authenticated admin id, when the auth middleware has populated it. */
function adminId(request: FastifyRequest): string | undefined {
  return (request as { adminUser?: { id: string } }).adminUser?.id;
}

export async function productsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async () => {
    // Shape as Paginated<ProductDto> to match the shared DTO contract the frontend expects
    // (api.products.list -> Paginated<ProductDto>). Consistent with suppliers/workflows.
    const items = await productService.listProducts();
    return { items, total: items.length, page: 1, pageSize: items.length };
  });

  app.get('/:id', async (request) => {
    const { id } = parse(idParamSchema, request.params);
    return productService.getProduct(id);
  });

  app.post('/', async (request, reply) => {
    const body = parse(upsertSchema, request.body);
    const created = await productService.createProduct(body);
    return reply.code(201).send(created);
  });

  app.put('/:id', async (request) => {
    const { id } = parse(idParamSchema, request.params);
    const body = parse(upsertSchema, request.body);
    return productService.updateProduct(id, body, adminId(request));
  });

  app.patch('/:id/active', async (request) => {
    const { id } = parse(idParamSchema, request.params);
    const { active } = parse(activeSchema, request.body);
    return productService.setProductActive(id, active);
  });

  app.delete('/:id', async (request, reply) => {
    const { id } = parse(idParamSchema, request.params);
    await productService.deleteProduct(id);
    return reply.code(204).send();
  });

  // ---- Stock item management --------------------------------------------------

  /** GET /api/products/:id/stock — list all stock items (admin view). */
  app.get('/:id/stock', async (request) => {
    const { id } = parse(idParamSchema, request.params);
    const items = await stockRepository.listItems(id);
    const available = items.filter((i) => !i.usedAt).length;
    return { items, available, total: items.length };
  });

  /** POST /api/products/:id/stock — add stock items (one per line in body.items[]). */
  app.post('/:id/stock', async (request, reply) => {
    const { id } = parse(idParamSchema, request.params);
    const { items } = parse(z.object({ items: z.array(z.string().min(1)).min(1) }), request.body);
    const added = await stockRepository.addItems(id, items);
    return reply.code(201).send({ added });
  });

  /** DELETE /api/products/:id/stock — clear unused stock items. */
  app.delete('/:id/stock', async (request, reply) => {
    const { id } = parse(idParamSchema, request.params);
    const cleared = await stockRepository.clearUnused(id);
    return reply.code(200).send({ cleared });
  });

  /** PATCH /api/products/:id/delivery-template — update delivery template only. */
  app.patch('/:id/delivery-template', async (request) => {
    const { id } = parse(idParamSchema, request.params);
    const { deliveryTemplate } = parse(
      z.object({ deliveryTemplate: z.string().nullish() }),
      request.body,
    );
    const product = await productService.getProduct(id);
    return productService.updateProduct(
      id,
      { name: product.name, price: product.price, deliveryTemplate: deliveryTemplate ?? null },
      undefined,
    );
  });

  /**
   * POST /api/products/import-api — bulk-import products from an API supplier catalog.
   * Creates a new Product for each entry, linked to the supplier via externalProductId.
   */
  app.post('/import-api', async (request, reply) => {
    const importSchema = z.object({
      supplierId: z.string().min(1),
      products: z.array(z.object({
        externalId: z.union([z.number().int().positive(), z.string().min(1)]),
        name: z.string().min(1),
        price: z.number().int().nonnegative(),
        description: z.string().nullish(),
      })).min(1),
    });
    const { supplierId, products } = parse(importSchema, request.body);
    let imported = 0;
    for (const p of products) {
      await productService.createProduct({
        name: p.name,
        price: p.price,
        description: p.description ?? null,
        supplierId,
        stockMode: 'api_supplier',
        externalProductId: String(p.externalId),
        active: true,
      });
      imported++;
    }
    return reply.code(201).send({ imported });
  });
}
