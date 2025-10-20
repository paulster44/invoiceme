import { Prisma } from '@prisma/client';
import { FastifyPluginAsync } from 'fastify';

const meRoutes: FastifyPluginAsync = async (app) => {
  app.get('/me', { preHandler: [app.authenticate] }, async (request) => {
    const user = await app.prisma.user.findUnique({ where: { id: request.user.id } });
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      businessName: user.businessName,
      currency: user.currency,
      taxSettings: user.taxSettings,
      invoicePrefix: user.invoicePrefix
    };
  });

  app.put('/settings', { preHandler: [app.authenticate] }, async (request) => {
    const body = request.body as Record<string, unknown>;

    const updateData: {
      businessName?: string;
      currency?: string;
      invoicePrefix?: string;
      taxSettings?: Prisma.InputJsonValue;
    } = {
      businessName: body.businessName as string | undefined,
      currency: body.currency as string | undefined,
      invoicePrefix: body.invoicePrefix as string | undefined
    };

    if (body.taxSettings !== undefined) {
      const raw = (body.taxSettings ?? {}) as Record<string, unknown>;
      const safeJson: Prisma.InputJsonValue = raw as unknown as Prisma.InputJsonValue;
      updateData.taxSettings = safeJson;
    }

    const updated = await app.prisma.user.update({
      where: { id: request.user.id },
      data: updateData
    });
    return {
      id: updated.id,
      email: updated.email,
      businessName: updated.businessName,
      currency: updated.currency,
      taxSettings: updated.taxSettings,
      invoicePrefix: updated.invoicePrefix
    };
  });
};

export default meRoutes;
