This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm install
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```
## Employee login details:
Employee ID: EMP001
Password: Password123!

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Target Final Structure
```
insy-project/
├── app/                           # App Router (Next.js 13+)
│   ├── (auth)/                    # Route groups for auth pages
│   │   ├── login/
│   │   │   └── page.jsx           # Login page
│   │   └── register/
│   │       └── page.jsx           # Registration page
│   │
│   ├── dashboard/
│   │   ├── user/
│   │   │   └── page.jsx           # User dashboard
│   │   └── admin/
│   │       └── page.jsx           # Admin dashboard
│   │
│   ├── api/                       # API routes
│   │   ├── auth/
│   │   │   ├── login/route.js     # POST login
│   │   │   ├── logout/route.js    # POST logout
│   │   │   └── refresh/route.js   # Token refresh
│   │   ├── payments/
│   │   │   ├── route.js           # GET/POST payments
│   │   │   └── [id]/
│   │   │       └── route.js       # PUT/DELETE specific payment
│   │   └── admin/
│   │       └── verify/
│   │           └── route.js       # Payment verification
│   │
│   ├── globals.css
│   ├── layout.jsx                 # Root layout with security headers
│   └── page.jsx                   # Landing page
│
├── components/                    # Reusable UI components
│   ├── ui/                        # Basic UI components
│   ├── forms/                     # Secure form components
│   └── auth/                      # Auth-related components
│
├── lib/                          # Core utilities and configs
│   ├── auth/
│   │   ├── jwt.js                # JWT utilities
│   │   ├── password.js           # bcrypt hashing/salting
│   │   └── session.js            # Session management
│   ├── db/
│   │   ├── connection.js         # Secure DB connection
│   │   ├── models/               # Data models
│   │   └── migrations/           # DB schema
│   ├── security/
│   │   ├── validation.js         # Input validation/sanitization
│   │   ├── csrf.js               # CSRF protection
│   │   ├── rateLimit.js          # Rate limiting
│   │   └── headers.js            # Security headers
│   └── utils/
│       ├── logger.js             # Secure logging
│       └── encryption.js         # Additional encryption utilities
│
├── middleware.js                 # Next.js middleware (critical for security)
├── next.config.js               # Security configurations
└── package.json
└── package.json
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
