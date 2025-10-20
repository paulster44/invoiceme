import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

const authPayload = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/register', {
    schema: {
      body: authPayload.strict()
    }
  }, async (request, reply) => {
    const body = authPayload.parse(request.body);
    const existing = await app.prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      return reply.code(400).send({ message: 'Email already registered' });
    }

    const hash = await bcrypt.hash(body.password, 10);
    const user = await app.prisma.user.create({
      data: {
        email: body.email,
        passwordHash: hash,
        taxSettings: {
          GST: 0.05,
          QST: 0.09975,
          enabled: ['GST', 'QST']
        }
      }
    });

    const token = app.jwt.sign({ id: user.id, email: user.email });
    return reply.send({ token });
  });

  app.post('/login', {
    schema: {
      body: authPayload.strict()
    }
  }, async (request, reply) => {
    const body = authPayload.parse(request.body);
    const user = await app.prisma.user.findUnique({ where: { email: body.email } });
    if (!user) {
      return reply.code(401).send({ message: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(body.password, user.passwordHash);
    if (!match) {
      return reply.code(401).send({ message: 'Invalid credentials' });
    }

    const token = app.jwt.sign({ id: user.id, email: user.email });
    return reply.send({ token });
  });
};

export default authRoutes;
