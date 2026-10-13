process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-test-access-secret';
process.env.QR_SECRET = 'test-qr-secret-test-qr-secret-123';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://apex:apex@localhost:5433/apex_test';
process.env.CORS_ORIGINS = 'http://localhost:3000';
process.env.CURRENT_TERM = '2026-2';
