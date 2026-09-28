const { z } = require('zod');

const profileSchema = z.object({
  role: z.enum(['donor', 'recipient', 'volunteer'], {
    errorMap: () => ({ message: "Role must be one of 'donor', 'recipient', 'volunteer'" }),
  }),
  name: z.string().trim().min(1, 'Name is required'),
  phone: z.string().trim().optional().nullable(),
  address: z.string().trim().optional().nullable(),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
});

profileSchema.profileSchema = profileSchema;
module.exports = profileSchema;
module.exports.profileSchema = profileSchema;
