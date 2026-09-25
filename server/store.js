/**
 * Storage boundary for the small auth API. Replace this in-memory adapter
 * with PostgreSQL queries when the database is introduced.
 */
export function createMemoryStore() {
  const accounts = new Map();
  const enquiries = [];

  return {
    async findAccountByEmail(email) {
      return accounts.get(email.toLowerCase()) ?? null;
    },
    async createAccount(account) {
      const email = account.email.toLowerCase();
      if (accounts.has(email)) return false;
      accounts.set(email, { ...account, email });
      return true;
    },
    async createEnquiry(enquiry) {
      const record = {
        id: enquiries.length + 1,
        ...enquiry,
        createdAt: new Date().toISOString(),
      };
      enquiries.push(record);
      return record;
    },
  };
}
