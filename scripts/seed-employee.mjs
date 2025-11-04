#!/usr/bin/env node
// Usage: node scripts/seed-employee.mjs --id EMP002 --name "Jane Doe" --password "NewPass123"

import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import Employee from '../lib/db/models/employee.js';
import { hashPassword } from '../lib/auth/password.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local automatically if present (useful when running this script directly)
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = args[i+1] && !args[i+1].startsWith('--') ? args[i+1] : 'true';
      out[key] = val;
      if (val !== 'true') i++;
    }
  }
  return out;
}

(async function main(){
  try{
    const opts = parseArgs();
    const employeeId = opts.id || opts.employeeId;
    const fullName = opts.name || opts.fullName || 'Unnamed Employee';
    const plainPassword = opts.password || opts.pw || opts.pass;

    if (!employeeId) {
      console.error('Missing --id EMP### (employeeId). Example: --id EMP002');
      process.exit(2);
    }
    if (!/^EMP\d{3}$/.test(employeeId)) {
      console.error('employeeId must match EMP followed by 3 digits, e.g. EMP002');
      process.exit(2);
    }
    if (!plainPassword) {
      console.error('Missing --password. Example: --password "NewPass123"');
      process.exit(2);
    }

    const uri = process.env.ATLAS_URI;
    if (!uri) {
      console.error('ATLAS_URI not set in environment. Set it in .env.local or in this session before running.');
      process.exit(2);
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected.');

    const existing = await Employee.findOne({ employeeId }).exec();
    const hashed = await hashPassword(plainPassword);

    if (existing) {
      console.log(`Employee ${employeeId} exists — updating password and name (if provided).`);
      existing.password = hashed;
      if (fullName) existing.fullName = fullName;
      await existing.save();
      console.log('Updated employee:', { employeeId: existing.employeeId, fullName: existing.fullName });
    } else {
      console.log(`Creating employee ${employeeId}...`);
      const doc = new Employee({ fullName, employeeId, password: hashed });
      await doc.save();
      console.log('Created employee:', { employeeId: doc.employeeId, fullName: doc.fullName });
    }

    await mongoose.disconnect();
    console.log('Done. Disconnected from MongoDB.');
    process.exit(0);
  }
  catch(err){
    console.error('Error seeding employee:', err);
    try { await mongoose.disconnect(); } catch(e){}
    process.exit(1);
  }
})();
