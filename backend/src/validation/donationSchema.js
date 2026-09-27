const { z } = require('zod');

const donationSchema = z.object({
  category: z.string().trim().min(1, 'Category is required'),
  description: z.string().trim().optional().nullable(),
  original_quantity: z.number().positive('Original quantity must be greater than 0'),
  unit: z.string().trim().min(1, 'Unit is required'),
  expiry_time: z
    .union([z.string(), z.date()])
    .refine((val) => {
      const date = new Date(val);
      return !isNaN(date.getTime()) && date.getTime() > Date.now();
    }, { message: 'Expiry time must be in the future' }),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

donationSchema.donationSchema = donationSchema;
module.exports = donationSchema;
module.exports.donationSchema = donationSchema;
