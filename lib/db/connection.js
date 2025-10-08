import mongoose from 'mongoose';
import Employee from './models/employee.js'; 
import { hashPassword } from '../auth/password.js';

const uri = process.env.ATLAS_URI;

if (!uri) {
    throw new Error("ATLAS_URI is not defined in environment variables");
}

// Validate the connection string format
if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
  throw new Error("Invalid MongoDB connection string format");
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function seedEmployee() {
  try{
    // Check for existing employees
    const employeeCount = await Employee.countDocuments();

    if (employeeCount === 0) {
      console.log('Seeding employee data');

      // Create default employee
      const defaultEmployee = new Employee({
        fullName: 'Walter White',
        employeeId: 'EMP001',
        position: 'Administrator',
        password: await hashPassword(process.env.EMPLOYEE_DEFAULT_PASSWORD)
      });

      await defaultEmployee.save();
      console.log('Default employee created successfully');

    }
  } catch (error) {
    console.error('Error seeding employee data:', error);
  }
}
async function dbConnect() {
    if (cached.conn) {
        return cached.conn;
    }

    if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      // Connection timeout
      serverSelectionTimeoutMS: 10000, // 10 seconds
      socketTimeoutMS: 45000, // 45 seconds
      // Limit connection pool
      maxPoolSize: 10,
      minPoolSize: 5,
      // Enable SSL/TLS
      ssl: true,
      // Retry writes
      retryWrites: true,
      // Read concern
      readConcern: { level: "majority" },
      // Write concern
      writeConcern: { w: "majority", j: true, wtimeout: 1000 }
    };

    cached.promise = mongoose.connect(uri, opts).then((mongoose) => {
        console.log("MongoDB connected!");
        return mongoose;
    }).catch(err => {
        console.error("MongoDB connection error:", err);
        throw new Error("Database connection failed");
    });
    }

    try {
        cached.conn = await cached.promise;
        await seedEmployee();
        return cached.conn;
    } catch (error) {
        cached.promise = null;
        throw error;
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  if (cached.conn) {
    await mongoose.connection.close();
    console.log('MongoDB connection closed.');
    process.exit(0);
  }
});

process.on('SIGTERM', async () => {
    if (cached.conn) {
        await mongoose.connection.close();
        console.log('MongoDB connection closed gracefully');
        process.exit(0);
    }
});

export default dbConnect;