const { z } = require('zod');

const requestSchema = z.object({
  category: z.string().trim().min(1, 'Category is required'),
  original_quantity: z.number().positive('Original quantity must be greater than 0'),
  unit: z.string().trim().min(1, 'Unit is required'),
  urgency_level: z.number().int().min(1).max(5),
  needed_by: z
    .union([z.string(), z.date()])
    .refine((val) => {
      const date = new Date(val);
      return !isNaN(date.getTime()) && date.getTime() > Date.now();
    }, { message: 'Needed by time must be in the future' }),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

requestSchema.requestSchema = requestSchema;
module.exports = requestSchema;
module.exports.requestSchema = requestSchema;
