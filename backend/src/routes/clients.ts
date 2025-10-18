import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const clientSchema = z.object({
  name: z.string().min(1),
  company: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional()
});

const sanitize = (value: string | undefined | null) => (typeof value === 'string' ? value.trim() : value ?? undefined);

const clientsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/clients', async (request) => {
    const search = (request.query as Record<string, string | undefined>).search ?? '';
    const clients = await app.prisma.client.findMany({
      where: {
        userId: (request.user as any).id,
        OR: search
          ? [
              { name: { contains: search, mode: 'insensitive' } },
              { company: { contains: search, mode: 'insensitive' } }
            ]
          : undefined
      },
      orderBy: { createdAt: 'desc' }
    });
    return clients;
  });

  app.post('/clients', async (request) => {
    const data = clientSchema.parse(request.body);
    return app.prisma.client.create({
      data: {
        name: sanitize(data.name)!,
        company: sanitize(data.company),
        email: sanitize(data.email),
        phone: sanitize(data.phone),
        address: sanitize(data.address),
        notes: sanitize(data.notes),
        userId: (request.user as any).id
      }
    });
  });

  app.put('/clients/:id', async (request, reply) => {
    const data = clientSchema.partial().parse(request.body);
    const { id } = request.params as { id: string };
    const existing = await app.prisma.client.findFirst({ where: { id, userId: (request.user as any).id } });
    if (!existing) {
      return reply.code(404).send({ message: 'Client not found' });
    }
    return app.prisma.client.update({
      where: { id },
      data: {
        name: sanitize(data.name ?? existing.name)!,
        company: sanitize(data.company) ?? existing.company,
        email: sanitize(data.email) ?? existing.email,
        phone: sanitize(data.phone) ?? existing.phone,
        address: sanitize(data.address) ?? existing.address,
        notes: sanitize(data.notes) ?? existing.notes
      }
    });
  });

  app.delete('/clients/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await app.prisma.client.findFirst({ where: { id, userId: (request.user as any).id } });
    if (!existing) {
      return reply.code(404).send({ message: 'Client not found' });
    }
    await app.prisma.client.delete({ where: { id } });
    reply.code(204).send();
  });
};

export default clientsRoutes;
