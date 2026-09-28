const profileSchema = require('../../src/validation/profileSchema');

describe('profileSchema Zod validation', () => {
  test('accepts a valid donor profile with all fields', () => {
    const validDonor = {
      role: 'donor',
      name: 'Alice Donor',
      phone: '+1234567890',
      address: '123 Green St',
      lat: 21.05,
      lng: 75.05,
    };

    const result = profileSchema.safeParse(validDonor);
    expect(result.success).toBe(true);
    expect(result.data.role).toBe('donor');
    expect(result.data.name).toBe('Alice Donor');
  });

  test('accepts valid recipient and volunteer roles with minimal fields', () => {
    const validRecipient = { role: 'recipient', name: 'Bob Recipient' };
    const validVolunteer = { role: 'volunteer', name: 'Charlie Volunteer' };

    expect(profileSchema.safeParse(validRecipient).success).toBe(true);
    expect(profileSchema.safeParse(validVolunteer).success).toBe(true);
  });

  test('rejects admin role', () => {
    const adminAttempt = {
      role: 'admin',
      name: 'Admin User',
    };

    const result = profileSchema.safeParse(adminAttempt);
    expect(result.success).toBe(false);
    expect(result.error.issues.some((issue) => issue.path.includes('role'))).toBe(true);
  });

  test('rejects missing or empty name', () => {
    // Missing name property
    const missingName = {
      role: 'donor',
    };
    expect(profileSchema.safeParse(missingName).success).toBe(false);

    // Empty whitespace-only name
    const emptyName = {
      role: 'donor',
      name: '   ',
    };
    expect(profileSchema.safeParse(emptyName).success).toBe(false);
  });
});
