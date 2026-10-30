# Backend Project Structure

```text
Backend/
├── src/
│   ├── config/             # DB & third-party configuration (db.js)
│   ├── controllers/        # Business logic for endpoints
│   ├── middleware/         # Custom middlewares (auth, error handler, rate limiter)
│   ├── models/             # Mongoose schemas (User, Order, Captain, Seller, Admin, etc.)
│   ├── routes/             # Express API route declarations
│   ├── services/           # External services (Payment gateways, Push notifications, SMS/Email)
│   └── utils/              # Helper functions, JWT utils, validators
├── .env                    # Environment variables (git-ignored)
├── .env.example            # Environment variables template
├── .gitignore              # Git ignore configuration
├── package.json            # Node.js dependencies & scripts
└── README.md
```
