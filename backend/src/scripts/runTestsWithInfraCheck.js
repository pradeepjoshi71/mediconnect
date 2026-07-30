'use strict';

const http = require('http');
const URL = require('url');
const { spawn } = require('child_process');

const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:5000';
const isStrictIntegration = process.argv.includes('--integration');

function checkServer(urlStr) {
  return new Promise((resolve) => {
    let parsed;
    try {
      parsed = new URL.URL(`${urlStr}/ping`);
    } catch (_) {
      return resolve(false);
    }

    const req = http.get(
      {
        host: parsed.hostname || '127.0.0.1',
        port: parsed.port || 5000,
        path: parsed.pathname || '/ping',
        timeout: 2000,
      },
      (res) => {
        resolve(res.statusCode >= 200 && res.statusCode < 400);
      }
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function run() {
  const isOnline = await checkServer(baseUrl);

  if (isStrictIntegration && !isOnline) {
    console.error('\n❌ INTEGRATION TEST INFRASTRUCTURE ERROR:');
    console.error(`   Backend server is unreachable at ${baseUrl}.`);
    console.error('   Please start required services before running integration tests:');
    console.error('     docker compose up -d && npm run db:setup\n');
    process.exit(1);
  }

  let testArgs = [];
  if (isOnline) {
    console.log(`\n✅ Integration services verified online at ${baseUrl}. Running full test suite (Unit + Integration)...`);
    testArgs = [
      '--env-file=../.env',
      '--test',
      'src/tests/*.test.js',
      'src/fhir/tests/*.test.js',
      'src/insurance/tests/*.test.js',
    ];
  } else {
    console.warn('\n====================================================================');
    console.warn('⚠️  INTEGRATION TEST INFRASTRUCTURE NOTICE:');
    console.warn(`   Backend server is offline at ${baseUrl}.`);
    console.warn('   Running Unit Tests only (skipping live E2E integration suites).');
    console.warn('   To run full integration suite:');
    console.warn('     1. docker compose up -d');
    console.warn('     2. npm run test:integration');
    console.warn('====================================================================\n');
    testArgs = [
      '--env-file=../.env',
      '--test',
      'src/tests/*.test.js',
      'src/fhir/tests/fhir.mappers.test.js',
      'src/fhir/tests/fhir.schemas.test.js',
      'src/insurance/tests/insurance.repository.test.js',
    ];
  }

  const child = spawn(process.execPath, testArgs, {
    stdio: 'inherit',
    cwd: process.cwd(),
  });

  child.on('exit', (code) => {
    process.exit(code || 0);
  });
}

run();
