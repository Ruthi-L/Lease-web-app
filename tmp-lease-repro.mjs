import { POST } from './src/app/api/leases/route.ts';

const payload = {
  landlord: {
    name: 'Test Landlord',
    email: 'ruthilokh@gmail.com',
    password: 'password123',
    civicAddress: '1 Main St',
    phoneHome: '555-5555'
  },
  sections: {
    section1: {},
    section2: { otherOccupants: 'None' },
    section3: { premisesAddress: '1 Main St' },
    section4: {},
    section5: {},
    section6: {},
    section7: {},
    section8: {},
    section9: {},
    section11: {},
    section12: {},
    section13: {},
    section15: {},
    section16: {},
    section18: {},
    section19: {},
    section23: {},
    section26: {}
  },
  tenants: [{
    firstName: 'Jane',
    initial: 'A',
    lastName: 'Tenant',
    email: 'jane@example.com',
    phone: '555-1234',
    dateOfBirth: '1990-01-01',
    isMinor: false
  }]
};

const req = new Request('http://localhost/api/leases', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});

const response = await POST(req);
console.log('status', response.status);
console.log(await response.text());
