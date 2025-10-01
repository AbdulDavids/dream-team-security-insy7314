import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 text-center">
        {/* Logo/Icon Section */}
        <div className="flex justify-center">
          <div className="bg-indigo-600 rounded-full p-4">
            <svg 
              className="h-16 w-16 text-white" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
              />
            </svg>
          </div>
        </div>

        {/* Welcome Heading */}
        <div className="space-y-4">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900">
            International
          </h1>
          <h2 className="text-3xl sm:text-4xl font-bold text-indigo-600">
            Payments Portal
          </h2>
          <p className="text-lg text-gray-600 mt-6">
            Secure, fast, and reliable international payment processing
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-4 pt-8">
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/login"
              className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200 min-w-[140px]"
            >
              Login
            </Link>
            <Link 
              href="/register"
              className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-200 min-w-[140px]"
            >
              Register
            </Link>
          </div>
          <div className="flex justify-center">
            <Link 
              href="/employee-login"
              className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200 min-w-[140px]"
            >
              Employee Login
            </Link>
          </div>
        </div>

        {/* Additional Info */}
        <div className="pt-8">
          <p className="text-sm text-gray-500">
            New to our platform? Create an account to get started.
          </p>
        </div>
      </div>
    </div>
  );
}
