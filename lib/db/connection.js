import mongoose from 'mongoose';

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

async function dbConnect() {
    if (cached.conn) {
        return cached.conn;
    }

    if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      // Security: Connection timeout
      serverSelectionTimeoutMS: 10000, // 10 seconds
      socketTimeoutMS: 45000, // 45 seconds
      // Security: Limit connection pool
      maxPoolSize: 10,
      minPoolSize: 5,
      // Security: Enable SSL/TLS
      ssl: true,
      // Security: Retry writes
      retryWrites: true,
      // Security: Read concern
      readConcern: { level: "majority" },
      // Security: Write concern
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

export default dbConnect;